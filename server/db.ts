import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  DeviceLog,
  InsertUser,
  InsertVoltixSession,
  InsertVoltixUser,
  Server,
  VoltixSession,
  VoltixUser,
  deviceLogs,
  servers,
  users,
  voltixSessions,
  voltixUsers,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Core Manus user helpers ──────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Voltix user helpers ──────────────────────────────────────────────────────

export async function getVoltixUserByUsername(username: string): Promise<VoltixUser | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(voltixUsers)
    .where(eq(voltixUsers.username, username))
    .limit(1);
  return result[0];
}

export async function getVoltixUserById(id: number): Promise<VoltixUser | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(voltixUsers).where(eq(voltixUsers.id, id)).limit(1);
  return result[0];
}

export async function createVoltixUser(data: InsertVoltixUser): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(voltixUsers).values(data);
}

export async function countActiveSessionsByUser(voltixUserId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select()
    .from(voltixSessions)
    .where(and(eq(voltixSessions.voltixUserId, voltixUserId), eq(voltixSessions.isValid, true)));
  return result.length;
}

export async function updateVoltixUser(
  id: number,
  data: Partial<{
    displayName: string | null;
    email: string | null;
    passwordHash: string;
    jellyfinUsername: string;
    jellyfinPassword: string;
    maxConcurrentDevices: number;
    isActive: boolean;
  }>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(voltixUsers).set(data).where(eq(voltixUsers.id, id));
}

export async function updateSessionTokenRefresh(
  token: string,
  jellyfinToken: string,
  jellyfinUserId: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(voltixSessions)
    .set({ jellyfinToken, jellyfinUserId, tokenRefreshedAt: new Date() })
    .where(eq(voltixSessions.token, token));
}

export async function updateVoltixUserActive(id: number, isActive: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(voltixUsers).set({ isActive }).where(eq(voltixUsers.id, id));
}

export async function listAllVoltixUsers(): Promise<VoltixUser[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(voltixUsers).orderBy(desc(voltixUsers.createdAt));
}

// ─── Session helpers ──────────────────────────────────────────────────────────

export async function createSession(data: InsertVoltixSession): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(voltixSessions).values(data);
}

export async function getSessionByToken(token: string): Promise<VoltixSession | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(voltixSessions)
    .where(and(eq(voltixSessions.token, token), eq(voltixSessions.isValid, true)))
    .limit(1);
  return result[0];
}

export async function updateSessionJellyfinToken(
  token: string,
  jellyfinToken: string,
  jellyfinUserId: string,
  jellyfinServerId: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(voltixSessions)
    .set({ jellyfinToken, jellyfinUserId, jellyfinServerId })
    .where(eq(voltixSessions.token, token));
}

export async function updateSessionPing(token: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(voltixSessions)
    .set({ lastPingAt: new Date() })
    .where(eq(voltixSessions.token, token));
}

export async function invalidateSession(token: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(voltixSessions)
    .set({ isValid: false })
    .where(eq(voltixSessions.token, token));
}

export async function invalidateAllUserSessions(voltixUserId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(voltixSessions)
    .set({ isValid: false })
    .where(eq(voltixSessions.voltixUserId, voltixUserId));
}

export async function getActiveSessionsByUser(voltixUserId: number): Promise<VoltixSession[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(voltixSessions)
    .where(
      and(eq(voltixSessions.voltixUserId, voltixUserId), eq(voltixSessions.isValid, true))
    )
    .orderBy(desc(voltixSessions.createdAt));
}

export async function getAllActiveSessions(): Promise<VoltixSession[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(voltixSessions)
    .where(eq(voltixSessions.isValid, true))
    .orderBy(desc(voltixSessions.lastPingAt));
}

// ─── Device log helpers ───────────────────────────────────────────────────────

export async function logDevice(data: Omit<DeviceLog, "id" | "loggedAt">): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(deviceLogs).values({ ...data, loggedAt: new Date() });
}

export async function getDeviceLogsByUser(voltixUserId: number): Promise<DeviceLog[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(deviceLogs)
    .where(eq(deviceLogs.voltixUserId, voltixUserId))
    .orderBy(desc(deviceLogs.loggedAt))
    .limit(50);
}

// ─── Server helpers ───────────────────────────────────────────────────────────

export async function listServers(): Promise<Server[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(servers)
    .where(eq(servers.isActive, true))
    .orderBy(servers.sortOrder);
}

export async function seedServersIfEmpty(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(servers).limit(1);
  if (existing.length > 0) return;

  await db.insert(servers).values([
    {
      name: "Voltix Studios - Main Server",
      url: "https://main.lumistream.cc",
      sortOrder: 1,
      isActive: true,
    },
    {
      name: "Voltix Studios - Extra Server (Shared)",
      url: "https://extra.lumistream.cc",
      sortOrder: 2,
      isActive: true,
    },
    {
      name: "Voltix Studios - 4K Server (Shared)",
      url: "https://4k.lumistream.cc",
      sortOrder: 3,
      isActive: true,
    },
  ]);
  console.log("[DB] Seeded pre-configured Voltix servers.");
}
