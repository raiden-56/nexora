import { z } from "zod";
import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { discover } from "@/server/services/integrations";

export const POST = route(async (req) => {
  const { integrationId } = await body(req, z.object({ integrationId: z.string() }));
  return { devices: await discover(await requireCtx(), integrationId) };
});
