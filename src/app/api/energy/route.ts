import { requireCtx } from "@/server/auth";
import { query, route } from "@/server/http";
import { energyReport, type EnergyRange } from "@/server/services/energy";

export const GET = route(async (req) => {
  const ctx = await requireCtx("analytics.view");
  const q = query(req);
  const range = (["24h", "7d", "30d"].includes(q.get("range") ?? "") ? q.get("range") : "7d") as EnergyRange;
  const scope = q.get("scope") === "org" ? null : ctx.propertyId;
  return energyReport(ctx, scope, range);
});
