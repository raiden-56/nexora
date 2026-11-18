import { z } from "zod";
import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { reorderRooms } from "@/server/services/structure";

export const POST = route(async (req) => {
  const { floorId, ids } = await body(req, z.object({ floorId: z.string(), ids: z.array(z.string()).max(200) }));
  reorderRooms(await requireCtx(), floorId, ids);
  return { ok: true };
});
