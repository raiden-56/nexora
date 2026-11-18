import { z } from "zod";
import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { selectProperty } from "@/server/services/structure";

export const POST = route(async (req) => {
  const { propertyId } = await body(req, z.object({ propertyId: z.string() }));
  selectProperty(await requireCtx(), propertyId);
  return { ok: true };
});
