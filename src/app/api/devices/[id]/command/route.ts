import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { commandSchema, controlDevice } from "@/server/services/devices";

export const POST = route<{ id: string }>(async (req, { id }) => controlDevice(await requireCtx(), id, await body(req, commandSchema)));
