import { z } from "zod";
import { ApiError, requireCtx } from "@/server/auth";
import { db, persist } from "@/server/db";
import { body, route } from "@/server/http";
import { getDeviceForCtx } from "@/server/services/devices";
import { hourlyWh } from "@/server/services/energy";
import { logActivity } from "@/server/services/log";
import { zonedParts } from "@/server/automation/time";
import { toPublic } from "@/server/services/integrations";

type P = { id: string };

export const GET = route<P>(async (_req, { id }) => {
  const ctx = await requireCtx("devices.view");
  const device = getDeviceForCtx(ctx, id);
  const d = db();
  const property = d.properties.find((p) => p.id === device.propertyId)!;
  const commercial = d.orgs.find((o) => o.id === ctx.orgId)!.type !== "residential";
  const hour = 3600_000;
  const base = Math.floor(Date.now() / hour) * hour;
  const energy = Array.from({ length: 24 }, (_, i) => {
    const t = new Date(base - (23 - i) * hour);
    const zp = zonedParts(t, property.timezone);
    return { label: zp.hhmm, wh: Math.round(hourlyWh(device, t, Math.floor(zp.minutes / 60), commercial, zp.dow === 0 || zp.dow === 6)) };
  });
  const integration = device.integrationId ? d.integrations.find((i) => i.id === device.integrationId) : null;
  return {
    device,
    room: d.rooms.find((r) => r.id === device.roomId) ?? null,
    integration: integration ? toPublic(integration) : null,
    activity: d.activity.filter((a) => a.deviceId === device.id).slice(-40).reverse(),
    energy,
    usedIn: {
      scenes: d.scenes.filter((s) => s.actions.some((a) => a.deviceId === device.id)).map((s) => ({ id: s.id, name: s.name })),
      automations: d.automations
        .filter((a) => a.actions.some((x) => x.type === "device" && x.deviceId === device.id) || ("deviceId" in a.trigger && a.trigger.deviceId === device.id))
        .map((a) => ({ id: a.id, name: a.name })),
    },
  };
});

const patchSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  roomId: z.string().optional(),
  essential: z.boolean().optional(),
  ratedWatts: z.number().min(0).max(20000).optional(),
  marker: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
});

export const PATCH = route<P>(async (req, { id }) => {
  const ctx = await requireCtx();
  if (!ctx.can("properties.manage") && !ctx.can("integrations.manage")) throw new ApiError(403, "Your role can't edit devices.");
  const device = getDeviceForCtx(ctx, id);
  const input = await body(req, patchSchema);
  if (input.roomId) {
    const room = db().rooms.find((r) => r.id === input.roomId && r.orgId === ctx.orgId);
    if (!room) throw new ApiError(404, "Room not found.");
    ctx.assertProperty(room.propertyId);
    if (room.propertyId !== device.propertyId) throw new ApiError(422, "Devices can only move between rooms of the same property.");
  }
  const before = device.name;
  Object.assign(device, input);
  logActivity({
    orgId: ctx.orgId,
    propertyId: device.propertyId,
    userId: ctx.user.id,
    userName: ctx.user.name,
    deviceId: device.id,
    deviceName: device.name,
    action: input.roomId ? "Moved to another room" : input.name ? "Renamed" : "Settings updated",
    previous: input.name ? before : null,
    next: input.name ?? null,
    source: "user",
    automationId: null,
  });
  persist();
  return device;
});

export const DELETE = route<P>(async (_req, { id }) => {
  const ctx = await requireCtx("integrations.manage");
  const device = getDeviceForCtx(ctx, id);
  const d = db();
  d.devices = d.devices.filter((x) => x.id !== device.id);
  for (const s of d.scenes) s.actions = s.actions.filter((a) => a.deviceId !== device.id);
  for (const a of d.automations) a.actions = a.actions.filter((x) => !(x.type === "device" && x.deviceId === device.id));
  logActivity({ orgId: ctx.orgId, propertyId: device.propertyId, userId: ctx.user.id, userName: ctx.user.name, deviceId: device.id, deviceName: device.name, action: "Removed device", previous: null, next: null, source: "user", automationId: null });
  persist();
  return { ok: true };
});
