import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { createRoom, roomSchema } from "@/server/services/structure";

export const POST = route(async (req) => createRoom(await requireCtx(), await body(req, roomSchema)));
