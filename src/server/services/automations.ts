import "server-only";
import { z } from "zod";
import type { Automation, Condition } from "@/lib/types";
import { ApiError, type Ctx } from "../auth";
import { db, persist } from "../db";
import { id, nowIso } from "../util";
import { runAutomation } from "../automation/executor";
import { upcomingOccurrences } from "../automation/time";
import { commandSchema } from "./devices";

const days = z.array(z.number().int().min(0).max(6)).max(7);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use HH:MM");

const conditionSchema: z.ZodType<Condition> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("device_online"), deviceId: z.string() }),
  z.object({ type: z.literal("device_on"), deviceId: z.string() }),
  z.object({ type: z.literal("room_occupied"), roomId: z.string() }),
  z.object({ type: z.literal("temperature_above"), deviceId: z.string(), value: z.number().min(-20).max(60) }),
  z.object({ type: z.literal("day_of_week"), days }),
  z.object({ type: z.literal("property_mode"), mode: z.enum(["home", "away", "night", "vacation"]) }),
]);

export const automationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().max(240).default(""),
  propertyId: z.string(),
  enabled: z.boolean().default(true),
  trigger: z.discriminatedUnion("type", [
    z.object({ type: z.literal("time"), time: hhmm, days: days.min(1, "pick at least one day") }),
    z.object({ type: z.literal("sunrise"), offsetMin: z.number().int().min(-180).max(180), days: days.min(1) }),
    z.object({ type: z.literal("sunset"), offsetMin: z.number().int().min(-180).max(180), days: days.min(1) }),
    z.object({ type: z.literal("device_state"), deviceId: z.string(), key: z.enum(["on", "motion", "contact", "locked"]), equals: z.union([z.string(), z.boolean(), z.number()]) }),
    z.object({ type: z.literal("temperature_change"), deviceId: z.string(), above: z.number() }),
    z.object({ type: z.literal("manual") }),
  ]),
  conditions: z.array(conditionSchema).max(10).default([]),
  actions: z
    .array(
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("device"), deviceId: z.string(), command: commandSchema, conditions: z.array(conditionSchema).max(5).optional() }),
        z.object({ type: z.literal("scene"), sceneId: z.string() }),
        z.object({ type: z.literal("notify"), message: z.string().trim().min(1).max(200) }),
        z.object({ type: z.literal("delay"), seconds: z.number().int().min(1).max(300) }),
      ]),
    )
    .min(1, "add at least one action")
    .max(40),
  end: z.object({ time: hhmm }).nullable().default(null),
  onUnreachable: z.enum(["skip", "retry_then_notify", "abort"]).default("retry_then_notify"),
});

export type AutomationInput = z.infer<typeof automationSchema>;

/** Every referenced device / room / scene must belong to the same org AND property. */
function assertReferences(ctx: Ctx, input: AutomationInput) {
  const d = db();
  ctx.assertProperty(input.propertyId);
  const devOk = (deviceId: string) => d.devices.some((x) => x.id === deviceId && x.orgId === ctx.orgId && x.propertyId === input.propertyId);
  const check = (c: Condition) => {
    if ("deviceId" in c && !devOk(c.deviceId)) throw new ApiError(422, "A condition references a device outside this property.");
    if (c.type === "room_occupied" && !d.rooms.some((r) => r.id === c.roomId && r.orgId === ctx.orgId && r.propertyId === input.propertyId)) throw new ApiError(422, "A condition references an unknown room.");
  };
  input.conditions.forEach(check);
  const t = input.trigger;
  if ((t.type === "device_state" || t.type === "temperature_change") && !devOk(t.deviceId)) throw new ApiError(422, "The trigger device is not in this property.");
  for (const a of input.actions) {
    if (a.type === "device") {
      if (!devOk(a.deviceId)) throw new ApiError(422, "An action references a device outside this property.");
      a.conditions?.forEach(check);
    }
    if (a.type === "scene" && !d.scenes.some((s) => s.id === a.sceneId && s.orgId === ctx.orgId)) throw new ApiError(422, "An action references an unknown scene.");
  }
  if (input.end && !(t.type === "time" || t.type === "sunrise" || t.type === "sunset")) throw new ApiError(422, "End times are only available for scheduled triggers.");
}

export function listAutomations(ctx: Ctx, propertyId?: string | null) {
  const d = db();
  return d.automations
    .filter((a) => a.orgId === ctx.orgId && ctx.canAccessProperty(a.propertyId) && (!propertyId || a.propertyId === propertyId))
    .map((a) => withNext(a));
}

export function withNext(a: Automation) {
  const p = db().properties.find((x) => x.id === a.propertyId);
  const next = a.enabled && p ? upcomingOccurrences(a, p, new Date(), 8, 2) : [];
  return { ...a, next: next.map((n) => ({ phase: n.phase, at: n.at.toISOString() })) };
}

export function getAutomation(ctx: Ctx, automationId: string) {
  const a = db().automations.find((x) => x.id === automationId && x.orgId === ctx.orgId);
  if (!a || !ctx.canAccessProperty(a.propertyId)) throw new ApiError(404, "Automation not found.");
  return a;
}

export function createAutomation(ctx: Ctx, input: AutomationInput) {
  if (!ctx.can("automations.manage")) throw new ApiError(403, "Your role can't manage automations.");
  assertReferences(ctx, input);
  const a: Automation = { ...input, id: id("aut_"), orgId: ctx.orgId, createdAt: nowIso(), updatedAt: nowIso(), lastRunAt: null, lastStatus: null } as Automation;
  db().automations.push(a);
  persist();
  return withNext(a);
}

export function updateAutomation(ctx: Ctx, automationId: string, input: Partial<AutomationInput>) {
  if (!ctx.can("automations.manage")) throw new ApiError(403, "Your role can't manage automations.");
  const a = getAutomation(ctx, automationId);
  const merged = automationSchema.parse({ ...a, ...input });
  assertReferences(ctx, merged);
  Object.assign(a, merged, { updatedAt: nowIso() });
  persist();
  return withNext(a);
}

export function deleteAutomation(ctx: Ctx, automationId: string) {
  if (!ctx.can("automations.manage")) throw new ApiError(403, "Your role can't manage automations.");
  const a = getAutomation(ctx, automationId);
  const d = db();
  d.automations = d.automations.filter((x) => x.id !== a.id);
  persist();
}

export function duplicateAutomation(ctx: Ctx, automationId: string) {
  const a = getAutomation(ctx, automationId);
  return createAutomation(ctx, { ...automationSchema.parse(a), name: `${a.name} (copy)`.slice(0, 80), enabled: false });
}

export async function runNow(ctx: Ctx, automationId: string) {
  if (!ctx.can("automations.manage") && !ctx.can("devices.control")) throw new ApiError(403, "Your role can't run automations.");
  const a = getAutomation(ctx, automationId);
  const exec = await runAutomation(a, { phase: "start", source: "user", dedupeKey: `${a.id}:manual:${Date.now()}`, userId: ctx.user.id, userName: ctx.user.name });
  if (!exec) throw new ApiError(409, "This automation is already running.");
  return exec;
}

export function listExecutions(ctx: Ctx, opts: { automationId?: string | null; propertyId?: string | null; limit?: number }) {
  return db()
    .executions.filter(
      (e) =>
        e.orgId === ctx.orgId &&
        ctx.canAccessProperty(e.propertyId) &&
        (!opts.automationId || e.automationId === opts.automationId) &&
        (!opts.propertyId || e.propertyId === opts.propertyId),
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, opts.limit ?? 50);
}
