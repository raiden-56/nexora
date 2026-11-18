import { requireCtx } from "@/server/auth";
import { route } from "@/server/http";
import { duplicateAutomation } from "@/server/services/automations";

export const POST = route<{ id: string }>(async (_req, { id }) => duplicateAutomation(await requireCtx(), id));
