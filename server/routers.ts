import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  countActiveSessionsByUser,
  createSession,
  createVoltixUser,
  getAllActiveSessions,
  getActiveSessionsByUser,
  getDeviceLogsByUser,
  getSessionByToken,
  getVoltixUserByUsername,
  getVoltixUserById,
  invalidateAllUserSessions,
  invalidateSession,
  listAllVoltixUsers,
  listServers,
  logDevice,
  seedServersIfEmpty,
  updateSessionJellyfinToken,
  updateSessionPing,
  updateSessionTokenRefresh,
  updateVoltixUser,
  updateVoltixUserActive,
} from "./db";

// ─── Constants ────────────────────────────────────────────────────────────────
const VOLTIX_SESSION_COOKIE = "voltix_session";
/** Re-authenticate against Jellyfin if token is older than 6 hours */
const TOKEN_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getVoltixSession(req: { cookies?: Record<string, string> }) {
  const token = req.cookies?.[VOLTIX_SESSION_COOKIE];
  if (!token) return null;
  return getSessionByToken(token);
}

/**
 * Perform server-side Jellyfin /Users/AuthenticateByName.
 * The Lumistream server is contacted ONLY by this function — never by the client.
 */
async function jellyfinAuthenticate(
  serverUrl: string,
  jellyfinUsername: string,
  jellyfinPassword: string,
  deviceName: string
): Promise<{ token: string; userId: string } | null> {
  try {
    const url = `${serverUrl.replace(/\/+$/, "")}/Users/AuthenticateByName`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Emby-Authorization": `MediaBrowser Client="Voltix", Device="${deviceName}", DeviceId="voltix-server", Version="10.9.0"`,
      },
      body: JSON.stringify({ Username: jellyfinUsername, Pw: jellyfinPassword }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { AccessToken?: string; User?: { Id?: string } };
    if (!data.AccessToken || !data.User?.Id) return null;
    return { token: data.AccessToken, userId: data.User.Id };
  } catch {
    return null;
  }
}

