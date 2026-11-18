import "server-only";
import { cookies, headers } from "next/headers";
import { db, persist, type StoredSession, type StoredUser } from "./db";
import { id, nowIso, randomToken, sha256 } from "./util";
import { permissionsFor } from "@/lib/rbac";
import type { Membership, Permission, RoleKey, SessionInfo, User } from "@/lib/types";

export const SESSION_COOKIE = "nx_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export function publicUser(u: StoredUser): User {
  const { passwordHash: _p, salt: _s, ...rest } = u;
  return rest;
}

export async function createSession(user: StoredUser) {
  const token = randomToken();
  const d = db();
  const firstMembership = d.memberships.find((m) => m.userId === user.id);
  const ua = (await headers()).get("user-agent") ?? "unknown";
  const s: StoredSession = {
    id: sha256(token),
    userId: user.id,
    activeOrgId: firstMembership?.orgId ?? null,
    activePropertyId: null,
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    userAgent: ua.slice(0, 160),
  };
  d.sessions.push(s);
  persist();
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return s;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const d = db();
    d.sessions = d.sessions.filter((s) => s.id !== sha256(token));
    persist();
  }
  jar.delete(SESSION_COOKIE);
}

export async function readSession(): Promise<{ session: StoredSession; user: StoredUser } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const d = db();
  const session = d.sessions.find((s) => s.id === sha256(token));
  if (!session || Date.parse(session.expiresAt) < Date.now()) return null;
  const user = d.users.find((u) => u.id === session.userId);
  if (!user) return null;
  return { session, user };
}

/** The authenticated, tenant-scoped request context every service receives. */
export interface Ctx {
  user: StoredUser;
  session: StoredSession;
  orgId: string;
  membership: Membership;
  role: RoleKey;
  permissions: Permission[];
  can: (p: Permission) => boolean;
  /** throws 403 when the member has no access to the property */
  assertProperty: (propertyId: string) => void;
  canAccessProperty: (propertyId: string) => boolean;
  /** the property the session is focused on (validated) */
  propertyId: string | null;
}

export async function requireCtx(permission?: Permission): Promise<Ctx> {
  const auth = await readSession();
  if (!auth) throw new ApiError(401, "Please sign in to continue.");
  const { session, user } = auth;
  const d = db();
  const membership = d.memberships.find((m) => m.userId === user.id && m.orgId === session.activeOrgId);
  if (!membership) throw new ApiError(409, "Create or join an organization first.", "NO_ORG");
  const permissions = permissionsFor(membership.role);
  const canAccessProperty = (pid: string) => {
    const p = d.properties.find((x) => x.id === pid);
    if (!p || p.orgId !== membership.orgId) return false;
    return membership.propertyIds === null || membership.propertyIds.includes(pid);
  };
  const accessible = d.properties.filter((p) => p.orgId === membership.orgId && canAccessProperty(p.id));
  let propertyId = session.activePropertyId && canAccessProperty(session.activePropertyId) ? session.activePropertyId : accessible[0]?.id ?? null;
  if (propertyId !== session.activePropertyId) {
    session.activePropertyId = propertyId;
    persist();
  }
  const ctx: Ctx = {
    user,
    session,
    orgId: membership.orgId,
    membership,
    role: membership.role,
    permissions,
    can: (p) => permissions.includes(p),
    canAccessProperty,
    assertProperty: (pid) => {
      if (!canAccessProperty(pid)) throw new ApiError(403, "You don't have access to this property.");
    },
    propertyId,
  };
  if (permission && !ctx.can(permission)) throw new ApiError(403, "Your role doesn't allow this action.");
  return ctx;
}

export async function sessionInfo(): Promise<SessionInfo | null> {
  const auth = await readSession();
  if (!auth) return null;
  const d = db();
  const memberships = d.memberships
    .filter((m) => m.userId === auth.user.id)
    .map((m) => ({ ...m, org: d.orgs.find((o) => o.id === m.orgId)! }))
    .filter((m) => m.org);
  const active = memberships.find((m) => m.orgId === auth.session.activeOrgId) ?? null;
  return {
    user: publicUser(auth.user),
    memberships,
    activeOrgId: active?.orgId ?? null,
    role: active?.role ?? null,
    permissions: active ? permissionsFor(active.role) : [],
  };
}

export function newMembershipId() {
  return id("mem_");
}

// ─── Rate limiting (in-memory token bucket; use Redis in production) ──
const buckets = new Map<string, { tokens: number; at: number }>();
export function rateLimit(key: string, perMinute: number) {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: perMinute, at: now };
  b.tokens = Math.min(perMinute, b.tokens + ((now - b.at) / 60_000) * perMinute);
  b.at = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    throw new ApiError(429, "Too many requests — slow down and try again in a moment.");
  }
  b.tokens -= 1;
  buckets.set(key, b);
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
