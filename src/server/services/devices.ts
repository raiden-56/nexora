import "@/server/guard";
import { z } from "zod";
import { describeCommand, describeState, has, isSwitchable } from "@/lib/devices";
import type { Capability, Device, DeviceCommand } from "@/lib/types";
import { ApiError, rateLimit, type Ctx } from "../auth";
import { bus } from "../bus";
import { db, persist } from "../db";
import { getProvider } from "../providers/registry";
import { id, nowIso, sleep } from "../util";
import { logActivity, notify } from "./log";

export const commandSchema = z
  .object({
    on: z.boolean(),
    brightness: z.number().int().min(1).max(100),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a hex colour"),
    colorTemp: z.number().int().min(2200).max(6500),
    speed: z.number().int().min(1).max(5),
    oscillate: z.boolean(),
    targetTemp: z.number().min(16).max(30).multipleOf(0.5),
    mode: z.enum(["cool", "heat", "dry", "fan", "auto"]),
    acFan: z.enum(["auto", "low", "medium", "high"]),
    swing: z.boolean(),
    position: z.number().int().min(0).max(100),
    stop: z.boolean(),
    locked: z.boolean(),
  })
  .partial()
  .strict()
  .refine((c) => Object.keys(c).length > 0, "command is empty");

const KEY_CAPABILITY: Record<keyof DeviceCommand, Capability> = {
  on: "onoff",
  brightness: "brightness",
  color: "color",
  colorTemp: "color_temp",
  speed: "fan_speed",
  oscillate: "oscillate",
  targetTemp: "target_temp",
  mode: "hvac_mode",
  acFan: "ac_fan",
  swing: "swing",
  position: "position",
  stop: "position",
  locked: "lock",
};

/** Rejects commands that the device's declared capabilities don't support. */
export function validateCommand(device: Pick<Device, "capabilities" | "name">, command: DeviceCommand): DeviceCommand {
  const parsed = commandSchema.parse(command) as DeviceCommand;
  for (const key of Object.keys(parsed) as (keyof DeviceCommand)[]) {
    const cap = KEY_CAPABILITY[key];
    if (!device.capabilities.includes(cap)) throw new ApiError(422, `${device.name} does not support "${key}".`);
  }
  return parsed;
}

export interface CommandOutcome {
  ok: boolean;
  device: Device;
  error?: string;
  attempts: number;
}

/**
 * The single path through which every device command flows — user taps, scenes, automations
 * and hotel workflows. Validates, dispatches through the provider adapter, retries transient
 * failures, persists confirmed state and writes the audit trail.
 */
export async function executeDeviceCommand(opts: {
  device: Device;
  command: DeviceCommand;
  source: "user" | "automation" | "scene" | "system" | "gateway";
  userId: string | null;
  userName: string | null;
  automationId?: string | null;
  maxAttempts?: number;
}): Promise<CommandOutcome> {
  const { device, source } = opts;
  const command = validateCommand(device, opts.command);
  const d = db();
  const integration = device.integrationId ? d.integrations.find((i) => i.id === device.integrationId && i.orgId === device.orgId) ?? null : null;
  const provider = getProvider(device.provider);
  const maxAttempts = opts.maxAttempts ?? 1;
  let attempts = 0;
  let lastError = "Unknown error";
  let offline = false;

  while (attempts < maxAttempts) {
    attempts++;
    const res = await provider.sendCommand(device, command, integration);
    if (res.ok) {
      const previous = { ...device.state };
      const prevLabel = describeState(device);
      const wasOffline = !device.online;
      device.state = res.state;
      device.online = true;
      device.lastSeenAt = nowIso();
      d.stateHistory.push({ id: id("sth_"), orgId: device.orgId, deviceId: device.id, state: { ...device.state }, online: true, at: device.lastSeenAt });
      logActivity({
        orgId: device.orgId,
        propertyId: device.propertyId,
        userId: opts.userId,
        userName: opts.userName,
        deviceId: device.id,
        deviceName: device.name,
        action: describeCommand(command),
        previous: prevLabel,
        next: describeState(device),
        source,
        automationId: opts.automationId ?? null,
      });
      if (wasOffline) notify({ orgId: device.orgId, propertyId: device.propertyId, type: "device_online", severity: "success", title: `${device.name} reconnected`, body: "The device is responding again.", link: `/devices/${device.id}` });
      persist();
      bus.emit({ type: "device.changed", device, previous, source });
      return { ok: true, device, attempts };
    }
    lastError = res.error;
    offline = !!res.offline;
    if (!res.retryable) break;
    if (attempts < maxAttempts) await sleep(400 * attempts);
  }

  if (offline && device.online) {
    device.online = false;
    notify({ orgId: device.orgId, propertyId: device.propertyId, type: "device_offline", severity: "error", title: `${device.name} is offline`, body: lastError, link: `/devices/${device.id}` });
  }
  logActivity({
    orgId: device.orgId,
    propertyId: device.propertyId,
    userId: opts.userId,
    userName: opts.userName,
    deviceId: device.id,
    deviceName: device.name,
    action: `Failed: ${describeCommand(command)}`,
    previous: describeState(device),
    next: null,
    source,
    automationId: opts.automationId ?? null,
  });
  persist();
  return { ok: false, device, error: lastError, attempts };
}

