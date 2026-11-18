import { z } from "zod";
import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { createFloor } from "@/server/services/structure";

export const POST = route(async (req) => {
  const { propertyId, name } = await body(req, z.object({ propertyId: z.string(), name: z.string() }));
  return createFloor(await requireCtx(), propertyId, name);
});
