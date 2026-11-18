import { requireCtx } from "@/server/auth";
import { query, route } from "@/server/http";
import { listExecutions } from "@/server/services/automations";

export const GET = route(async (req) => {
  const ctx = await requireCtx("devices.view");
  const q = query(req);
  return { executions: listExecutions(ctx, { propertyId: q.get("all") ? null : ctx.propertyId, limit: Math.min(200, Number(q.get("limit") ?? 50)) }) };
});
