import { requireCtx } from "@/server/auth";
import { route } from "@/server/http";
import { activateScene } from "@/server/services/scenes";

export const POST = route<{ id: string }>(async (_req, { id }) => activateScene(await requireCtx(), id));
