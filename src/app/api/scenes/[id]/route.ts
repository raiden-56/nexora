import { z } from "zod";
import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { deleteScene, updateScene } from "@/server/services/scenes";

type P = { id: string };
export const PATCH = route<P>(async (req, { id }) => updateScene(await requireCtx(), id, await body(req, z.record(z.string(), z.any()))));
export const DELETE = route<P>(async (_req, { id }) => {
  deleteScene(await requireCtx(), id);
  return { ok: true };
});
