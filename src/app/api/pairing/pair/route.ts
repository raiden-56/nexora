import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { pair, pairSchema } from "@/server/services/integrations";

export const POST = route(async (req) => pair(await requireCtx(), await body(req, pairSchema)));
