import { requireCtx } from "@/server/auth";
import { db } from "@/server/db";
import { route } from "@/server/http";
import { upcomingOccurrences } from "@/server/automation/time";

export const GET = route(async () => {
  const ctx = await requireCtx("devices.view");
  const d = db();
  const now = new Date();
  const items = d.automations
    .filter((a) => a.orgId === ctx.orgId && a.propertyId === ctx.propertyId && ["time", "sunrise", "sunset"].includes(a.trigger.type))
    .flatMap((a) => {
      const p = d.properties.find((x) => x.id === a.propertyId)!;
      return upcomingOccurrences(a, p, now, 7, 14).map((o) => ({ automationId: a.id, name: a.name, enabled: a.enabled, phase: o.phase, at: o.at.toISOString(), trigger: a.trigger, end: a.end }));
    })
    .sort((x, y) => x.at.localeCompare(y.at));
  return { items, timezone: d.properties.find((p) => p.id === ctx.propertyId)?.timezone ?? "UTC", schedulerLastTick: d.meta.schedulerLastTick };
});
