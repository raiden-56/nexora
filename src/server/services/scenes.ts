import "server-only";
import { z } from "zod";
import type { Scene } from "@/lib/types";
import { ApiError, rateLimit, type Ctx } from "../auth";
import { db, persist } from "../db";
import { runScene } from "../automation/executor";
import { id, nowIso } from "../util";
import { commandSchema, validateCommand } from "./devices";

export const sceneSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().max(200).default(""),
  icon: z.string().max(40).default("sparkles"),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#69E3C0"),
  propertyId: z.string(),
  actions: z.array(z.object({ deviceId: z.string(), command: commandSchema })).min(1, "add at least one device").max(60),
});

function assertActions(ctx: Ctx, input: z.infer<typeof sceneSchema>) {
  ctx.assertProperty(input.propertyId);
  const d = db();
  for (const a of input.actions) {
    const dev = d.devices.find((x) => x.id === a.deviceId && x.orgId === ctx.orgId && x.propertyId === input.propertyId);
    if (!dev) throw new ApiError(422, "A scene action references a device outside this property.");
    validateCommand(dev, a.command);
  }
}

export function listScenes(ctx: Ctx, propertyId?: string | null) {
  return db().scenes.filter((s) => s.orgId === ctx.orgId && ctx.canAccessProperty(s.propertyId) && (!propertyId || s.propertyId === propertyId));
}

function getScene(ctx: Ctx, sceneId: string) {
  const s = db().scenes.find((x) => x.id === sceneId && x.orgId === ctx.orgId);
  if (!s || !ctx.canAccessProperty(s.propertyId)) throw new ApiError(404, "Scene not found.");
  return s;
}

export function createScene(ctx: Ctx, input: z.infer<typeof sceneSchema>) {
  if (!ctx.can("scenes.manage")) throw new ApiError(403, "Your role can't create scenes.");
  assertActions(ctx, input);
  const s: Scene = { ...input, id: id("scn_"), orgId: ctx.orgId, createdAt: nowIso(), lastActivatedAt: null };
  db().scenes.push(s);
  persist();
  return s;
}

export function updateScene(ctx: Ctx, sceneId: string, input: Partial<z.infer<typeof sceneSchema>>) {
  if (!ctx.can("scenes.manage")) throw new ApiError(403, "Your role can't edit scenes.");
  const s = getScene(ctx, sceneId);
  const merged = sceneSchema.parse({ ...s, ...input });
  assertActions(ctx, merged);
  Object.assign(s, merged);
  persist();
  return s;
}

export function deleteScene(ctx: Ctx, sceneId: string) {
  if (!ctx.can("scenes.manage")) throw new ApiError(403, "Your role can't delete scenes.");
  const s = getScene(ctx, sceneId);
  const d = db();
  const usedBy = d.automations.filter((a) => a.actions.some((x) => x.type === "scene" && x.sceneId === s.id));
  if (usedBy.length) throw new ApiError(409, `Used by automation "${usedBy[0].name}". Remove it there first.`);
  d.scenes = d.scenes.filter((x) => x.id !== s.id);
  persist();
}

export async function activateScene(ctx: Ctx, sceneId: string) {
  if (!ctx.can("devices.control")) throw new ApiError(403, "Your role can't activate scenes.");
  rateLimit(`scene:${ctx.user.id}`, 30);
  const s = getScene(ctx, sceneId);
  return runScene(s, { source: "user", userId: ctx.user.id, userName: ctx.user.name });
}
