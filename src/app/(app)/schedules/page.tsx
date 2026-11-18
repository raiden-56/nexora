"use client";
import Link from "next/link";
import useSWR from "swr";
import { CalendarClock, CircleCheck, Moon, Play, Server, Sunrise, Sunset } from "lucide-react";
import { ExecutionList } from "@/components/automation/ExecutionList";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Skeleton, StatusDot } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { useBootstrap } from "@/hooks/useNexora";
import { fetcher } from "@/lib/api";
import type { ExecutionList as EL } from "@/lib/apiTypes";
import { relTime } from "@/lib/format";
import type { Trigger } from "@/lib/types";

interface Item {
  automationId: string;
  name: string;
  enabled: boolean;
  phase: "start" | "end";
  at: string;
  trigger: Trigger;
  end: { time: string } | null;
}

export default function SchedulesPage() {
  const { property, can } = useBootstrap();
  const { data } = useSWR<{ items: Item[]; timezone: string; schedulerLastTick: string | null }>("/api/schedules", fetcher, { refreshInterval: 15000 });
  const { data: execs } = useSWR<EL>("/api/executions?limit=30", fetcher, { refreshInterval: 10000 });
  if (!data || !property) return <Skeleton className="h-96" />;
  const tz = data.timezone;
  const healthy = data.schedulerLastTick && Date.now() - Date.parse(data.schedulerLastTick) < 60_000;

  const groups = new Map<string, Item[]>();
  for (const it of data.items) {
    const day = new Date(it.at).toLocaleDateString("en-IN", { timeZone: tz, weekday: "long", day: "numeric", month: "short" });
    groups.set(day, [...(groups.get(day) ?? []), it]);
  }
  const todayLabel = new Date().toLocaleDateString("en-IN", { timeZone: tz, weekday: "long", day: "numeric", month: "short" });

  return (
    <div>
      <PageHeader
        eyebrow={property.name}
        title="Schedules"
        description={`Everything scheduled for the next 7 days, in ${tz.replace(/_/g, " ")} time. Daylight-saving shifts are handled per property.`}
        actions={can("automations.manage") && <Link href="/automations/new"><Button variant="primary" icon={<CalendarClock className="size-4" />}>New schedule</Button></Link>}
      />

      <Card className="mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-surface-2 text-cyan">
          <Server className="size-5" />
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-[14px] font-semibold">
            <StatusDot tone={healthy ? "ok" : "warn"} pulse={!!healthy} /> Server scheduler {healthy ? "running" : "waiting for next tick"}
          </div>
          <div className="text-[12.5px] text-muted">Last tick {relTime(data.schedulerLastTick)} · ticks every 15 s · runs whether or not this page is open · duplicate-execution protected</div>
        </div>
        <Badge tone="cyan">{data.items.filter((i) => i.enabled).length} upcoming</Badge>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          {data.items.length === 0 && <EmptyState icon={<CalendarClock className="size-5" />} title="Nothing scheduled" body="Create a time, sunrise or sunset automation to see it here." />}
          {[...groups.entries()].map(([day, items]) => (
            <div key={day}>
              <div className="text-eyebrow mb-2.5">{day === todayLabel ? `Today · ${day}` : day}</div>
              <Card className="divide-y divide-[var(--line)]">
                {items.map((it, i) => {
                  const Icon = it.phase === "end" ? Moon : it.trigger.type === "sunrise" ? Sunrise : it.trigger.type === "sunset" ? Sunset : Play;
                  return (
                    <Link key={i} href={`/automations/${it.automationId}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-surface-2 sm:px-5">
                      <div className="num w-16 shrink-0 font-display text-[15px] font-bold sm:w-20">{new Date(it.at).toLocaleTimeString("en-IN", { timeZone: tz, hour: "numeric", minute: "2-digit" })}</div>
                      <span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ color: it.phase === "end" ? "var(--blue)" : "var(--mint)", background: "var(--surface-2)" }}>
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className={`truncate text-[13.5px] font-medium ${it.enabled ? "" : "text-faint line-through"}`}>{it.name}</div>
                        <div className="text-[12px] text-faint">{it.phase === "end" ? "End of schedule — switch off" : it.trigger.type === "time" ? "Start" : `${it.trigger.type} trigger`}</div>
                      </div>
                      {!it.enabled && <Badge tone="idle">Paused</Badge>}
                    </Link>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>
        <Card className="h-fit overflow-hidden">
          <CardHeader title="Recent executions" subtitle="Scheduler, events and manual runs" action={<CircleCheck className="size-4 text-faint" />} />
          <div className="mt-3 max-h-[70vh] overflow-y-auto border-t border-line">{execs ? <ExecutionList executions={execs.executions} /> : <Skeleton className="m-5 h-40" />}</div>
        </Card>
      </div>
    </div>
  );
}
