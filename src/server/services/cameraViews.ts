import "@/server/guard";
import { z } from "zod";
import type { CameraView } from "@/lib/types";
import { ApiError, type Ctx } from "../auth";
import { db, persist } from "../db";
import { id, nowIso } from "../util";

/** Saved CCTV walls. Anyone who can watch cameras can switch views; arranging them needs device control. */
export const cameraViewSchema = z.object({
  name: z.string().trim().min(1, "name the view").max(40),
  layout: z.union([z.literal(1), z.literal(4), z.literal(9), z.literal(16)]),
  cameraIds: z.array(z.string()).min(1, "pick at least one camera").max(16),
});

function cameraIdsIn(propertyId: string) {
  return new Set(db().devices.filter((d) => d.propertyId === propertyId && d.type === "camera").map((d) => d.id));
}

function clean(ids: string[], propertyId: string) {
  const valid = cameraIdsIn(propertyId);
  return [...new Set(ids)].filter((x) => valid.has(x));
}

export function listCameraViews(ctx: Ctx): CameraView[] {
  if (!ctx.can("cameras.view")) throw new ApiError(403, "Your role can't view CCTV.");
  const pid = ctx.propertyId;
  if (!pid) return [];
  return db()
    .cameraViews.filter((v) => v.orgId === ctx.orgId && v.propertyId === pid)
    // Cameras removed since the view was saved simply drop out.
    .map((v) => ({ ...v, cameraIds: clean(v.cameraIds, pid) }));
}

function manage(ctx: Ctx) {
  if (!ctx.can("cameras.view") || !ctx.can("devices.control")) throw new ApiError(403, "Your role can't arrange camera views.");
}

function getView(ctx: Ctx, viewId: string) {
  const v = db().cameraViews.find((x) => x.id === viewId && x.orgId === ctx.orgId);
  if (!v || !ctx.canAccessProperty(v.propertyId)) throw new ApiError(404, "Camera view not found.");
  return v;
}

export function createCameraView(ctx: Ctx, input: z.infer<typeof cameraViewSchema>) {
  manage(ctx);
  const pid = ctx.propertyId;
  if (!pid) throw new ApiError(400, "Select a property first.");
  const cameraIds = clean(input.cameraIds, pid);
  if (!cameraIds.length) throw new ApiError(422, "Pick at least one camera from this property.");
  if (db().cameraViews.filter((v) => v.propertyId === pid).length >= 30) throw new ApiError(422, "A property can have up to 30 saved views.");
  const v: CameraView = { id: id("cvw_"), orgId: ctx.orgId, propertyId: pid, name: input.name, layout: input.layout, cameraIds, createdBy: ctx.user.id, createdAt: nowIso() };
  db().cameraViews.push(v);
  persist();
  return v;
}

export function updateCameraView(ctx: Ctx, viewId: string, input: Partial<z.infer<typeof cameraViewSchema>>) {
  manage(ctx);
  const v = getView(ctx, viewId);
  const merged = cameraViewSchema.parse({ name: v.name, layout: v.layout, cameraIds: v.cameraIds, ...input });
  const cameraIds = clean(merged.cameraIds, v.propertyId);
  if (!cameraIds.length) throw new ApiError(422, "Pick at least one camera from this property.");
  Object.assign(v, merged, { cameraIds });
  persist();
  return v;
}

export function deleteCameraView(ctx: Ctx, viewId: string) {
  manage(ctx);
  const v = getView(ctx, viewId);
  const d = db();
  d.cameraViews = d.cameraViews.filter((x) => x.id !== v.id);
  persist();
}
