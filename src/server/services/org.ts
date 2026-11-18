import "server-only";
import { z } from "zod";
import type { Organization } from "@/lib/types";
import { ApiError, readSession, type Ctx } from "../auth";
import { db, persist } from "../db";
import { id, nowIso } from "../util";
import { createProperty, propertySchema } from "./structure";
import { listIntegrations } from "./integrations";

export const onboardingSchema = z.object({
  orgName: z.string().trim().min(2).max(80),
  orgType: z.enum(["residential", "commercial", "hospitality"]),
  property: propertySchema,
});

/** Organization onboarding: creates the org, owner membership, simulator integration and first property. */
export async function onboard(input: z.infer<typeof onboardingSchema>) {
  const auth = await readSession();
  if (!auth) throw new ApiError(401, "Please sign in first.");
  const d = db();
  const org: Organization = { id: id("org_"), name: input.orgName, type: input.orgType, plan: "trial", createdAt: nowIso() };
  d.orgs.push(org);
  const membership = { id: id("mem_"), orgId: org.id, userId: auth.user.id, role: "owner" as const, propertyIds: null, createdAt: nowIso() };
  d.memberships.push(membership);
  d.integrations.push({ id: id("int_"), orgId: org.id, provider: "simulated", label: "Nexora Simulator", status: "connected", lastSyncAt: nowIso(), createdAt: nowIso() });
  auth.session.activeOrgId = org.id;
  auth.session.activePropertyId = null;
  const ctx = {
    user: auth.user,
    session: auth.session,
    orgId: org.id,
    membership,
    role: "owner",
    permissions: [],
    can: () => true,
    assertProperty: () => {},
    canAccessProperty: () => true,
    propertyId: null,
  } as unknown as Ctx;
  const property = createProperty(ctx, input.property);
  persist();
  return { org, property };
}

export async function switchOrg(orgId: string) {
  const auth = await readSession();
  if (!auth) throw new ApiError(401, "Please sign in first.");
  const d = db();
  if (!d.memberships.some((m) => m.userId === auth.user.id && m.orgId === orgId)) throw new ApiError(403, "You're not a member of that organization.");
  auth.session.activeOrgId = orgId;
  auth.session.activePropertyId = null;
  persist();
}

export function updateOrg(ctx: Ctx, input: { name?: string; type?: Organization["type"] }) {
  if (ctx.role !== "owner") throw new ApiError(403, "Only owners can edit organization settings.");
  const org = db().orgs.find((o) => o.id === ctx.orgId)!;
  const parsed = z.object({ name: z.string().trim().min(2).max(80).optional(), type: z.enum(["residential", "commercial", "hospitality"]).optional() }).parse(input);
  Object.assign(org, parsed);
  persist();
  return org;
}

/**
 * Everything the client needs to render the active property in one tenant-scoped payload.
 * Polled every few seconds for live status (WebSocket push is the production transport).
 */
export function bootstrap(ctx: Ctx) {
  const d = db();
  const org = d.orgs.find((o) => o.id === ctx.orgId)!;
  const properties = d.properties.filter((p) => p.orgId === ctx.orgId && ctx.canAccessProperty(p.id));
  const pid = ctx.propertyId;
  const inProp = <T extends { propertyId: string | null; orgId: string }>(x: T) => x.orgId === ctx.orgId && x.propertyId === pid;
  const orgDevices = d.devices.filter((x) => x.orgId === ctx.orgId && ctx.canAccessProperty(x.propertyId));
  return {
    org,
    role: ctx.role,
    permissions: ctx.permissions,
    propertyId: pid,
    properties: properties.map((p) => ({
      ...p,
      deviceCount: orgDevices.filter((x) => x.propertyId === p.id).length,
      onlineCount: orgDevices.filter((x) => x.propertyId === p.id && x.online).length,
    })),
    buildings: d.buildings.filter(inProp),
    floors: d.floors.filter(inProp).sort((a, b) => a.order - b.order),
    rooms: d.rooms.filter(inProp).sort((a, b) => a.order - b.order),
    devices: d.devices.filter(inProp),
    scenes: d.scenes.filter(inProp),
    unread: d.notifications.filter((n) => n.orgId === ctx.orgId && !n.read && (!n.propertyId || ctx.canAccessProperty(n.propertyId))).length,
    integrations: listIntegrations(ctx),
    serverTime: nowIso(),
    schedulerLastTick: d.meta.schedulerLastTick,
  };
}
