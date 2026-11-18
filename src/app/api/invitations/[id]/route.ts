import { requireCtx } from "@/server/auth";
import { route } from "@/server/http";
import { revokeInvitation } from "@/server/services/members";

export const DELETE = route<{ id: string }>(async (_req, { id }) => {
  revokeInvitation(await requireCtx(), id);
  return { ok: true };
});