// ─── Admin guard ──────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,

  // ─── Manus OAuth (admin login only) ────────────────────────────────────
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Voltix first-layer auth gateway ────────────────────────────────────
  voltix: router({
    /**
     * Login — server-first flow.
     *
     * The client MUST pass the serverId of the server the user selected
     * on the server-selection screen.  Voltix Web will:
     *   1. Validate Voltix credentials against the Voltix Web database.
     *   2. Check subscription status.
     *   3. Enforce per-user device limit.
     *   4. Authenticate against the CHOSEN server (serverId) via Jellyfin
     *      /Users/AuthenticateByName — server-side only.
     *   5. Store the Jellyfin token in the session.
     *   6. Return the proxy URL for the chosen server only.
     *
     * The client never sees the Jellyfin token, Jellyfin credentials,
     * or raw Lumistream URLs at any point.
     */
    login: publicProcedure
      .input(
        z.object({
          username: z.string().min(1),
          password: z.string().min(1),
          /** Auto-detected device name — never entered by the user */
          deviceName: z.string().optional(),
          /**
           * ID of the server the user selected before login.
           * Voltix Web authenticates against THIS server.
           * If omitted, defaults to the first (Main) server.
           */
          serverId: z.number().int().positive().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // ── 1. Look up account in Voltix Web database ─────────────────────
        const voltixUser = await getVoltixUserByUsername(input.username);
        if (!voltixUser) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
        }

        // ── 2. Verify Voltix password ──────────────────────────────────────
        const passwordValid = await bcrypt.compare(input.password, voltixUser.passwordHash);
        if (!passwordValid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
        }

        // ── 3. Check subscription status ───────────────────────────────────
        if (!voltixUser.isActive) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Your subscription is inactive. Please renew to continue.",
          });
        }

        // ── 4. Enforce concurrent device limit ─────────────────────────────
        const activeCount = await countActiveSessionsByUser(voltixUser.id);
        if (activeCount >= voltixUser.maxConcurrentDevices) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Device limit reached. Your plan allows ${voltixUser.maxConcurrentDevices} concurrent device${voltixUser.maxConcurrentDevices === 1 ? "" : "s"}. Please sign out from another device first.`,
          });
        }

        // ── 5. Resolve the target server ───────────────────────────────────
        await seedServersIfEmpty();
        const servers = await listServers();

        // Use the client-supplied serverId, or fall back to the first server
        const targetServer = input.serverId
          ? servers.find((s) => s.id === input.serverId) ?? servers[0]
          : servers[0];

        if (!targetServer) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "No streaming servers are configured.",
          });
        }

        // ── 6. Authenticate against the CHOSEN server (server-side only) ───
        const deviceName = input.deviceName ?? "Voltix Web";
        let jellyfinToken: string | null = null;
        let jellyfinUserId: string | null = null;

        const jfAuth = await jellyfinAuthenticate(
          targetServer.url,
          voltixUser.jellyfinUsername,
          voltixUser.jellyfinPassword,
          deviceName
        );
        if (jfAuth) {
          jellyfinToken = jfAuth.token;
          jellyfinUserId = jfAuth.userId;
        }

        // ── 7. Create Voltix session ───────────────────────────────────────
        const token = nanoid(64);
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const userAgent = ctx.req.headers["user-agent"] ?? null;
        const ip =
          (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
          (ctx.req as unknown as { ip?: string }).ip ??
          null;

        await createSession({
          voltixUserId: voltixUser.id,
          token,
          deviceName,
          userAgent,
          ipAddress: ip,
          lastPingAt: new Date(),
          isValid: true,
          jellyfinToken: jellyfinToken ?? undefined,
          jellyfinUserId: jellyfinUserId ?? undefined,
          jellyfinServerId: targetServer.id,
          tokenRefreshedAt: jellyfinToken ? new Date() : undefined,
          expiresAt,
        });

        await logDevice({ voltixUserId: voltixUser.id, deviceName, userAgent, ipAddress: ip });

        ctx.res.cookie(VOLTIX_SESSION_COOKIE, token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          path: "/",
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        // ── 8. Return safe payload — NO Jellyfin credentials or raw URLs ───
        return {
          success: true,
          user: {
            id: voltixUser.id,
            username: voltixUser.username,
            displayName: voltixUser.displayName,
            email: voltixUser.email,
            isActive: voltixUser.isActive,
            maxConcurrentDevices: voltixUser.maxConcurrentDevices,
          },
          // The server the user authenticated against
          activeServer: {
            id: targetServer.id,
            name: targetServer.name,
            proxyUrl: `/api/jellyfin/${targetServer.id}`,
          },
          // Full server list with proxy URLs for the dashboard
          servers: servers.map((s) => ({
            id: s.id,
            name: s.name,
            proxyUrl: `/api/jellyfin/${s.id}`,
          })),
          jellyfinReady: !!jellyfinToken,
        };
      }),

    /** Restore session on page load */
    session: publicProcedure.query(async ({ ctx }) => {
      const session = await getVoltixSession(ctx.req as { cookies?: Record<string, string> });
      if (!session) return null;
      const voltixUser = await getVoltixUserById(session.voltixUserId);
      if (!voltixUser) return null;
      const servers = await listServers();
      const activeCount = await countActiveSessionsByUser(voltixUser.id);
      const activeServer = servers.find((s) => s.id === session.jellyfinServerId) ?? servers[0];
      return {
        sessionToken: session.token,
        user: {
          id: voltixUser.id,
          username: voltixUser.username,
          displayName: voltixUser.displayName,
          email: voltixUser.email,
          isActive: voltixUser.isActive,
          maxConcurrentDevices: voltixUser.maxConcurrentDevices,
          activeDeviceCount: activeCount,
        },
        activeServer: activeServer
          ? { id: activeServer.id, name: activeServer.name, proxyUrl: `/api/jellyfin/${activeServer.id}` }
          : null,
        servers: servers.map((s) => ({
          id: s.id,
          name: s.name,
          proxyUrl: `/api/jellyfin/${s.id}`,
        })),
        deviceName: session.deviceName,
        createdAt: session.createdAt,
        jellyfinReady: !!session.jellyfinToken,
      };
    }),

    /**
     * Switch to a different server after login.
     * Performs Jellyfin auth against the new server server-side.
     * Updates the session's stored token and serverId.
     */
    connectServer: publicProcedure
      .input(z.object({ serverId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const sessionToken = (ctx.req as { cookies?: Record<string, string> }).cookies?.[VOLTIX_SESSION_COOKIE];
        if (!sessionToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });

        const session = await getSessionByToken(sessionToken);
        if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid session" });

        const voltixUser = await getVoltixUserById(session.voltixUserId);
        if (!voltixUser || !voltixUser.isActive)
          throw new TRPCError({ code: "FORBIDDEN", message: "Subscription inactive" });

        const servers = await listServers();
        const server = servers.find((s) => s.id === input.serverId);
        if (!server) throw new TRPCError({ code: "NOT_FOUND", message: "Server not found" });

        const jfAuth = await jellyfinAuthenticate(
          server.url,
          voltixUser.jellyfinUsername,
          voltixUser.jellyfinPassword,
          session.deviceName ?? "Voltix Web"
        );

        if (!jfAuth) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Could not connect to streaming server. Please try again.",
          });
        }

        await updateSessionJellyfinToken(sessionToken, jfAuth.token, jfAuth.userId, server.id);

        return {
          success: true,
          proxyUrl: `/api/jellyfin/${server.id}`,
          serverName: server.name,
          serverId: server.id,
        };
      }),

    /** Logout */
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const token = (ctx.req as { cookies?: Record<string, string> }).cookies?.[VOLTIX_SESSION_COOKIE];
      if (token) await invalidateSession(token);
      ctx.res.clearCookie(VOLTIX_SESSION_COOKIE, {
        httpOnly: true, secure: true, sameSite: "none", path: "/", maxAge: -1,
      });
      return { success: true };
    }),

    /**
     * Subscription ping — every 5 minutes.
     * 1. Checks Voltix Web DB for isActive.
     * 2. Refreshes Jellyfin token if > 6 hours old (against the session's current server).
     * 3. Returns { active: boolean }.
     */
    ping: publicProcedure.mutation(async ({ ctx }) => {
      const token = (ctx.req as { cookies?: Record<string, string> }).cookies?.[VOLTIX_SESSION_COOKIE];
      if (!token) return { active: false, reason: "no_session" };

      const session = await getSessionByToken(token);
      if (!session) return { active: false, reason: "invalid_session" };

      const voltixUser = await getVoltixUserById(session.voltixUserId);
      if (!voltixUser) return { active: false, reason: "user_not_found" };

      if (!voltixUser.isActive) {
        await invalidateSession(token);
        ctx.res.clearCookie(VOLTIX_SESSION_COOKIE, {
          httpOnly: true, secure: true, sameSite: "none", path: "/", maxAge: -1,
        });
        return { active: false, reason: "subscription_inactive" };
      }

      // Token refresh against the session's current server
      const refreshedAt = session.tokenRefreshedAt ?? session.createdAt;
      const tokenAge = Date.now() - new Date(refreshedAt).getTime();

      if (session.jellyfinToken && session.jellyfinServerId && tokenAge > TOKEN_REFRESH_INTERVAL_MS) {
        try {
          const servers = await listServers();
          const server = servers.find((s) => s.id === session.jellyfinServerId);
          if (server) {
            const jfAuth = await jellyfinAuthenticate(
              server.url,
              voltixUser.jellyfinUsername,
              voltixUser.jellyfinPassword,
              session.deviceName ?? "Voltix Web"
            );
            if (jfAuth) {
              await updateSessionTokenRefresh(token, jfAuth.token, jfAuth.userId);
            }
          }
        } catch {
          console.warn("[Voltix] Token refresh failed during ping");
        }
      }

      await updateSessionPing(token);
      return { active: true, reason: "ok" };
    }),

    /**
     * Pre-login server list — returns all servers with icons and proxy URLs.
     * Called on the server-selection screen BEFORE the user logs in.
     */
    servers: publicProcedure.query(async () => {
      await seedServersIfEmpty();
      const servers = await listServers();
      return servers.map((s) => ({
        id: s.id,
        name: s.name,
        sortOrder: s.sortOrder,
        isActive: s.isActive,
        /** Proxy URL — raw Lumistream URL is never exposed */
        proxyUrl: `/api/jellyfin/${s.id}`,
        /** Icon key for the client to render the correct server icon */
        iconKey: deriveIconKey(s.name),
        /** Short label shown under the icon */
        shortLabel: deriveShortLabel(s.name),
        /** Badge text */
        badge: deriveBadge(s.name),
      }));
    }),

    /** Current user's active sessions and device history */
    myDevices: publicProcedure.query(async ({ ctx }) => {
      const session = await getVoltixSession(ctx.req as { cookies?: Record<string, string> });
      if (!session) return { sessions: [], deviceLogs: [], activeCount: 0, maxDevices: 1 };
      const voltixUser = await getVoltixUserById(session.voltixUserId);
      const [sessions, logs] = await Promise.all([
        getActiveSessionsByUser(session.voltixUserId),
        getDeviceLogsByUser(session.voltixUserId),
      ]);
      return {
        sessions: sessions.map((s) => ({
          id: s.id,
          deviceName: s.deviceName,
          ipAddress: s.ipAddress,
          lastPingAt: s.lastPingAt,
          createdAt: s.createdAt,
          jellyfinReady: !!s.jellyfinToken,
          tokenRefreshedAt: s.tokenRefreshedAt,
          jellyfinServerId: s.jellyfinServerId,
        })),
        deviceLogs: logs,
        activeCount: sessions.length,
        maxDevices: voltixUser?.maxConcurrentDevices ?? 1,
      };
    }),
  }),

  // ─── Admin panel ────────────────────────────────────────────────────────
  admin: router({
    listUsers: adminProcedure.query(async () => {
      const allUsers = await listAllVoltixUsers();
      return allUsers.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        email: u.email,
        isActive: u.isActive,
        maxConcurrentDevices: u.maxConcurrentDevices,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      }));
    }),

    toggleUserActive: adminProcedure
      .input(z.object({ userId: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        await updateVoltixUserActive(input.userId, input.isActive);
        if (!input.isActive) await invalidateAllUserSessions(input.userId);
        return { success: true };
      }),

    updateUser: adminProcedure
      .input(
        z.object({
          userId: z.number(),
          displayName: z.string().optional(),
          email: z.string().email().optional().or(z.literal("")),
          newPassword: z.string().min(6).optional(),
          jellyfinUsername: z.string().min(1).optional(),
          jellyfinPassword: z.string().min(1).optional(),
          maxConcurrentDevices: z.number().int().min(1).max(10).optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const updates: Parameters<typeof updateVoltixUser>[1] = {};
        if (input.displayName !== undefined) updates.displayName = input.displayName || null;
        if (input.email !== undefined) updates.email = input.email || null;
        if (input.newPassword) updates.passwordHash = await bcrypt.hash(input.newPassword, 12);
        if (input.jellyfinUsername) updates.jellyfinUsername = input.jellyfinUsername;
        if (input.jellyfinPassword) updates.jellyfinPassword = input.jellyfinPassword;
        if (input.maxConcurrentDevices !== undefined) updates.maxConcurrentDevices = input.maxConcurrentDevices;
        if (input.isActive !== undefined) {
          updates.isActive = input.isActive;
          if (!input.isActive) await invalidateAllUserSessions(input.userId);
        }
        await updateVoltixUser(input.userId, updates);
        return { success: true };
      }),

    createUser: adminProcedure
      .input(
        z.object({
          username: z.string().min(3).max(128),
          password: z.string().min(6),
          displayName: z.string().optional(),
          email: z.string().email().optional(),
          jellyfinUsername: z.string().min(1),
          jellyfinPassword: z.string().min(1),
          maxConcurrentDevices: z.number().int().min(1).max(10).default(1),
        })
      )
      .mutation(async ({ input }) => {
        const existing = await getVoltixUserByUsername(input.username);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "Username already exists" });
        const passwordHash = await bcrypt.hash(input.password, 12);
        await createVoltixUser({
          username: input.username,
          passwordHash,
          displayName: input.displayName ?? input.username,
          email: input.email ?? null,
          isActive: true,
          jellyfinUsername: input.jellyfinUsername,
          jellyfinPassword: input.jellyfinPassword,
          maxConcurrentDevices: input.maxConcurrentDevices,
        });
        return { success: true };
      }),

    allSessions: adminProcedure.query(async () => {
      const sessions = await getAllActiveSessions();
      return sessions.map((s) => ({
        id: s.id,
        voltixUserId: s.voltixUserId,
        deviceName: s.deviceName,
        ipAddress: s.ipAddress,
        lastPingAt: s.lastPingAt,
        createdAt: s.createdAt,
        jellyfinReady: !!s.jellyfinToken,
        jellyfinServerId: s.jellyfinServerId,
        tokenRefreshedAt: s.tokenRefreshedAt,
      }));
    }),

    forceLogoutUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        await invalidateAllUserSessions(input.userId);
        return { success: true };
      }),

    userDevices: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => getDeviceLogsByUser(input.userId)),
  }),

  // ─── Scheduled task subscription check ──────────────────────────────────
  scheduled: router({
    subscriptionCheck: publicProcedure
      .input(z.object({ username: z.string() }))
      .mutation(async ({ input }) => {
        const voltixUser = await getVoltixUserByUsername(input.username);
        if (!voltixUser) return { active: false, reason: "user_not_found" };
        return {
          active: voltixUser.isActive,
          reason: voltixUser.isActive ? "ok" : "subscription_inactive",
        };
      }),
  }),
});

// ─── Server metadata helpers ──────────────────────────────────────────────────

function deriveIconKey(name: string): "main" | "extra" | "4k" {
  if (name.includes("4K") || name.includes("4k")) return "4k";
  if (name.includes("Extra") || name.includes("Shared")) return "extra";
  return "main";
}

function deriveShortLabel(name: string): string {
  if (name.includes("Main")) return "Voltix - Main";
  if (name.includes("Extra")) return "Voltix - Extra";
  if (name.includes("4K") || name.includes("4k")) return "Voltix - 4K";
  return name;
}

function deriveBadge(name: string): string | null {
  if (name.includes("Main")) return "Primary Server";
  if (name.includes("4K") || name.includes("4k")) return "4K Server (Shared)";
  if (name.includes("Extra")) return "Extra Server (Shared)";
  return null;
}

export type AppRouter = typeof appRouter;
