import { z } from "zod";
import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { deleteFloor, renameFloor } from "@/server/services/structure";

type P = { id: string };
export const PATCH = route<P>(async (req, { id }) => renameFloor(await requireCtx(), id, (await body(req, z.object({ name: z.string() }))).name));
export const DELETE = route<P>(async (_req, { id }) => {
  deleteFloor(await requireCtx(), id);
  return { ok: true };
});
