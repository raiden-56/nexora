import { requireCtx } from "@/server/auth";
import { route } from "@/server/http";
import { runNow } from "@/server/services/automations";

export const POST = route<{ id: string }>(async (_req, { id }) => runNow(await requireCtx(), id));
