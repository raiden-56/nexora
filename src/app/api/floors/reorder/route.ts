import { z } from "zod";
import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { reorderFloors } from "@/server/services/structure";

export const POST = route(async (req) => {
  const { propertyId, ids } = await body(req, z.object({ propertyId: z.string(), ids: z.array(z.string()).max(100) }));
  reorderFloors(await requireCtx(), propertyId, ids);
  return { ok: true };
});
