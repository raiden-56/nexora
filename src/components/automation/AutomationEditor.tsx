"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { ArrowLeft, Copy, History, Play, Save, Trash2 } from "lucide-react";
import { useBootstrap } from "@/hooks/useNexora";
import { api, fetcher } from "@/lib/api";
import type { AutomationView } from "@/lib/apiTypes";
import { timeIn } from "@/lib/format";
import type { Execution } from "@/lib/types";
import { Button } from "../ui/button";
import { Segmented } from "../ui/controls";
import { useConfirm, useToast } from "../ui/feedback";
import { Card, CardHeader, Skeleton } from "../ui/surface";
import { AutomationBuilder, emptyDraft, validateDraft, type Draft } from "./AutomationBuilder";
import { ExecutionList } from "./ExecutionList";

/** Shared create / edit screen. Desktop: builder + history side by side. Phone: tabs. */
export function AutomationEditor({ id }: { id?: string }) {
  const { data: boot, property, can } = useBootstrap();
  const { data: existing, mutate } = useSWR<{ automation: AutomationView; executions: Execution[] }>(id ? `/api/automations/${id}` : null, fetcher, { refreshInterval: 8000 });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<"build" | "history">("build");
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  if (!boot || !property || (id && !existing)) return <Skeleton className="h-[640px]" />;
  const current: Draft =
    draft ??
    (existing
      ? (({ name, description, propertyId, enabled, trigger, conditions, actions, end, onUnreachable }) => ({ name, description, propertyId, enabled, trigger, conditions, actions, end, onUnreachable }))(existing.automation)
      : emptyDraft(property.id));
  const devices = boot.devices.filter((d) => d.propertyId === current.propertyId);
  const manage = can("automations.manage");
  const dirty = draft !== null;

  const save = async () => {
    const err = validateDraft(current, devices);
    if (err) return toast({ tone: "warning", title: "Almost there", body: err });
    setSaving(true);
    try {
      if (id) {
        await api(`/api/automations/${id}`, { method: "PATCH", body: current });
        setDraft(null);
        await mutate();
        toast({ tone: "success", title: "Automation saved", body: current.enabled ? "The scheduler picks up changes immediately." : "Saved as paused." });
      } else {
        const created = await api<AutomationView>("/api/automations", { body: current });
        toast({ tone: "success", title: `${created.name} created`, body: created.next[0] ? `Next run ${timeIn(created.next[0].at, property.timezone, { weekday: "short" })}` : "Ready to run." });
        router.push(`/automations/${created.id}`);
      }
    } catch (e) {
      toast({ tone: "error", title: "Couldn't save", body: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const run = async () => {
    if (!id) return;
    if (dirty && !(await confirm({ title: "Run the saved version?", body: "You have unsaved changes. Running now uses the last saved version.", confirmLabel: "Run saved version" }))) return;
    setRunning(true);
    try {
      const e = await api<Execution>(`/api/automations/${id}/run`, { method: "POST" });
      toast({ tone: e.status === "success" ? "success" : e.status === "skipped" ? "info" : "warning", title: `Run ${e.status}`, body: e.steps.filter((s) => s.status !== "success").map((s) => s.detail).filter(Boolean).join(" · ") || `${e.steps.length} steps completed` });
      await mutate();
      setTab("history");
    } catch (err) {
      toast({ tone: "error", title: "Run failed", body: (err as Error).message });
    } finally {
      setRunning(false);
    }
  };

  const remove = async () => {
    if (!id || !(await confirm({ title: `Delete ${current.name}?`, body: "Its schedule stops immediately.", confirmLabel: "Delete", danger: true }))) return;
    await api(`/api/automations/${id}`, { method: "DELETE" });
    toast({ tone: "success", title: "Automation deleted" });
    router.push("/automations");
  };

  const history = (
    <Card className="overflow-hidden">
      <CardHeader title="Execution history" subtitle="Every run with per-device results" action={<History className="size-4 text-faint" />} />
      <div className="mt-3 max-h-[70vh] overflow-y-auto border-t border-line">
        <ExecutionList executions={existing?.executions ?? []} empty="This automation hasn't run yet." />
      </div>
    </Card>
  );

  return (
    <div>
      <Link href="/automations" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-text">
        <ArrowLeft className="size-4" /> Automations
      </Link>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="text-eyebrow mb-2">{id ? "Edit automation" : "New automation"} · {property.name}</div>
          <h1 className="text-display truncate text-[26px] sm:text-[30px]">{current.name || "Untitled automation"}</h1>
          {existing?.automation.next[0] && current.enabled && <p className="mt-1 text-[13px] text-muted">Next run {timeIn(existing.automation.next[0].at, property.timezone, { weekday: "long" })} ({property.timezone.replace(/_/g, " ")})</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {id && (
            <Button variant="outline" icon={<Play className="size-4" />} loading={running} onClick={run}>
              Run now
            </Button>
          )}
          {id && manage && (
            <Button
              variant="outline"
              icon={<Copy className="size-4" />}
              onClick={async () => {
                const c = await api<AutomationView>(`/api/automations/${id}/duplicate`, { method: "POST" });
                router.push(`/automations/${c.id}`);
              }}
            >
              Duplicate
            </Button>
          )}
          {id && manage && (
            <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={remove}>
              <span className="hidden sm:inline">Delete</span>
            </Button>
          )}
          {manage && (
            <Button variant="primary" icon={<Save className="size-4" />} loading={saving} disabled={!!id && !dirty} onClick={save}>
              {id ? "Save changes" : "Create automation"}
            </Button>
          )}
        </div>
      </div>

      {id && (
        <div className="mb-4 xl:hidden">
          <Segmented label="Section" value={tab} onChange={setTab} options={[{ value: "build", label: "Builder" }, { value: "history", label: `History (${existing?.executions.length ?? 0})` }]} />
        </div>
      )}

      <div className={id ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]" : "mx-auto max-w-3xl"}>
        <div className={id && tab !== "build" ? "hidden xl:block" : ""}>
          <fieldset disabled={!manage} className="min-w-0">
            <AutomationBuilder draft={current} setDraft={setDraft} devices={devices} rooms={boot.rooms} scenes={boot.scenes} />
          </fieldset>
        </div>
        {id && <div className={tab !== "history" ? "hidden xl:block" : ""}>{history}</div>}
      </div>
    </div>
  );
}
