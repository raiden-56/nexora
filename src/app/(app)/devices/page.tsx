"use client";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { CheckSquare, Cpu, Plus, Power, PowerOff, Search, SlidersHorizontal, X } from "lucide-react";
import { DeviceCard } from "@/components/devices/DeviceCard";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/controls";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/surface";
import { BOOT_KEY, useBootstrap } from "@/hooks/useNexora";
import { api } from "@/lib/api";
import { DEVICE_CATALOG, estimateWatts, isActive, isSwitchable } from "@/lib/devices";
import { cx } from "@/lib/format";
import type { Device } from "@/lib/types";

const GROUPS = ["All", "Lighting", "Climate", "Electrical", "Openings", "Security", "Sensors", "Appliances"] as const;
const PAGE = 24;

type BulkResult = { succeeded: number; failed: number; skipped: number; results: { name: string; status: string; detail?: string }[] };

function DevicesInner() {
  const { data, roomById, floorById, can, isLoading } = useBootstrap();
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<(typeof GROUPS)[number]>("All");
  const [status, setStatus] = useState<"all" | "on" | "off" | "offline">("all");
  const [sort, setSort] = useState<"room" | "name" | "power" | "status">("room");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const [busy, setBusy] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const floorId = params.get("floor") ?? "";
  const roomId = params.get("room") ?? "";

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    if (k === "floor") p.delete("room");
    router.replace(`/devices${p.toString() ? `?${p}` : ""}`, { scroll: false });
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    const list = data.devices.filter((d) => {
      const room = roomById.get(d.roomId);
      if (floorId && room?.floorId !== floorId) return false;
      if (roomId && d.roomId !== roomId) return false;
      if (group !== "All" && DEVICE_CATALOG[d.type].group !== group) return false;
      if (status === "on" && !(d.online && isActive(d))) return false;
      if (status === "off" && !(d.online && !isActive(d))) return false;
      if (status === "offline" && d.online) return false;
      if (term && ![d.name, room?.name, DEVICE_CATALOG[d.type].label, d.manufacturer].some((x) => x?.toLowerCase().includes(term))) return false;
      return true;
    });
    const roomOrder = (d: Device) => {
      const r = roomById.get(d.roomId);
      return (floorById.get(r?.floorId ?? "")?.order ?? 0) * 1000 + (r?.order ?? 0);
    };
    return list.sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) : sort === "power" ? estimateWatts(b) - estimateWatts(a) : sort === "status" ? Number(a.online) - Number(b.online) || Number(isActive(b)) - Number(isActive(a)) : roomOrder(a) - roomOrder(b) || a.name.localeCompare(b.name),
    );
  }, [data, q, group, status, sort, floorId, roomId, roomById, floorById]);

  const rooms = data?.rooms.filter((r) => !floorId || r.floorId === floorId) ?? [];
  const selectedDevices = filtered.filter((d) => selected.has(d.id));

  const bulk = async (on: boolean) => {
    const targets = selectedDevices.filter(isSwitchable);
    if (!targets.length) return toast({ tone: "info", title: "Nothing to switch", body: "None of the selected devices support on/off." });
    const essential = targets.filter((d) => d.essential).length;
    const ok = await confirm({
      title: `Turn ${on ? "on" : "off"} ${targets.length} device${targets.length > 1 ? "s" : ""}?`,
      body: (
        <div className="space-y-2">
          <p>This sends a command to every selected device{on ? "" : " and may interrupt anything running on them"}.</p>
          {!on && essential > 0 && <p className="text-warn">{essential} essential / safety device{essential > 1 ? "s are" : " is"} protected and will be skipped.</p>}
        </div>
      ),
      confirmLabel: `Turn ${on ? "on" : "off"}`,
      danger: !on,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await api<BulkResult>("/api/devices/bulk", { body: { deviceIds: targets.map((d) => d.id), command: { on } } });
      toast({
        tone: r.failed ? "warning" : "success",
        title: `${r.succeeded} turned ${on ? "on" : "off"}`,
        body: [r.failed && `${r.failed} failed (${r.results.filter((x) => x.status === "failed").map((x) => x.name).join(", ")})`, r.skipped && `${r.skipped} skipped`].filter(Boolean).join(" · ") || undefined,
      });
      setSelected(new Set());
      setSelecting(false);
      await mutate(BOOT_KEY);
    } catch (e) {
      toast({ tone: "error", title: "Bulk action failed", body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || !data)
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
    );

  const canControl = can("devices.control");
  const filtersActive = group !== "All" || status !== "all" || floorId || roomId;

  return (
    <div>
      <PageHeader
        eyebrow="Device management"
        title="Devices"
        description={`${data.devices.length} devices across ${data.rooms.length} rooms. Controls shown are derived from each device's real capabilities.`}
        actions={
          <>
            {canControl && (
              <Button variant={selecting ? "secondary" : "outline"} icon={<CheckSquare className="size-4" />} onClick={() => (setSelecting((s) => !s), setSelected(new Set()))}>
                {selecting ? "Cancel" : "Select"}
              </Button>
            )}
            {can("integrations.manage") && (
              <Link href="/devices/pair">
                <Button variant="primary" icon={<Plus className="size-4" />}>
                  Pair device
                </Button>
              </Link>
            )}
          </>
        }
      />

      {/* Filters */}
      <div className="mb-5 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input value={q} onChange={(e) => (setQ(e.target.value), setLimit(PAGE))} placeholder="Search by name, room, type or brand" className="pl-10" aria-label="Search devices" />
          </div>
          <Button variant={showFilters || filtersActive ? "secondary" : "outline"} className="lg:hidden" onClick={() => setShowFilters((s) => !s)} icon={<SlidersHorizontal className="size-4" />}>
            <span className="hidden sm:inline">Filters</span>
          </Button>
        </div>
        <div className={cx("grid gap-2 sm:grid-cols-2 lg:grid-cols-4", !showFilters && "hidden lg:grid")}>
          <Select aria-label="Floor" value={floorId} onChange={(e) => setParam("floor", e.target.value)}>
            <option value="">All floors</option>
            {data.floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Room" value={roomId} onChange={(e) => setParam("room", e.target.value)}>
            <option value="">All rooms</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">Any status</option>
            <option value="on">On / active</option>
            <option value="off">Off / idle</option>
            <option value="offline">Offline</option>
          </Select>
          <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="room">Sort by room</option>
            <option value="name">Sort by name</option>
            <option value="status">Offline first</option>
            <option value="power">Highest power</option>
          </Select>
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
          {GROUPS.map((g) => (
            <button key={g} onClick={() => (setGroup(g), setLimit(PAGE))} className={cx("focus-ring h-8 shrink-0 rounded-full px-3.5 text-[12.5px] font-medium transition", group === g ? "bg-text text-bg" : "bg-surface-2 text-muted hover:text-text")}>
              {g}
            </button>
          ))}
          {filtersActive && (
            <button onClick={() => (setGroup("All"), setStatus("all"), router.replace("/devices"))} className="flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[12.5px] text-mint">
              <X className="size-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {selecting && (
        <div className="mb-4 flex items-center justify-between gap-3 text-[13px] text-muted">
          <span>{selected.size} selected</span>
          <button className="font-medium text-mint" onClick={() => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((d) => d.id)))}>
            {selected.size === filtered.length ? "Clear selection" : `Select all ${filtered.length} shown`}
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={<Cpu className="size-5" />} title={data.devices.length ? "No devices match" : "No devices yet"} body={data.devices.length ? "Try a different search or clear the filters." : "Pair a device through an integration, or add simulated devices to explore Nexora."} action={!data.devices.length && can("integrations.manage") ? <Link href="/devices/pair"><Button variant="primary">Pair a device</Button></Link> : undefined} />
      ) : (
        <>
          <motion.div layout className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.slice(0, limit).map((d) => (
              <DeviceCard key={d.id} device={d} roomName={roomById.get(d.roomId)?.name} canControl={canControl} selectable={selecting} selected={selected.has(d.id)} onSelect={(v) => setSelected((s) => { const n = new Set(s); if (v) n.add(d.id); else n.delete(d.id); return n; })} />
            ))}
          </motion.div>
          {filtered.length > limit && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
                Show more ({filtered.length - limit} remaining)
              </Button>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {selecting && selected.size > 0 && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} className="fixed inset-x-3 bottom-[calc(80px+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-lg items-center gap-2 rounded-2xl border border-line-strong bg-surface p-2.5 shadow-2xl lg:bottom-6">
            <span className="num pl-2 text-[13px] font-semibold">{selected.size}</span>
            <span className="flex-1 text-[13px] text-muted">selected</span>
            <Button size="sm" variant="secondary" loading={busy} icon={<Power className="size-3.5" />} onClick={() => bulk(true)}>
              Turn on
            </Button>
            <Button size="sm" variant="danger" loading={busy} icon={<PowerOff className="size-3.5" />} onClick={() => bulk(false)}>
              Turn off
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DevicesPage() {
  return (
    <Suspense>
      <DevicesInner />
    </Suspense>
  );
}
