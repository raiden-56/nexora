import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { cameraViewSchema, deleteCameraView, updateCameraView } from "@/server/services/cameraViews";

type P = { id: string };
export const PATCH = route<P>(async (req, { id }) => updateCameraView(await requireCtx(), id, await body(req, cameraViewSchema.partial())));
export const DELETE = route<P>(async (_req, { id }) => {
  deleteCameraView(await requireCtx(), id);
  return { ok: true };
});
