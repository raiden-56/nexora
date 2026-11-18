import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { invite, inviteSchema } from "@/server/services/members";

export const POST = route(async (req) => invite(await requireCtx(), await body(req, inviteSchema)));
