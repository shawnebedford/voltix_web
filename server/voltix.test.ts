import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock the DB layer ────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getVoltixUserByUsername: vi.fn(),
  getVoltixUserById: vi.fn(),
  createSession: vi.fn(),
  getSessionByToken: vi.fn(),
  updateSessionPing: vi.fn(),
  updateSessionJellyfinToken: vi.fn(),
  updateSessionTokenRefresh: vi.fn(),
  invalidateSession: vi.fn(),
  invalidateAllUserSessions: vi.fn(),
  logDevice: vi.fn(),
  seedServersIfEmpty: vi.fn(),
  listServers: vi.fn(),
  listAllVoltixUsers: vi.fn(),
  updateVoltixUserActive: vi.fn(),
  updateVoltixUser: vi.fn(),
  countActiveSessionsByUser: vi.fn(),
  getActiveSessionsByUser: vi.fn(),
  getAllActiveSessions: vi.fn(),
  getDeviceLogsByUser: vi.fn(),
  createVoltixUser: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

import * as db from "./db";
import bcrypt from "bcryptjs";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeCtx(cookies: Record<string, string> = {}): TrpcContext {
  const clearedCookies: string[] = [];
  const setCookies: Array<{ name: string; value: string }> = [];
  return {
    user: null,
    req: {
      protocol: "https",
      headers: { "user-agent": "TestAgent/1.0" },
      cookies,
    } as unknown as TrpcContext["req"],
    res: {
      clearCookie: (name: string) => clearedCookies.push(name),
      cookie: (name: string, value: string) => setCookies.push({ name, value }),
      _clearedCookies: clearedCookies,
      _setCookies: setCookies,
    } as unknown as TrpcContext["res"],
  };
}

