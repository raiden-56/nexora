import { requireCtx, type Ctx } from "@/server/auth";
import { db, persist } from "@/server/db";
import { route } from "@/server/http";

const visible = (ctx: Ctx) => db().notifications.filter((n) => n.orgId === ctx.orgId && (!n.propertyId || ctx.canAccessProperty(n.propertyId)));

export const GET = route(async () => {
  const ctx = await requireCtx("devices.view");
  return { notifications: visible(ctx).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200) };
});

/** Mark all as read */
export const PATCH = route(async () => {
  const ctx = await requireCtx("devices.view");
  visible(ctx).forEach((n) => (n.read = true));
  persist();
  return { ok: true };
});

/** Clear all read notifications */
export const DELETE = route(async () => {
  const ctx = await requireCtx("devices.view");
  const ids = new Set(visible(ctx).filter((n) => n.read).map((n) => n.id));
  const d = db();
  d.notifications = d.notifications.filter((n) => !ids.has(n.id));
  persist();
  return { ok: true };
});
