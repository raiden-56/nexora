import { requireCtx } from "@/server/auth";
import { route } from "@/server/http";
import { deleteIntegration } from "@/server/services/integrations";

export const DELETE = route<{ id: string }>(async (_req, { id }) => {
  deleteIntegration(await requireCtx(), id);
  return { ok: true };
});
