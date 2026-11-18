import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { hotelActionSchema, hotelRoomAction } from "@/server/services/hotel";

export const POST = route<{ id: string }>(async (req, { id }) => hotelRoomAction(await requireCtx(), id, await body(req, hotelActionSchema)));