export function getDeviceForCtx(ctx: Ctx, deviceId: string): Device {
  const device = db().devices.find((x) => x.id === deviceId && x.orgId === ctx.orgId);
  if (!device) throw new ApiError(404, "Device not found.");
  ctx.assertProperty(device.propertyId);
  return device;
}

export async function controlDevice(ctx: Ctx, deviceId: string, command: DeviceCommand) {
  if (!ctx.can("devices.control")) throw new ApiError(403, "Your role can view but not control devices.");
  rateLimit(`cmd:${ctx.user.id}`, 120);
  const device = getDeviceForCtx(ctx, deviceId);
  const res = await executeDeviceCommand({ device, command, source: "user", userId: ctx.user.id, userName: ctx.user.name, maxAttempts: 2 });
  if (!res.ok) throw new ApiError(502, res.error ?? "Command failed.", "COMMAND_FAILED");
  return res.device;
}

export async function bulkControl(ctx: Ctx, deviceIds: string[], command: DeviceCommand) {
  if (!ctx.can("devices.control")) throw new ApiError(403, "Your role can view but not control devices.");
  rateLimit(`bulk:${ctx.user.id}`, 20);
  const devices = deviceIds.map((x) => getDeviceForCtx(ctx, x));
  const turningOff = command.on === false;
  const results = await Promise.all(
    devices.map(async (device) => {
      if (turningOff && device.essential) return { deviceId: device.id, name: device.name, status: "skipped" as const, detail: "Essential / safety load — protected from bulk switch-off" };
      if (command.on !== undefined && !isSwitchable(device)) return { deviceId: device.id, name: device.name, status: "skipped" as const, detail: "Not switchable" };
      // Only send capabilities the device supports (e.g. brightness to bulbs only)
      const cmd = Object.fromEntries(Object.entries(command).filter(([k]) => has(device, KEY_CAPABILITY[k as keyof DeviceCommand]))) as DeviceCommand;
      if (!Object.keys(cmd).length) return { deviceId: device.id, name: device.name, status: "skipped" as const, detail: "Unsupported" };
      const r = await executeDeviceCommand({ device, command: cmd, source: "user", userId: ctx.user.id, userName: ctx.user.name, maxAttempts: 2 });
      return { deviceId: device.id, name: device.name, status: r.ok ? ("success" as const) : ("failed" as const), detail: r.error };
    }),
  );
  return {
    results,
    succeeded: results.filter((r) => r.status === "success").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
  };
}

/** Developer tools for simulated devices: fire sensor events, take a device offline. */
export function simulateDevice(ctx: Ctx, deviceId: string, patch: { online?: boolean; motion?: boolean; contact?: "open" | "closed"; temperature?: number }) {
  const device = getDeviceForCtx(ctx, deviceId);
  if (device.provider !== "simulated") throw new ApiError(400, "Only simulated devices can be driven by the simulator.");
  const previous = { ...device.state };
  if (patch.online !== undefined) {
    device.online = patch.online;
    if (!patch.online) notify({ orgId: device.orgId, propertyId: device.propertyId, type: "device_offline", severity: "error", title: `${device.name} is offline`, body: "Simulated outage started from the device page.", link: `/devices/${device.id}` });
    else notify({ orgId: device.orgId, propertyId: device.propertyId, type: "device_online", severity: "success", title: `${device.name} reconnected`, body: "Simulated outage ended.", link: `/devices/${device.id}` });
  }
  if (patch.motion !== undefined && has(device, "motion")) device.state.motion = patch.motion;
  if (patch.contact !== undefined && has(device, "contact")) device.state.contact = patch.contact;
  if (patch.temperature !== undefined && has(device, "temperature")) device.state.temperature = patch.temperature;
  device.lastSeenAt = nowIso();
  logActivity({ orgId: device.orgId, propertyId: device.propertyId, userId: ctx.user.id, userName: ctx.user.name, deviceId: device.id, deviceName: device.name, action: "Simulator event", previous: null, next: patch.online === false ? "Offline" : describeState(device), source: "system", automationId: null });
  persist();
  if (device.online) bus.emit({ type: "device.changed", device, previous, source: "system" });
  return device;
}
