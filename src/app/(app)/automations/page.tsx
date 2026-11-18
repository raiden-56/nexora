"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { Copy, MoreHorizontal, Pencil, Play, Plus, Trash2, Workflow } from "lucide-react";
import { triggerSummary, TriggerIcon } from "@/components/automation/AutomationBuilder";
import { Button, IconButton } from "@/components/ui/button";
import { Segmented, Switch } from "@/components/ui/controls";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { MenuItem, Popover } from "@/components/ui/overlay";
import { Badge, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/surface";
import { useBootstrap } from "@/hooks/useNexora";
import { api, fetcher } from "@/lib/api";
import type { AutomationView } from "@/lib/apiTypes";
import type { Execution } from "@/lib/types";
import { relTime, timeIn } from "@/lib/format";

export default function AutomationsPage() {
  const { data: boot, property, can } = useBootstrap();
  const { data, mutate } = useSWR<{ automations: AutomationView[] }>("/api/automations", fetcher, { refreshInterval: 10000 });
  const [filter, setFilter] = useState<"all" | "active" | "paused">("all");
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const manage = can("automations.manage");

  if (!data || !boot) return <Skeleton className="h-96" />;
  const list = data.automations.filter((a) => (filter === "all" ? true : filter === "active" ? a.enabled : !a.enabled));
  const tz = property?.timezone ?? "UTC";

  const toggle = async (a: AutomationView, enabled: boolean) => {
    await mutate({ automations: data.automations.map((x) => (x.id === a.id ? { ...x, enabled } : x)) }, { revalidate: false });
    try {
      await api(`/api/automations/${a.id}`, { method: "PATCH", body: { enabled } });
      toast({ tone: "success", title: `${a.name} ${enabled ? "resumed" : "paused"}`, body: enabled ? "It will run at its next scheduled time." : "No future executions until you resume it." });
    } catch (e) {
      toast({ tone: "error", title: "Couldn't update", body: (e as Error).message });
    }
    void mutate();
  };
  const run = async (a: AutomationView) => {
    try {
      const e = await api<Execution>(`/api/automations/${a.id}/run`, { method: "POST" });
      toast({ tone: e.status === "success" ? "success" : e.status === "skipped" ? "info" : "warning", title: `${a.name}: ${e.status}`, body: e.steps.find((s) => s.status !== "success")?.detail ?? `${e.steps.length} steps completed` });
      void mutate();
    } catch (err) {
      toast({ tone: "error", title: "Run failed", body: (err as Error).message });
    }
  };
  const duplicate = async (a: AutomationView) => {
    try {
      const copy = await api<AutomationView>(`/api/automations/${a.id}/duplicate`, { method: "POST" });
      toast({ tone: "success", title: "Duplicated", body: `${copy.name} was created paused.` });
      void mutate();
    } catch (err) {
      toast({ tone: "error", title: "Couldn't duplicate", body: (err as Error).message });
    }
  };
  const remove = async (a: AutomationView) => {
    if (!(await confirm({ title: `Delete ${a.name}?`, body: "Its schedule stops immediately. Execution history is kept.", confirmLabel: "Delete", danger: true }))) return;
    try {
      await api(`/api/automations/${a.id}`, { method: "DELETE" });
      void mutate();
      toast({ tone: "success", title: `${a.name} deleted` });
    } catch (err) {
      toast({ tone: "error", title: "Couldn't delete", body: (err as Error).message });
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={property?.name}
        title="Automations"
        description="Rules run on the Nexora server scheduler in the property's timezone — they keep working with every browser closed."
        actions={manage && <Link href="/automations/new"><Button variant="primary" icon={<Plus className="size-4" />}>New automation</Button></Link>}
      />
      <div className="mb-5 flex items-center justify-between gap-3">
        <Segmented label="Filter" value={filter} onChange={setFilter} options={[{ value: "all", label: `All ${data.automations.length}` }, { value: "active", label: "Active" }, { value: "paused", label: "Paused" }]} />
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<Workflow className="size-5" />} title="No automations here" body="Create a routine like “Evening Comfort” — lights on at 6:30 PM, AC only if someone's home." action={manage && <Link href="/automations/new"><Button variant="primary">Create automation</Button></Link>} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((a) => (
            <Card key={a.id} className="group flex flex-col p-4 transition hover:border-line-strong sm:p-5">
              <div className="flex items-start gap-3">
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${a.enabled ? "bg-[color-mix(in_srgb,var(--mint)_14%,transparent)] text-mint" : "bg-surface-3 text-faint"}`}>
                  <TriggerIcon t={a.trigger} />
                </span>
                <button className="min-w-0 flex-1 text-left" onClick={() => router.push(`/automations/${a.id}`)}>
                  <div className="truncate text-[15px] font-semibold group-hover:underline">{a.name}</div>
                  <div className="truncate text-[12.5px] text-muted">{triggerSummary(a.trigger, boot.devices)}{a.end ? ` → ends ${a.end.time}` : ""}</div>
                </button>
                <Switch label={a.enabled ? "Pause" : "Resume"} checked={a.enabled} disabled={!manage} onChange={(v) => toggle(a, v)} />
              </div>
              {a.description && <p className="mt-3 line-clamp-2 text-[12.5px] text-faint">{a.description}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3.5 text-[12px]">
                <Badge tone="neutral">{a.actions.length} action{a.actions.length > 1 ? "s" : ""}</Badge>
                {a.conditions.length > 0 && <Badge tone="violet">{a.conditions.length} condition{a.conditions.length > 1 ? "s" : ""}</Badge>}
                {a.lastStatus && <Badge tone={a.lastStatus === "success" ? "ok" : a.lastStatus === "partial" ? "warn" : a.lastStatus === "failed" ? "err" : "idle"}>Last: {a.lastStatus} · {relTime(a.lastRunAt)}</Badge>}
                <span className="ml-auto text-faint">{a.enabled && a.next[0] ? `Next ${timeIn(a.next[0].at, tz, { weekday: "short" })}` : a.enabled ? "Event-driven" : "Paused"}</span>
                <Popover
                  className="w-48"
                  trigger={({ toggle: t }) => (
                    <IconButton label={`${a.name} actions`} onClick={t} className="size-8">
                      <MoreHorizontal className="size-4" />
                    </IconButton>
                  )}
                >
                  {(close) => (
                    <div className="py-1">
                      <MenuItem icon={<Play className="size-4" />} onClick={() => (close(), void run(a))}>Run now</MenuItem>
                      {manage && <MenuItem icon={<Pencil className="size-4" />} onClick={() => (close(), router.push(`/automations/${a.id}`))}>Edit</MenuItem>}
                      {manage && <MenuItem icon={<Copy className="size-4" />} onClick={() => (close(), void duplicate(a))}>Duplicate</MenuItem>}
                      {manage && <MenuItem danger icon={<Trash2 className="size-4" />} onClick={() => (close(), void remove(a))}>Delete</MenuItem>}
                    </div>
                  )}
                </Popover>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
