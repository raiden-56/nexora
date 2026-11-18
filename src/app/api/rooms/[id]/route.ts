import { z } from "zod";
import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { deleteRoom, updateRoom } from "@/server/services/structure";

type P = { id: string };
export const PATCH = route<P>(async (req, { id }) => updateRoom(await requireCtx(), id, await body(req, z.record(z.string(), z.any()))));
export const DELETE = route<P>(async (_req, { id }) => {
  deleteRoom(await requireCtx(), id);
  return { ok: true };
});
