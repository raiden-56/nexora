import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { cameraViewSchema, createCameraView, listCameraViews } from "@/server/services/cameraViews";

export const GET = route(async () => ({ views: listCameraViews(await requireCtx("devices.view")) }));
export const POST = route(async (req) => createCameraView(await requireCtx(), await body(req, cameraViewSchema)));
