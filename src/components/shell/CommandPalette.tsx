"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { CornerDownLeft, DoorOpen, Search, Sparkles, Workflow } from "lucide-react";
import { fetcher } from "@/lib/api";
import { DEVICE_CATALOG } from "@/lib/devices";
import { cx } from "@/lib/format";
import type { Automation } from "@/lib/types";
import { useBootstrap } from "@/hooks/useNexora";
import { DeviceGlyph } from "../devices/DeviceIcon";
import { ALL_ITEMS } from "./nav";

interface Hit {
  id: string;
  group: string;
  label: string;
  sub: string;
  href: string;
  icon: React.ReactNode;
}

/** Global search across devices, rooms, scenes, automations and pages of the active property. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, roomById } = useBootstrap();
  const { data: autos } = useSWR<{ automations: Automation[] }>(open ? "/api/automations" : null, fetcher);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => input.current?.focus(), 30);
    }
  }, [open]);

  const hits = useMemo<Hit[]>(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    const m = (...s: (string | undefined)[]) => !term || s.some((x) => x?.toLowerCase().includes(term));
    const out: Hit[] = [];
    for (const d of data.devices) {
      const room = roomById.get(d.roomId)?.name;
      if (m(d.name, room, DEVICE_CATALOG[d.type].label)) out.push({ id: d.id, group: "Devices", label: d.name, sub: `${DEVICE_CATALOG[d.type].label} · ${room ?? ""}`, href: `/devices/${d.id}`, icon: <DeviceGlyph device={d} size="sm" /> });
    }
    for (const r of data.rooms) if (m(r.name)) out.push({ id: r.id, group: "Rooms", label: r.name, sub: data.floors.find((f) => f.id === r.floorId)?.name ?? "", href: `/rooms/${r.id}`, icon: <span className="flex size-8 items-center justify-center rounded-xl bg-surface-3 text-cyan"><DoorOpen className="size-4" /></span> });
    for (const s of data.scenes) if (m(s.name, s.description)) out.push({ id: s.id, group: "Scenes", label: s.name, sub: s.description, href: `/scenes?focus=${s.id}`, icon: <span className="flex size-8 items-center justify-center rounded-xl bg-surface-3 text-violet"><Sparkles className="size-4" /></span> });
    for (const a of autos?.automations ?? []) if (m(a.name, a.description)) out.push({ id: a.id, group: "Automations", label: a.name, sub: a.description, href: `/automations/${a.id}`, icon: <span className="flex size-8 items-center justify-center rounded-xl bg-surface-3 text-mint"><Workflow className="size-4" /></span> });
    for (const p of ALL_ITEMS) if (term && m(p.label)) out.push({ id: p.href, group: "Pages", label: p.label, sub: "Go to page", href: p.href, icon: <span className="flex size-8 items-center justify-center rounded-xl bg-surface-3 text-muted"><p.icon className="size-4" /></span> });
    return out.slice(0, term ? 40 : 12);
  }, [data, q, autos, roomById]);

  const go = (h: Hit) => {
    onClose();
    router.push(h.href);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[85] flex items-start justify-center px-3 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-[12vh]">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-label="Search"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-xl overflow-hidden rounded-[22px] border border-line-strong bg-surface shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-5 text-faint" />
              <input
                ref={input}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setIdx(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") onClose();
                  if (e.key === "ArrowDown") (e.preventDefault(), setIdx((i) => Math.min(hits.length - 1, i + 1)));
                  if (e.key === "ArrowUp") (e.preventDefault(), setIdx((i) => Math.max(0, i - 1)));
                  if (e.key === "Enter" && hits[idx]) go(hits[idx]);
                }}
                placeholder="Search devices, rooms, scenes, automations…"
                aria-label="Search"
                className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
              />
              <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[10.5px] text-faint sm:block">Esc</kbd>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {hits.length === 0 && <div className="py-10 text-center text-[13px] text-muted">No matches for &ldquo;{q}&rdquo;</div>}
              {hits.map((h, i) => (
                <div key={h.group + h.id}>
                  {(i === 0 || hits[i - 1].group !== h.group) && <div className="text-eyebrow px-3 pb-1 pt-3">{h.group}</div>}
                  <button onMouseEnter={() => setIdx(i)} onClick={() => go(h)} className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition", i === idx ? "bg-surface-2" : "")}>
                    {h.icon}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{h.label}</span>
                      <span className="block truncate text-[12px] text-faint">{h.sub}</span>
                    </span>
                    {i === idx && <CornerDownLeft className="size-4 text-faint" />}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
