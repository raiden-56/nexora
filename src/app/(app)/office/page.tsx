"use client";
import { appHref } from "@/lib/routes";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { Briefcase, Building2, CalendarClock, Moon, PowerOff, ShieldCheck, Users, Zap } from "lucide-react";
import { triggerSummary } from "@/components/automation/AutomationBuilder";
import { HBarList } from "@/components/charts";
import { SceneTile } from "@/components/scenes/SceneTile";
import { Button } from "@/components/ui/button";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Badge, Card, CardHeader, DemoBadge, EmptyState, PageHeader, Skeleton, Stat } from "@/components/ui/surface";
import { BOOT_KEY, useBootstrap } from "@/hooks/useNexora";
import { api, fetcher } from "@/lib/api";
import type { AutomationView, EnergyReport } from "@/lib/apiTypes";
import { estimateWatts, isActive, isSwitchable } from "@/lib/devices";
import { kwh, money, watts } from "@/lib/format";

export default function OfficePage() {
  const { data, property, devicesByRoom, can } = useBootstrap();
  const { data: autos } = useSWR<{ automations: AutomationView[] }>("/api/automations", fetcher);
  const { data: energy } = useSWR<EnergyReport>(can("analytics.view") ? "/api/energy?range=7d" : null, fetcher);
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const confirm = useConfirm();
  if (!data || !property) return <Skeleton className="h-96" />;
  const workRooms = data.rooms.filter((r) => ["office", "meeting", "lobby", "server", "dining"].includes(r.kind));
  if (data.org.type !== "commercial" && !data.rooms.some((r) => r.kind === "meeting" || r.kind === "office"))
    return <EmptyState icon={<Briefcase className="size-5" />} title="No office spaces here" body="Office operations are for commercial organizations. Switch organization, or add workspace and meeting rooms." action={<Link href="/rooms"><Button variant="primary">Manage rooms</Button></Link>} />;

  const meeting = data.rooms.filter((r) => r.kind === "meeting");
  const nonEssentialOn = data.devices.filter((d) => isSwitchable(d) && d.online && d.state.on && !d.essential);
  const essential = data.devices.filter((d) => d.essential);
  const hour = Number(new Date().toLocaleString("en-US", { timeZone: property.timezone, hour: "numeric", hourCycle: "h23" }));
  const dow = new Date().toLocaleDateString("en-US", { timeZone: property.timezone, weekday: "short" });
  const afterHours = hour < 9 || hour >= 19 || dow === "Sat" || dow === "Sun";
  const timeAutos = (autos?.automations ?? []).filter((a) => a.trigger.type === "time");
  const deptMap = new Map<string, number>();
  for (const r of energy?.byRoom ?? []) {
    const dept = data.rooms.find((x) => x.id === r.roomId)?.department ?? "Unassigned";
    deptMap.set(dept, (deptMap.get(dept) ?? 0) + r.kwh);
  }

  const shutdown = async () => {
    if (!nonEssentialOn.length) return toast({ tone: "info", title: "Nothing to switch off", body: "All non-essential loads are already off." });
    if (!(await confirm({ title: "Run after-hours shutdown?", body: <>Turns off <b>{nonEssentialOn.length}</b> non-essential devices across {property.name}. <b>{essential.length}</b> essential loads (server room, access control, safety) stay on.</>, confirmLabel: "Shut down", danger: true }))) return;
    try {
      const r = await api<{ succeeded: number; failed: number }>("/api/devices/bulk", { body: { deviceIds: nonEssentialOn.map((d) => d.id), command: { on: false } } });
      toast({ tone: r.failed ? "warning" : "success", title: `${r.succeeded} devices switched off`, body: r.failed ? `${r.failed} didn't respond` : "Security and safety equipment preserved." });
      await mutate(BOOT_KEY);
    } catch (e) {
      toast({ tone: "error", title: "Shutdown failed", body: (e as Error).message });
    }
  };

  const floorOff = async (floorId: string, name: string) => {
    const ids = data.rooms.filter((r) => r.floorId === floorId).flatMap((r) => devicesByRoom.get(r.id) ?? []).filter((d) => isSwitchable(d) && d.online && d.state.on && !d.essential).map((d) => d.id);
    if (!ids.length) return toast({ tone: "info", title: `${name}: nothing on` });
    if (!(await confirm({ title: `Switch off ${name}?`, body: `${ids.length} non-essential devices on this floor will be turned off.`, confirmLabel: "Switch off", danger: true }))) return;
    const r = await api<{ succeeded: number; failed: number }>("/api/devices/bulk", { body: { deviceIds: ids, command: { on: false } } });
    toast({ tone: r.failed ? "warning" : "success", title: `${name}: ${r.succeeded} off` });
    await mutate(BOOT_KEY);
  };

  return (
    <div>
      <PageHeader eyebrow={property.name} title="Office Operations" description="Working-hour schedules, meeting rooms and after-hours power — with security and safety loads always preserved." actions={can("devices.control") && <Button variant="danger" icon={<Moon className="size-4" />} onClick={shutdown}>After-hours shutdown</Button>} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Occupied spaces" value={workRooms.filter((r) => r.occupied).length} icon={<Users className="size-4" />} tone="cyan" foot={`of ${workRooms.length} work areas`} />
        <Stat label="Meeting rooms in use" value={meeting.filter((r) => r.occupied).length} icon={<Briefcase className="size-4" />} tone="violet" foot={`${meeting.length} rooms`} />
        <Stat label="Live load" value={Math.round(data.devices.reduce((s, d) => s + estimateWatts(d), 0))} suffix=" W" icon={<Zap className="size-4" />} tone="warn" />
        <Stat label={afterHours ? "On after hours" : "Non-essential on"} value={nonEssentialOn.length} icon={<PowerOff className="size-4" />} tone={afterHours && nonEssentialOn.length ? "err" : "mint"} foot={afterHours ? "Outside 9 AM – 7 PM" : "Within working hours"} />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Meeting rooms" subtitle="Live status and one-tap scenes" />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {meeting.map((r) => {
              const devs = devicesByRoom.get(r.id) ?? [];
              const on = devs.filter(isActive).length;
              return (
                <Link key={r.id} href={appHref(`/rooms/${r.id}`)} className="rounded-2xl border border-line bg-surface-2 p-4 transition hover:border-line-strong">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-semibold">{r.name}</span>
                    <Badge tone={r.occupied ? "violet" : "ok"}>{r.occupied ? "In use" : "Free"}</Badge>
                  </div>
                  <div className="mt-2 text-[12px] text-faint">{on}/{devs.length} devices active · {watts(devs.reduce((s, d) => s + estimateWatts(d), 0))}</div>
                </Link>
              );
            })}
            {!meeting.length && <p className="text-[13px] text-muted">No meeting rooms yet.</p>}
          </div>
          {data.scenes.length > 0 && (
            <div className="grid gap-2 border-t border-line p-5 sm:grid-cols-2">
              {data.scenes.map((s) => (
                <SceneTile key={s.id} scene={s} disabled={!can("devices.control")} />
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Working-hour schedules" subtitle="Weekday, weekend and holiday routines" action={<CalendarClock className="size-4 text-faint" />} />
          <ul className="space-y-1 p-3">
            {timeAutos.map((a) => (
              <li key={a.id}>
                <Link href={appHref(`/automations/${a.id}`)} className="flex items-center justify-between gap-3 rounded-xl p-3 hover:bg-surface-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-medium">{a.name}</span>
                    <span className="block truncate text-[12px] text-faint">{triggerSummary(a.trigger, data.devices)}{a.end ? ` → ${a.end.time}` : ""}</span>
                  </span>
                  <Badge tone={a.enabled ? "ok" : "idle"}>{a.enabled ? "On" : "Paused"}</Badge>
                </Link>
              </li>
            ))}
            <li className="p-3 text-[12px] text-faint">For holidays, pause the weekday routine for those dates or add a routine with a property-mode condition (set the property to “Vacation”).</li>
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Floor-wise control" subtitle="Switch off non-essential loads floor by floor" action={<Building2 className="size-4 text-faint" />} />
          <ul className="divide-y divide-[var(--line)] px-5 pb-2">
            {data.floors.map((f) => {
              const devs = data.rooms.filter((r) => r.floorId === f.id).flatMap((r) => devicesByRoom.get(r.id) ?? []);
              const on = devs.filter((d) => d.online && d.state.on).length;
              return (
                <li key={f.id} className="flex items-center justify-between gap-3 py-3.5">
                  <div>
                    <div className="text-[13.5px] font-medium">{f.name}</div>
                    <div className="text-[12px] text-faint">{on}/{devs.length} on · {devs.filter((d) => d.essential).length} protected</div>
                  </div>
                  {can("devices.control") && <Button size="sm" variant="secondary" icon={<PowerOff className="size-3.5" />} onClick={() => floorOff(f.id, f.name)}>Floor off</Button>}
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-2 border-t border-line px-5 py-3 text-[12px] text-faint">
            <ShieldCheck className="size-4 text-warn" /> Protected: {essential.map((d) => d.name).join(", ") || "none"}
          </div>
        </Card>
        <Card>
          <CardHeader title="Department-level energy" subtitle="Last 7 days, by room department" action={energy?.source === "demonstration" ? <DemoBadge label="Demo data" /> : null} />
          <div className="p-5">
            {energy ? <HBarList items={[...deptMap.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, sub: money(value * energy.tariff, energy.currency) }))} format={(v) => kwh(v)} color="var(--violet)" /> : <Skeleton className="h-40" />}
          </div>
        </Card>
      </div>
    </div>
  );
}
