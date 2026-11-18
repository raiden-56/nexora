import "server-only";
import { z } from "zod";
import { DEVICE_CATALOG } from "@/lib/devices";
import type { Device, IntegrationAccount, ProviderKey, PublicIntegration } from "@/lib/types";
import { ApiError, type Ctx } from "../auth";
import { db, persist } from "../db";
import { getProvider } from "../providers/registry";
import type { DiscoveredDevice } from "../providers/types";
import { id, nowIso } from "../util";
import { logActivity, notify } from "./log";

export const PROVIDERS: ProviderKey[] = ["matter", "home_assistant", "tuya", "mqtt", "zigbee", "simulated"];

export function toPublic(i: IntegrationAccount): PublicIntegration {
  const { secret, ...rest } = i;
  return { ...rest, hasCredentials: !!(secret && Object.values(secret).some(Boolean)) };
}

export function listIntegrations(ctx: Ctx) {
  return db().integrations.filter((i) => i.orgId === ctx.orgId).map(toPublic);
}

export const integrationSchema = z.object({
  provider: z.enum(["simulated", "home_assistant", "tuya", "matter", "mqtt", "zigbee"]),
  label: z.string().trim().min(2).max(60),
  baseUrl: z.string().url().optional(),
  token: z.string().min(10).max(500).optional(),
  clientId: z.string().max(120).optional(),
  clientSecret: z.string().max(200).optional(),
  region: z.string().max(20).optional(),
});

function requireManage(ctx: Ctx) {
  if (!ctx.can("integrations.manage")) throw new ApiError(403, "Your role can't manage integrations.");
}

export async function createIntegration(ctx: Ctx, input: z.infer<typeof integrationSchema>) {
  requireManage(ctx);
  if (input.provider === "home_assistant" && (!input.baseUrl || !input.token)) throw new ApiError(422, "Home Assistant needs its URL and a long-lived access token.");
  const acc: IntegrationAccount = {
    id: id("int_"),
    orgId: ctx.orgId,
    provider: input.provider,
    label: input.label,
    status: "disconnected",
    secret: { baseUrl: input.baseUrl, token: input.token, clientId: input.clientId, clientSecret: input.clientSecret, region: input.region },
    lastSyncAt: null,
    createdAt: nowIso(),
  };
  const test = await getProvider(acc.provider).testIntegration(acc);
  acc.status = test.ok ? "connected" : input.provider === "simulated" ? "connected" : "error";
  acc.message = test.message;
  if (test.ok) acc.lastSyncAt = nowIso();
  db().integrations.push(acc);
  logActivity({ orgId: ctx.orgId, propertyId: null, userId: ctx.user.id, userName: ctx.user.name, deviceId: null, deviceName: null, action: `Added integration ${acc.label}`, previous: null, next: acc.status, source: "user", automationId: null });
  persist();
  return toPublic(acc);
}

function getIntegration(ctx: Ctx, integrationId: string) {
  const i = db().integrations.find((x) => x.id === integrationId && x.orgId === ctx.orgId);
  if (!i) throw new ApiError(404, "Integration not found.");
  return i;
}

export async function testIntegration(ctx: Ctx, integrationId: string) {
  requireManage(ctx);
  const i = getIntegration(ctx, integrationId);
  const r = await getProvider(i.provider).testIntegration(i);
  const was = i.status;
  i.status = r.ok ? "connected" : "error";
  i.message = r.message;
  if (r.ok) i.lastSyncAt = nowIso();
  if (was === "connected" && !r.ok) notify({ orgId: ctx.orgId, propertyId: null, type: "integration_disconnected", severity: "error", title: `${i.label} disconnected`, body: r.message, link: "/integrations" });
  persist();
  return toPublic(i);
}

export function deleteIntegration(ctx: Ctx, integrationId: string) {
  requireManage(ctx);
  const i = getIntegration(ctx, integrationId);
  const d = db();
  if (d.devices.some((x) => x.integrationId === i.id)) throw new ApiError(409, "Remove the devices paired through this integration first.");
  d.integrations = d.integrations.filter((x) => x.id !== i.id);
  persist();
}

