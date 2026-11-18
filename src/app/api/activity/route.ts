import { requireCtx } from "@/server/auth";
import { db } from "@/server/db";
import { query, route } from "@/server/http";

export const GET = route(async (req) => {
  const ctx = await requireCtx("devices.view");
  const q = query(req);
  const page = Math.max(1, Number(q.get("page") ?? 1));
  const size = Math.min(100, Math.max(5, Number(q.get("size") ?? 25)));
  const source = q.get("source");
  const search = (q.get("q") ?? "").toLowerCase().trim();
  const deviceId = q.get("deviceId");
  const scope = q.get("scope") === "org" ? null : ctx.propertyId;
  const rows = db()
    .activity.filter(
      (a) =>
        a.orgId === ctx.orgId &&
        (a.propertyId === null || ctx.canAccessProperty(a.propertyId)) &&
        (!scope || a.propertyId === scope || a.propertyId === null) &&
        (!source || a.source === source) &&
        (!deviceId || a.deviceId === deviceId) &&
        (!search || [a.action, a.deviceName, a.userName, a.next, a.previous].some((x) => x?.toLowerCase().includes(search))),
    )
    .sort((a, b) => b.at.localeCompare(a.at));
  return { total: rows.length, page, size, rows: rows.slice((page - 1) * size, page * size) };
});