function makeUser(overrides: Partial<{
  id: number; username: string; isActive: boolean;
  maxConcurrentDevices: number; jellyfinUsername: string; jellyfinPassword: string;
  passwordHash: string;
}> = {}) {
  return {
    id: overrides.id ?? 1,
    username: overrides.username ?? "testuser",
    passwordHash: overrides.passwordHash ?? "$2a$10$placeholder",
    isActive: overrides.isActive ?? true,
    jellyfinUsername: overrides.jellyfinUsername ?? "jf_test",
    jellyfinPassword: overrides.jellyfinPassword ?? "jf_pass",
    maxConcurrentDevices: overrides.maxConcurrentDevices ?? 1,
    displayName: "Test User",
    email: null,
    primaryServerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeSession(overrides: Partial<{
  voltixUserId: number; token: string;
  jellyfinToken: string | null; tokenRefreshedAt: Date | null;
  jellyfinServerId: number | null;
}> = {}) {
  return {
    id: 1,
    voltixUserId: overrides.voltixUserId ?? 1,
    token: overrides.token ?? "sess_token",
    deviceName: "Test TV",
    userAgent: null,
    ipAddress: null,
    lastPingAt: new Date(),
    isValid: true,
    jellyfinToken: overrides.jellyfinToken ?? "jf_tok",
    jellyfinUserId: "jf_uid",
    jellyfinServerId: overrides.jellyfinServerId ?? 1,
    tokenRefreshedAt: overrides.tokenRefreshedAt ?? new Date(),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000),
  };
}

const MOCK_SERVERS = [
  { id: 1, name: "Voltix Studios - Main Server", url: "https://main.lumistream.cc", sortOrder: 1, isActive: true, createdAt: new Date() },
  { id: 2, name: "Voltix Studios - Extra Server (Shared)", url: "https://extra.lumistream.cc", sortOrder: 2, isActive: true, createdAt: new Date() },
  { id: 3, name: "Voltix Studios - 4K Server (Shared)", url: "https://4k.lumistream.cc", sortOrder: 3, isActive: true, createdAt: new Date() },
];

// ─── voltix.login ─────────────────────────────────────────────────────────────
describe("voltix.login", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unknown username", async () => {
    vi.mocked(db.getVoltixUserByUsername).mockResolvedValue(undefined);
    await expect(appRouter.createCaller(makeCtx()).voltix.login({ username: "ghost", password: "pass" }))
      .rejects.toThrow("Invalid credentials");
  });

  it("rejects wrong password", async () => {
    const hash = await bcrypt.hash("correct", 10);
    vi.mocked(db.getVoltixUserByUsername).mockResolvedValue(makeUser({ passwordHash: hash }));
    await expect(appRouter.createCaller(makeCtx()).voltix.login({ username: "testuser", password: "wrong" }))
      .rejects.toThrow("Invalid credentials");
  });

  it("blocks inactive subscription", async () => {
    const hash = await bcrypt.hash("pass", 10);
    vi.mocked(db.getVoltixUserByUsername).mockResolvedValue(makeUser({ isActive: false, passwordHash: hash }));
    await expect(appRouter.createCaller(makeCtx()).voltix.login({ username: "testuser", password: "pass" }))
      .rejects.toThrow("subscription is inactive");
  });

  it("enforces maxConcurrentDevices — rejects when limit reached", async () => {
    const hash = await bcrypt.hash("pass", 10);
    vi.mocked(db.getVoltixUserByUsername).mockResolvedValue(makeUser({ passwordHash: hash, maxConcurrentDevices: 1 }));
    vi.mocked(db.countActiveSessionsByUser).mockResolvedValue(1); // already at limit
    await expect(appRouter.createCaller(makeCtx()).voltix.login({ username: "testuser", password: "pass" }))
      .rejects.toThrow("Device limit reached");
  });

  it("allows login when under device limit", async () => {
    const hash = await bcrypt.hash("pass", 10);
    vi.mocked(db.getVoltixUserByUsername).mockResolvedValue(makeUser({ passwordHash: hash, maxConcurrentDevices: 2 }));
    vi.mocked(db.countActiveSessionsByUser).mockResolvedValue(1); // 1 of 2 used
    vi.mocked(db.seedServersIfEmpty).mockResolvedValue(undefined);
    vi.mocked(db.listServers).mockResolvedValue(MOCK_SERVERS);
    vi.mocked(db.createSession).mockResolvedValue(undefined);
    vi.mocked(db.logDevice).mockResolvedValue(undefined);
    const result = await appRouter.createCaller(makeCtx()).voltix.login({ username: "testuser", password: "pass" });
    expect(result.success).toBe(true);
  });

  it("returns proxy URLs only — never raw Jellyfin credentials or Lumistream URLs", async () => {
    const hash = await bcrypt.hash("secret", 10);
    vi.mocked(db.getVoltixUserByUsername).mockResolvedValue(makeUser({ passwordHash: hash, jellyfinUsername: "jf_carol", jellyfinPassword: "jf_pass_carol" }));
    vi.mocked(db.countActiveSessionsByUser).mockResolvedValue(0);
    vi.mocked(db.seedServersIfEmpty).mockResolvedValue(undefined);
    vi.mocked(db.listServers).mockResolvedValue(MOCK_SERVERS);
    vi.mocked(db.createSession).mockResolvedValue(undefined);
    vi.mocked(db.logDevice).mockResolvedValue(undefined);
    const result = await appRouter.createCaller(makeCtx()).voltix.login({ username: "testuser", password: "secret" });
    expect(result.servers).toHaveLength(3);
    for (const s of result.servers) {
      expect(s.proxyUrl).toMatch(/^\/api\/jellyfin\/\d+$/);
      expect((s as Record<string, unknown>)["url"]).toBeUndefined();
    }
    expect((result as Record<string, unknown>)["jellyfinCredentials"]).toBeUndefined();
    expect((result.user as Record<string, unknown>)["jellyfinUsername"]).toBeUndefined();
    expect((result.user as Record<string, unknown>)["jellyfinPassword"]).toBeUndefined();
  });

  it("device name stored in session but never returned to client", async () => {
    const hash = await bcrypt.hash("pass", 10);
    vi.mocked(db.getVoltixUserByUsername).mockResolvedValue(makeUser({ passwordHash: hash }));
    vi.mocked(db.countActiveSessionsByUser).mockResolvedValue(0);
    vi.mocked(db.seedServersIfEmpty).mockResolvedValue(undefined);
    vi.mocked(db.listServers).mockResolvedValue(MOCK_SERVERS);
    vi.mocked(db.createSession).mockResolvedValue(undefined);
    vi.mocked(db.logDevice).mockResolvedValue(undefined);
    const result = await appRouter.createCaller(makeCtx()).voltix.login({ username: "testuser", password: "pass", deviceName: "Samsung Galaxy S24" });
    expect(db.createSession).toHaveBeenCalledWith(expect.objectContaining({ deviceName: "Samsung Galaxy S24" }));
    expect((result as Record<string, unknown>)["deviceName"]).toBeUndefined();
  });
});

