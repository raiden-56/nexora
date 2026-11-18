import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { createScene, listScenes, sceneSchema } from "@/server/services/scenes";

export const GET = route(async () => {
  const ctx = await requireCtx("devices.view");
  return { scenes: listScenes(ctx, ctx.propertyId) };
});
export const POST = route(async (req) => createScene(await requireCtx(), await body(req, sceneSchema)));
