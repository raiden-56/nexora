import { z } from "zod";
import { body, route } from "@/server/http";
import { switchOrg } from "@/server/services/org";

export const POST = route(async (req) => {
  const { orgId } = await body(req, z.object({ orgId: z.string() }));
  await switchOrg(orgId);
  return { ok: true };
});
