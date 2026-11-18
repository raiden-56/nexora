"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { Users } from "lucide-react";
import { isActive } from "@/lib/devices";
import { cx } from "@/lib/format";
import type { Device, Room } from "@/lib/types";
import { accentFor } from "../devices/DeviceIcon";

export function roomStats(devices: Device[]) {
  return {
    total: devices.length,
    active: devices.filter(isActive).length,
    offline: devices.filter((d) => !d.online).length,
  };
}

/**
 * Interactive architectural floor plan: rooms placed on a 12×8 grid, device markers glow with
 * live state. On phones it becomes a tappable room list instead of a cramped drawing.
 */
export function FloorPlan({ rooms, devicesByRoom, hrefFor = (r) => `/rooms/${r.id}`, showMarkers = true }: { rooms: Room[]; devicesByRoom: Map<string, Device[]>; hrefFor?: (r: Room) => string; showMarkers?: boolean }) {
  if (!rooms.length) return <div className="flex aspect-[12/8] items-center justify-center rounded-2xl border border-dashed border-line-strong text-[13px] text-muted">No rooms on this floor yet.</div>;
  return (
    <>
      <div className="relative hidden aspect-[12/8] w-full overflow-hidden rounded-2xl border border-line bg-[var(--bg-elev)] sm:block">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-70" />
        {rooms.map((r, i) => {
          const devs = devicesByRoom.get(r.id) ?? [];
          const s = roomStats(devs);
          const lit = s.active > 0;
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="absolute p-1"
              style={{ left: `${(r.plan.x / 12) * 100}%`, top: `${(r.plan.y / 8) * 100}%`, width: `${(r.plan.w / 12) * 100}%`, height: `${(r.plan.h / 8) * 100}%` }}
            >
              <Link
                href={hrefFor(r)}
                className={cx("focus-ring group relative flex size-full flex-col justify-between overflow-hidden rounded-xl border p-3 transition-all duration-300", lit ? "border-[color-mix(in_srgb,var(--mint)_35%,transparent)] bg-[color-mix(in_srgb,var(--mint)_6%,var(--surface))]" : "border-line-strong bg-surface hover:border-[var(--muted)]")}
              >
                {lit && <span className="pointer-events-none absolute -bottom-8 -right-8 size-28 rounded-full bg-[color-mix(in_srgb,var(--mint)_16%,transparent)] blur-2xl" />}
                <div className="relative flex items-start justify-between gap-1">
                  <span className="truncate text-[12.5px] font-semibold">{r.name}</span>
                  {r.occupied && <Users className="size-3.5 shrink-0 text-cyan" aria-label="Occupied" />}
                </div>
                {showMarkers &&
                  devs.map((d) => (
                    <span
                      key={d.id}
                      title={`${d.name}${d.online ? "" : " (offline)"}`}
                      className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{ left: `${(d.marker?.x ?? 0.5) * 100}%`, top: `${(d.marker?.y ?? 0.5) * 100}%`, background: accentFor(d), boxShadow: isActive(d) ? `0 0 10px ${accentFor(d)}` : undefined }}
                    />
                  ))}
                <div className="relative flex items-center gap-2 text-[11px] text-muted">
                  <span className="num">{s.active}/{s.total} on</span>
                  {s.offline > 0 && <span className="num text-err">{s.offline} offline</span>}
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:hidden">
        {rooms.map((r) => {
          const s = roomStats(devicesByRoom.get(r.id) ?? []);
          return (
            <Link key={r.id} href={hrefFor(r)} className={cx("rounded-2xl border p-3.5 transition active:scale-[0.98]", s.active ? "border-[color-mix(in_srgb,var(--mint)_35%,transparent)] bg-[color-mix(in_srgb,var(--mint)_6%,var(--surface))]" : "border-line bg-surface")}>
              <div className="flex items-start justify-between gap-1">
                <span className="text-[13px] font-semibold leading-tight">{r.name}</span>
                {r.occupied && <Users className="size-3.5 shrink-0 text-cyan" />}
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11.5px] text-muted">
                <span className="num">
                  {s.active}/{s.total} on
                </span>
                {s.offline > 0 && <span className="num text-err">{s.offline} offline</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
