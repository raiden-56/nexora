"use client";
import { appHref } from "@/lib/routes";
import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { AlertTriangle, ArrowRight, ArrowUpRight, Building2, CalendarClock, Cpu, Gauge, Power, PowerOff, Workflow, WifiOff, Zap } from "lucide-react";
import { AreaChart, BarChart, HBarList } from "@/components/charts";
import { DeviceGlyph } from "@/components/devices/DeviceIcon";
import { FloorPlan } from "@/components/property/FloorPlan";
import { SceneTile } from "@/components/scenes/SceneTile";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { useToast } from "@/components/ui/feedback";
import { Badge, Card, CardHeader, DemoBadge, EmptyState, Skeleton, Stat } from "@/components/ui/surface";
import { useBootstrap, BOOT_KEY } from "@/hooks/useNexora";
import { api, fetcher } from "@/lib/api";
import type { ActivityPage, AutomationView, EnergyReport, ExecutionList } from "@/lib/apiTypes";
import { isActive, isSensor } from "@/lib/devices";
import { cx, kwh, money, relTime, timeIn, watts } from "@/lib/format";
import type { PropertyMode } from "@/lib/types";

const MODES: { value: PropertyMode; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "away", label: "Away" },
  { value: "night", label: "Night" },
  { value: "vacation", label: "Vacation" },
];