// ─── voltix.ping ──────────────────────────────────────────────────────────────
describe("voltix.ping", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns active:false with no session cookie", async () => {
    const result = await appRouter.createCaller(makeCtx()).voltix.ping();
    expect(result).toMatchObject({ active: false, reason: "no_session" });
  });

  it("returns active:false for invalid token", async () => {
    vi.mocked(db.getSessionByToken).mockResolvedValue(undefined);
    const result = await appRouter.createCaller(makeCtx({ voltix_session: "bad" })).voltix.ping();
    expect(result).toMatchObject({ active: false, reason: "invalid_session" });
  });

  it("invalidates session and returns inactive when subscription is off", async () => {
    vi.mocked(db.getSessionByToken).mockResolvedValue(makeSession());
    vi.mocked(db.getVoltixUserById).mockResolvedValue(makeUser({ isActive: false }));
    vi.mocked(db.invalidateSession).mockResolvedValue(undefined);
    const result = await appRouter.createCaller(makeCtx({ voltix_session: "sess_token" })).voltix.ping();
    expect(result).toMatchObject({ active: false, reason: "subscription_inactive" });
    expect(db.invalidateSession).toHaveBeenCalledWith("sess_token");
  });

  it("refreshes Jellyfin token when token is stale (> 6h)", async () => {
    const staleDate = new Date(Date.now() - 7 * 60 * 60 * 1000); // 7 hours ago
    vi.mocked(db.getSessionByToken).mockResolvedValue(makeSession({ tokenRefreshedAt: staleDate }));
    vi.mocked(db.getVoltixUserById).mockResolvedValue(makeUser({ isActive: true }));
    vi.mocked(db.listServers).mockResolvedValue(MOCK_SERVERS);
    vi.mocked(db.updateSessionTokenRefresh).mockResolvedValue(undefined);
    vi.mocked(db.updateSessionPing).mockResolvedValue(undefined);

    // Mock fetch for Jellyfin re-auth
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ AccessToken: "new_jf_token", User: { Id: "new_jf_uid" } }),
    } as Response);

    const result = await appRouter.createCaller(makeCtx({ voltix_session: "sess_token" })).voltix.ping();
    expect(result).toMatchObject({ active: true, reason: "ok" });
    expect(db.updateSessionTokenRefresh).toHaveBeenCalledWith("sess_token", "new_jf_token", "new_jf_uid");
  });

  it("does NOT refresh token when it is fresh (< 6h)", async () => {
    vi.mocked(db.getSessionByToken).mockResolvedValue(makeSession({ tokenRefreshedAt: new Date() }));
    vi.mocked(db.getVoltixUserById).mockResolvedValue(makeUser({ isActive: true }));
    vi.mocked(db.updateSessionPing).mockResolvedValue(undefined);
    const result = await appRouter.createCaller(makeCtx({ voltix_session: "sess_token" })).voltix.ping();
    expect(result).toMatchObject({ active: true, reason: "ok" });
    expect(db.updateSessionTokenRefresh).not.toHaveBeenCalled();
  });
});

