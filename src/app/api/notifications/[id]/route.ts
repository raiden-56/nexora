import { z } from "zod";
import { ApiError, requireCtx } from "@/server/auth";
import { db, persist } from "@/server/db";
import { body, route } from "@/server/http";

type P = { id: string };
async function find(id: string) {
  const ctx = await requireCtx("devices.view");
  const n = db().notifications.find((x) => x.id === id && x.orgId === ctx.orgId);
  if (!n || (n.propertyId && !ctx.canAccessProperty(n.propertyId))) throw new ApiError(404, "Notification not found.");
  return n;
}
export const PATCH = route<P>(async (req, { id }) => {
  const n = await find(id);
  n.read = (await body(req, z.object({ read: z.boolean() }))).read;
  persist();
  return n;
});
export const DELETE = route<P>(async (_req, { id }) => {
  const n = await find(id);
  const d = db();
  d.notifications = d.notifications.filter((x) => x.id !== n.id);
  persist();
  return { ok: true };
});
