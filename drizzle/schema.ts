import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Core Manus auth user (do not remove) ────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Voltix subscriber accounts ──────────────────────────────────────────────
// These are the credentials users actually type in. They never see jellyfinUsername/Password.
export const voltixUsers = mysqlTable("voltix_users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 128 }).notNull().unique(),
  /** bcrypt hash of the user's Voltix password */
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  displayName: text("displayName"),
  email: varchar("email", { length: 320 }),
  /** Whether the subscription is currently active */
  isActive: boolean("isActive").default(true).notNull(),
  /** Hidden Jellyfin username – users never see this */
  jellyfinUsername: varchar("jellyfinUsername", { length: 255 }).notNull(),
  /** Hidden Jellyfin password – users never see this */
  jellyfinPassword: varchar("jellyfinPassword", { length: 255 }).notNull(),
  /** Which server this account primarily uses (optional convenience field) */
  primaryServerId: int("primaryServerId"),
  /** Maximum number of concurrent active sessions allowed for this user */
  maxConcurrentDevices: int("maxConcurrentDevices").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VoltixUser = typeof voltixUsers.$inferSelect;
export type InsertVoltixUser = typeof voltixUsers.$inferInsert;

// ─── Pre-configured Jellyfin servers ─────────────────────────────────────────
export const servers = mysqlTable("servers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  url: varchar("url", { length: 512 }).notNull(),
  /** Display order */
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Server = typeof servers.$inferSelect;
export type InsertServer = typeof servers.$inferInsert;

// ─── User sessions ────────────────────────────────────────────────────────────
export const voltixSessions = mysqlTable("voltix_sessions", {
  id: int("id").autoincrement().primaryKey(),
  voltixUserId: int("voltixUserId").notNull(),
  /** Opaque session token stored in a cookie */
  token: varchar("token", { length: 255 }).notNull().unique(),
  /** Human-readable device/browser name logged at login */
  deviceName: text("deviceName"),
  /** User-agent string for reference */
  userAgent: text("userAgent"),
  /** IP address at login time */
  ipAddress: varchar("ipAddress", { length: 64 }),
  /** Last time the subscription ping was received */
  lastPingAt: timestamp("lastPingAt").defaultNow().notNull(),
  /** Whether this session is still valid */
  isValid: boolean("isValid").default(true).notNull(),
  /** Jellyfin access token obtained server-side at login — never sent to client */
  jellyfinToken: varchar("jellyfinToken", { length: 512 }),
  /** Jellyfin user ID returned by the server at auth time */
  jellyfinUserId: varchar("jellyfinUserId", { length: 128 }),
  /** Which server this session authenticated against (FK to servers.id) */
  jellyfinServerId: int("jellyfinServerId"),
  /** When the Jellyfin token was last refreshed (used to schedule re-auth) */
  tokenRefreshedAt: timestamp("tokenRefreshedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});

export type VoltixSession = typeof voltixSessions.$inferSelect;
export type InsertVoltixSession = typeof voltixSessions.$inferInsert;

// ─── Device log (historical record of all devices ever used) ─────────────────
export const deviceLogs = mysqlTable("device_logs", {
  id: int("id").autoincrement().primaryKey(),
  voltixUserId: int("voltixUserId").notNull(),
  deviceName: text("deviceName"),
  userAgent: text("userAgent"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  loggedAt: timestamp("loggedAt").defaultNow().notNull(),
});

export type DeviceLog = typeof deviceLogs.$inferSelect;