// ─── admin.toggleUserActive ───────────────────────────────────────────────────
describe("admin.toggleUserActive", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deactivates user and invalidates all sessions", async () => {
    vi.mocked(db.updateVoltixUserActive).mockResolvedValue(undefined);
    vi.mocked(db.invalidateAllUserSessions).mockResolvedValue(undefined);
    const ctx = makeCtx();
    ctx.user = { id: 99, openId: "admin", name: "Admin", email: "a@v.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
    const result = await appRouter.createCaller(ctx).admin.toggleUserActive({ userId: 5, isActive: false });
    expect(result.success).toBe(true);
    expect(db.updateVoltixUserActive).toHaveBeenCalledWith(5, false);
    expect(db.invalidateAllUserSessions).toHaveBeenCalledWith(5);
  });
});

// ─── admin.updateUser ─────────────────────────────────────────────────────────
describe("admin.updateUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates display name and max devices", async () => {
    vi.mocked(db.updateVoltixUser).mockResolvedValue(undefined);
    const ctx = makeCtx();
    ctx.user = { id: 99, openId: "admin", name: "Admin", email: "a@v.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
    const result = await appRouter.createCaller(ctx).admin.updateUser({ userId: 3, displayName: "New Name", maxConcurrentDevices: 3 });
    expect(result.success).toBe(true);
    expect(db.updateVoltixUser).toHaveBeenCalledWith(3, expect.objectContaining({ displayName: "New Name", maxConcurrentDevices: 3 }));
  });

  it("hashes new password before storing", async () => {
    vi.mocked(db.updateVoltixUser).mockResolvedValue(undefined);
    const ctx = makeCtx();
    ctx.user = { id: 99, openId: "admin", name: "Admin", email: "a@v.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
    await appRouter.createCaller(ctx).admin.updateUser({ userId: 3, newPassword: "newpassword123" });
    const call = vi.mocked(db.updateVoltixUser).mock.calls[0];
    const updates = call?.[1] as Record<string, unknown>;
    expect(typeof updates["passwordHash"]).toBe("string");
    expect(updates["passwordHash"]).not.toBe("newpassword123");
    const valid = await bcrypt.compare("newpassword123", updates["passwordHash"] as string);
    expect(valid).toBe(true);
  });

  it("invalidates all sessions when deactivating via updateUser", async () => {
    vi.mocked(db.updateVoltixUser).mockResolvedValue(undefined);
    vi.mocked(db.invalidateAllUserSessions).mockResolvedValue(undefined);
    const ctx = makeCtx();
    ctx.user = { id: 99, openId: "admin", name: "Admin", email: "a@v.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
    await appRouter.createCaller(ctx).admin.updateUser({ userId: 3, isActive: false });
    expect(db.invalidateAllUserSessions).toHaveBeenCalledWith(3);
  });
});

// ─── voltix.servers ───────────────────────────────────────────────────────────
describe("voltix.servers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns proxy URLs only — never raw Lumistream URLs", async () => {
    vi.mocked(db.seedServersIfEmpty).mockResolvedValue(undefined);
    vi.mocked(db.listServers).mockResolvedValue(MOCK_SERVERS);
    const servers = await appRouter.createCaller(makeCtx()).voltix.servers();
    expect(servers).toHaveLength(3);
    for (const s of servers) {
      expect(s.proxyUrl).toMatch(/^\/api\/jellyfin\/\d+$/);
      expect((s as Record<string, unknown>)["url"]).toBeUndefined();
    }
    expect(servers[0].name).toBe("Voltix Studios - Main Server");
    expect(servers[1].name).toBe("Voltix Studios - Extra Server (Shared)");
    expect(servers[2].name).toBe("Voltix Studios - 4K Server (Shared)");
  });
});
