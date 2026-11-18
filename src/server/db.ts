import "@/server/guard";
import fs from "@/server/node-fs";
import path from "@/server/node-path";
import { createSeed } from "./seed";
import type {
  ActivityLog,
  Automation,
  Building,
  Device,
  DeviceState,
  Execution,
  Floor,
  IntegrationAccount,
  Invitation,
  Membership,
  Notification,
  Organization,
  Property,
  Room,
  Scene,
  User,
} from "@/lib/types";

/**
 * Development persistence layer.
 *
 * The production target is PostgreSQL via Prisma (see prisma/schema.prisma). For a zero-dependency
 * demo this module persists the same normalized, tenant-scoped tables to a JSON file under `.data/`.
 * Every service accesses data through `tenant(orgId)` helpers so swapping in Prisma only touches
 * this module and the repositories in ./repo.ts.
 */

export interface StoredUser extends User {
  passwordHash: string;
  salt: string;
}
export interface StoredSession {
  id: string; // sha256 of the token
  userId: string;
  activeOrgId: string | null;
  activePropertyId: string | null;
  createdAt: string;
  expiresAt: string;
  userAgent: string;
}
export interface StateHistory {
  id: string;
  orgId: string;
  deviceId: string;
  state: DeviceState;
  online: boolean;
  at: string;
}

export interface Database {
  version: number;
  users: StoredUser[];
  sessions: StoredSession[];
  orgs: Organization[];
  memberships: Membership[];
  invitations: Invitation[];
  properties: Property[];
  buildings: Building[];
  floors: Floor[];
  rooms: Room[];
  devices: Device[];
  stateHistory: StateHistory[];
  automations: Automation[];
  executions: Execution[];
  scenes: Scene[];
  notifications: Notification[];
  activity: ActivityLog[];
  integrations: IntegrationAccount[];
  meta: { schedulerLastTick: string | null; seededAt: string };
}

// process.cwd() is missing in the static demo build, where fs is backed by localStorage.
const DATA_DIR = path.join(typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : "/", ".data");
const DATA_FILE = path.join(DATA_DIR, "nexora.json");
const SCHEMA_VERSION = 1;

type G = typeof globalThis & { __nexoraDb?: Database; __nexoraSaveTimer?: NodeJS.Timeout | null };
const g = globalThis as G;

function load(): Database {
  if (g.__nexoraDb) return g.__nexoraDb;
  let db: Database | null = null;
  try {
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as Database;
      if (parsed.version === SCHEMA_VERSION) db = parsed;
    }
  } catch (err) {
    console.error("[nexora:db] failed to read data file, reseeding", err);
  }
  if (!db) {
    db = createSeed();
    g.__nexoraDb = db;
    flush();
  }
  g.__nexoraDb = db;
  return db;
}

export function db(): Database {
  return load();
}

/** Schedule an atomic write. Called by every mutation. */
export function persist() {
  if (g.__nexoraSaveTimer) return;
  g.__nexoraSaveTimer = setTimeout(() => {
    g.__nexoraSaveTimer = null;
    flush();
  }, 40);
}

function flush() {
  const data = g.__nexoraDb;
  if (!data) return;
  // Bound unbounded tables so the demo file stays small.
  // The static demo keeps the database in localStorage (~5 MB), so it keeps less history.
  const small = process.env.NEXT_PUBLIC_NEXORA_STATIC === "1";
  data.stateHistory = data.stateHistory.slice(small ? -1200 : -4000);
  data.activity = data.activity.slice(small ? -800 : -3000);
  data.executions = data.executions.slice(small ? -400 : -1500);
  data.notifications = data.notifications.slice(small ? -200 : -600);
  const now = Date.now();
  data.sessions = data.sessions.filter((s) => Date.parse(s.expiresAt) > now);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, DATA_FILE);
}

export function resetDatabase() {
  g.__nexoraDb = createSeed();
  flush();
}