export default function OverviewPage() {
  const { data, property, devicesByRoom, can, isLoading } = useBootstrap();
  const { data: autos } = useSWR<{ automations: AutomationView[] }>("/api/automations", fetcher, { refreshInterval: 15000 });
  const { data: execs } = useSWR<ExecutionList>("/api/executions?limit=8", fetcher, { refreshInterval: 10000 });
  const { data: activity } = useSWR<ActivityPage>("/api/activity?size=7", fetcher, { refreshInterval: 8000 });
  const canEnergy = can("analytics.view");
  const { data: e24 } = useSWR<EnergyReport>(canEnergy ? "/api/energy?range=24h" : null, fetcher, { refreshInterval: 60000 });
  const { data: e7 } = useSWR<EnergyReport>(canEnergy ? "/api/energy?range=7d" : null, fetcher, { refreshInterval: 120000 });
  const { data: e30 } = useSWR<EnergyReport>(canEnergy ? "/api/energy?range=30d" : null, fetcher, { refreshInterval: 300000 });
  const [floorId, setFloorId] = useState<string | null>(null);
  const { mutate } = useSWRConfig();
  const toast = useToast();

  const stats = useMemo(() => {
    const ds = data?.devices ?? [];
    const ctrl = ds.filter((d) => !isSensor(d));
    return {
      total: ds.length,
      on: ctrl.filter((d) => d.online && isActive(d)).length,
      off: ctrl.filter((d) => d.online && !isActive(d)).length,
      offline: ds.filter((d) => !d.online).length,
    };
  }, [data]);

  if (isLoading || !data) return <OverviewSkeleton />;
  if (!property)
    return <EmptyState icon={<Building2 className="size-5" />} title="No property yet" body="Create your first property to start adding rooms and devices." action={<Link href="/properties/new"><Button variant="primary">Add property</Button></Link>} />;

  const floors = data.floors;
  const activeFloor = floors.find((f) => f.id === floorId) ?? floors[0];
  const floorRooms = data.rooms.filter((r) => r.floorId === activeFloor?.id);
  const activeAutos = (autos?.automations ?? []).filter((a) => a.enabled);
  const upcoming = activeAutos.flatMap((a) => a.next.map((n) => ({ ...n, name: a.name, id: a.id }))).sort((a, b) => a.at.localeCompare(b.at)).slice(0, 4);
  const failures = (execs?.executions ?? []).filter((e) => e.status === "failed" || e.status === "partial").slice(0, 2);
  const allSim = data.devices.every((d) => d.provider === "simulated");

  const setMode = async (mode: PropertyMode) => {
    try {
      await api(`/api/properties/${property.id}`, { method: "PATCH", body: { mode } });
      await mutate(BOOT_KEY);
      toast({ tone: "success", title: `${property.name} set to ${mode}`, body: "Automations with mode conditions will follow this." });
    } catch (e) {
      toast({ tone: "error", title: "Couldn't change mode", body: (e as Error).message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="text-eyebrow mb-2 flex items-center gap-2">
            {data.org.name} {allSim && <DemoBadge />}
          </div>
          <h1 className="text-display text-[28px] sm:text-[34px]">{property.name}</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {property.address || "No address"} · {property.timezone.replace(/_/g, " ")}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 sm:items-end">
          <span className="text-eyebrow">Property mode</span>
          <Segmented label="Property mode" value={property.mode} options={MODES} onChange={setMode} className={cx(!can("devices.control") && "pointer-events-none opacity-50")} />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        <Stat label="Connected devices" value={stats.total} icon={<Cpu className="size-4" />} tone="cyan" foot={`${data.rooms.length} rooms · ${floors.length} floors`} />
        <Stat label="Devices on" value={stats.on} icon={<Power className="size-4" />} tone="mint" foot="Active right now" />
        <Stat label="Devices off" value={stats.off} icon={<PowerOff className="size-4" />} tone="idle" foot="Online & idle" />
        <Stat label="Offline" value={stats.offline} icon={<WifiOff className="size-4" />} tone={stats.offline ? "err" : "ok"} foot={stats.offline ? "Needs attention" : "All responding"} />
        <Stat label="Active automations" value={activeAutos.length} icon={<Workflow className="size-4" />} tone="violet" foot={`${(autos?.automations.length ?? 0) - activeAutos.length} paused`} />
        <Stat label="Properties" value={data.properties.length} icon={<Building2 className="size-4" />} tone="cyan" foot={data.org.type[0].toUpperCase() + data.org.type.slice(1)} />
        <Stat label="Live power" value={e24?.liveWatts ?? 0} icon={<Zap className="size-4" />} tone="warn" suffix=" W" foot={e24?.source === "demonstration" ? "Demonstration estimate" : "From device telemetry"} />
      </div>

      {/* Scenes */}
      {data.scenes.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Quick scenes</h2>
            <Link href="/scenes" className="text-[12.5px] font-medium text-mint hover:underline">
              Manage scenes
            </Link>
          </div>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0">
            {data.scenes.map((s) => (
              <SceneTile key={s.id} scene={s} compact disabled={!can("devices.control")} />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        {/* Interactive property overview */}
        <Card className="overflow-hidden">
          <CardHeader
            title="Property overview"
            subtitle={`${data.buildings[0]?.name ?? "Building"} · tap a room to control it`}
            action={
              <Link href="/rooms" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-mint hover:underline">
                Floors & rooms <ArrowUpRight className="size-3.5" />
              </Link>
            }
          />
          <div className="px-5 pt-4">
            {floors.length > 1 && <Segmented label="Floor" size="sm" value={activeFloor?.id ?? ""} options={floors.map((f) => ({ value: f.id, label: f.name }))} onChange={setFloorId} className="max-w-full overflow-x-auto scrollbar-none" />}
          </div>
          <div className="p-5">
            <FloorPlan rooms={floorRooms} devicesByRoom={devicesByRoom} />
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] text-faint">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-mint" /> Active</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-idle" /> Idle</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-err" /> Offline</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-warn" /> Sensor / lock attention</span>
            </div>
          </div>
        </Card>

        {/* Automation overview */}
        <Card className="flex flex-col">
          <CardHeader title="Automation overview" subtitle="Executed by the Nexora scheduler — no browser needed" action={<Link href="/automations"><Button size="sm" variant="ghost">All <ArrowRight className="size-3.5" /></Button></Link>} />
          <div className="space-y-5 p-5">
            {failures.map((f) => (
              <Link key={f.id} href={f.automationId ? appHref(`/automations/${f.automationId}`) : "/scenes"} className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--warn)_30%,transparent)] bg-[color-mix(in_srgb,var(--warn)_8%,transparent)] p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
                <div className="min-w-0 text-[12.5px]">
                  <div className="font-semibold text-text">
                    {f.name} {f.status === "failed" ? "failed" : "partially failed"}
                  </div>
                  <div className="truncate text-muted">{f.steps.find((s) => s.status === "failed")?.detail ?? "See execution history"} · {relTime(f.startedAt)}</div>
                </div>
              </Link>
            ))}
            <div>
              <div className="text-eyebrow mb-2.5 flex items-center gap-1.5"><CalendarClock className="size-3.5" /> Upcoming</div>
              {upcoming.length === 0 && <p className="text-[13px] text-muted">No scheduled actions in the next week.</p>}
              <ul className="space-y-2">
                {upcoming.map((u, i) => (
                  <li key={i}>
                    <Link href={appHref(`/automations/${u.id}`)} className="flex items-center justify-between gap-3 rounded-xl px-1 py-1 text-[13px] hover:bg-surface-2">
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{u.name}</span>
                        {u.phase === "end" && <span className="text-faint"> · end</span>}
                      </span>
                      <span className="num shrink-0 text-[12px] text-muted">{timeIn(u.at, property.timezone, { weekday: "short" })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-eyebrow mb-2.5">Recently executed</div>
              <ul className="space-y-2.5">
                {(execs?.executions ?? []).slice(0, 4).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate">{e.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-[11.5px] text-faint">{relTime(e.startedAt)}</span>
                      <Badge tone={e.status === "success" ? "ok" : e.status === "partial" ? "warn" : e.status === "failed" ? "err" : "idle"}>{e.status}</Badge>
                    </span>
                  </li>
                ))}
                {execs && !execs.executions.length && <li className="text-[13px] text-muted">Nothing has run yet.</li>}
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {canEnergy && (
        <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
          <Card>
            <CardHeader
              title="Energy today"
              subtitle={e24 ? `${kwh(e24.totalKwh)} in the last 24h · ${money(e24.cost, e24.currency)}` : "Loading…"}
              action={e24?.source === "demonstration" ? <DemoBadge label="Demo data" /> : null}
            />
            <div className="p-5 pt-3">{e24 ? <AreaChart data={e24.series} series={[{ key: "kwh", label: "Today", color: "var(--mint)" }, { key: "previousKwh", label: "Yesterday", color: "var(--blue)", dashed: true }]} format={(v) => kwh(v)} /> : <Skeleton className="h-[220px]" />}</div>
          </Card>
          <Card>
            <CardHeader title="This week vs last" subtitle={e7 ? `${e7.changePct > 0 ? "+" : ""}${e7.changePct}% · projected ${money(e30?.projectedMonthlyCost ?? e7.projectedMonthlyCost, e7.currency)}/month` : "Loading…"} action={<Link href="/energy"><Button size="sm" variant="ghost"><Gauge className="size-3.5" /> Analytics</Button></Link>} />
            <div className="p-5 pt-3">{e7 ? <BarChart data={e7.series} valueKey="kwh" compareKey="previousKwh" format={(v) => kwh(v)} valueLabel="This week" compareLabel="Last week" height={180} /> : <Skeleton className="h-[180px]" />}</div>
            {e7 && (
              <div className="border-t border-line p-5">
                <div className="text-eyebrow mb-3">Top consumers · 7 days</div>
                <HBarList items={e7.byDevice.slice(0, 4).map((d) => ({ label: d.name, sub: d.room, value: d.kwh }))} format={(v) => kwh(v)} />
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Device activity */}
      <Card>
        <CardHeader title="Recent device activity" subtitle="Who changed what, from where" action={<Link href="/activity"><Button size="sm" variant="ghost">Full log <ArrowRight className="size-3.5" /></Button></Link>} />
        <ul className="divide-y divide-[var(--line)] px-2 pb-2 pt-2">
          {(activity?.rows ?? []).map((a) => {
            const dev = data.devices.find((d) => d.id === a.deviceId);
            return (
              <li key={a.id}>
                <Link href={dev ? appHref(`/devices/${dev.id}`) : "/activity"} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-2">
                  {dev ? <DeviceGlyph device={dev} size="sm" /> : <span className="size-8 rounded-xl bg-surface-3" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px]">
                      <span className="font-semibold">{a.deviceName ?? "System"}</span> <span className="text-muted">· {a.action}</span>
                    </div>
                    <div className="truncate text-[12px] text-faint">
                      {a.previous && a.next ? `${a.previous} → ${a.next}` : a.next ?? ""} · {a.userName ?? (a.source === "automation" ? "Automation" : a.source === "scene" ? "Scene" : "System")}
                    </div>
                  </div>
                  <span className="hidden shrink-0 text-[12px] text-faint sm:block">{relTime(a.at)}</span>
                </Link>
              </li>
            );
          })}
          {activity && !activity.rows.length && <li className="p-6 text-center text-[13px] text-muted">No activity yet.</li>}
        </ul>
      </Card>
      {e24 && <p className="text-center text-[11.5px] text-faint">Live power {watts(e24.liveWatts)} · energy figures {e24.source === "demonstration" ? "are a labelled demonstration profile for simulated devices" : "come from device telemetry"}.</p>}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-72" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-[116px]" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Skeleton className="h-[460px]" />
        <Skeleton className="h-[460px]" />
      </div>
    </div>
  );
}
