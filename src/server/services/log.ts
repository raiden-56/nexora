import "@/server/guard";
import { db, persist } from "../db";
import { id, nowIso } from "../util";
import type { ActivityLog, Notification } from "@/lib/types";

export function logActivity(entry: Omit<ActivityLog, "id" | "at">) {
  db().activity.push({ ...entry, id: id("act_"), at: nowIso() });
  persist();
}

export function notify(n: Omit<Notification, "id" | "read" | "createdAt">) {
  const d = db();
  // Collapse identical unread notifications raised within 10 minutes (avoids alert storms).
  const recent = d.notifications.find(
    (x) => x.orgId === n.orgId && !x.read && x.title === n.title && Date.now() - Date.parse(x.createdAt) < 10 * 60_000,
  );
  if (recent) {
    recent.createdAt = nowIso();
    recent.body = n.body;
  } else {
    d.notifications.push({ ...n, id: id("ntf_"), read: false, createdAt: nowIso() });
  }
  persist();
}