// ─── Pairing ────────────────────────────────────────────────
export async function discover(ctx: Ctx, integrationId: string): Promise<DiscoveredDevice[]> {
  requireManage(ctx);
  const i = getIntegration(ctx, integrationId);
  try {
    const found = await getProvider(i.provider).discover(i);
    const known = new Set(db().devices.filter((x) => x.orgId === ctx.orgId && x.integrationId === i.id).map((x) => x.externalId));
    return found.filter((f) => !known.has(f.externalId));
  } catch (e) {
    throw new ApiError(502, (e as Error).message, "DISCOVERY_FAILED");
  }
}

export const pairSchema = z.object({
  integrationId: z.string(),
  roomId: z.string(),
  name: z.string().trim().min(2).max(60),
  device: z.object({
    externalId: z.string().min(1).max(200),
    type: z.enum(Object.keys(DEVICE_CATALOG) as [keyof typeof DEVICE_CATALOG, ...(keyof typeof DEVICE_CATALOG)[]]),
    manufacturer: z.string().max(80),
    model: z.string().max(80),
    firmware: z.string().max(40),
    ratedWatts: z.number().min(0).max(20000),
  }),
  essential: z.boolean().default(false),
});

/**
 * Pairs a discovered device. The provider must confirm communication (testConnection) before the
 * device is saved — a device is never shown as connected unless the integration confirmed it.
 */
export async function pair(ctx: Ctx, input: z.infer<typeof pairSchema>) {
  requireManage(ctx);
  const d = db();
  const i = getIntegration(ctx, input.integrationId);
  const room = d.rooms.find((r) => r.id === input.roomId && r.orgId === ctx.orgId);
  if (!room) throw new ApiError(404, "Room not found.");
  ctx.assertProperty(room.propertyId);
  if (d.devices.some((x) => x.orgId === ctx.orgId && x.integrationId === i.id && x.externalId === input.device.externalId)) throw new ApiError(409, "This device is already paired.");
  const cat = DEVICE_CATALOG[input.device.type];
  const dev: Device = {
    id: id("dev_"),
    orgId: ctx.orgId,
    propertyId: room.propertyId,
    roomId: room.id,
    name: input.name,
    type: input.device.type,
    provider: i.provider,
    externalId: input.device.externalId,
    integrationId: i.id,
    capabilities: [...cat.capabilities],
    state: { ...cat.defaults },
    online: true,
    essential: input.essential,
    ratedWatts: input.device.ratedWatts,
    lastSeenAt: nowIso(),
    firmware: input.device.firmware,
    model: input.device.model,
    manufacturer: input.device.manufacturer,
    createdAt: nowIso(),
    marker: { x: 0.5, y: 0.5 },
  };
  const test = await getProvider(i.provider).testConnection(dev, i);
  if (!test.ok) throw new ApiError(502, `Pairing failed: ${test.message}`, "PAIR_TEST_FAILED");
  d.devices.push(dev);
  logActivity({ orgId: ctx.orgId, propertyId: room.propertyId, userId: ctx.user.id, userName: ctx.user.name, deviceId: dev.id, deviceName: dev.name, action: `Paired via ${i.label}`, previous: null, next: "Online", source: "integration", automationId: null });
  persist();
  return { device: dev, latencyMs: test.latencyMs, message: test.message };
}

export async function testDevice(ctx: Ctx, deviceId: string) {
  const d = db();
  const dev = d.devices.find((x) => x.id === deviceId && x.orgId === ctx.orgId);
  if (!dev) throw new ApiError(404, "Device not found.");
  ctx.assertProperty(dev.propertyId);
  const i = dev.integrationId ? d.integrations.find((x) => x.id === dev.integrationId) ?? null : null;
  const r = await getProvider(dev.provider).testConnection(dev, i);
  if (r.ok) dev.lastSeenAt = nowIso();
  persist();
  return r;
}
