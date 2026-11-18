import { requireCtx } from "@/server/auth";
import { route } from "@/server/http";
import { testIntegration } from "@/server/services/integrations";

export const POST = route<{ id: string }>(async (_req, { id }) => testIntegration(await requireCtx(), id));
