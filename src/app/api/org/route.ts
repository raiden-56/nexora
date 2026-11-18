import { z } from "zod";
import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { updateOrg } from "@/server/services/org";

const schema = z.object({ name: z.string().optional(), type: z.enum(["residential", "commercial", "hospitality"]).optional() });
export const PATCH = route(async (req) => updateOrg(await requireCtx(), await body(req, schema)));
