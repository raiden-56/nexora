"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { Lock, LockOpen, WifiOff } from "lucide-react";
import { describeState, DEVICE_CATALOG, estimateWatts, has } from "@/lib/devices";
import { cx, relTime, watts } from "@/lib/format";
import type { Device } from "@/lib/types";
import { useDeviceCommand } from "@/hooks/useNexora";
import { Checkbox, Switch } from "../ui/controls";
import { DemoBadge } from "../ui/surface";
import { useConfirm } from "../ui/feedback";
import { accentFor, DeviceGlyph } from "./DeviceIcon";

export function DeviceCard({
  device,
  roomName,
  canControl,
  selectable,
  selected,
  onSelect,
  compact,
  onOpen,
}: {
  device: Device;
  roomName?: string;
  canControl: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (v: boolean) => void;
  compact?: boolean;
  /** open an in-place control panel instead of navigating */
  onOpen?: () => void;
}) {
  const send = useDeviceCommand();
  const confirm = useConfirm();
  const power = has(device, "power_meter") || device.provider === "simulated" ? estimateWatts(device) : null;
  const accent = accentFor(device);

  const quick = () => {
    if (!device.online) return <span className="inline-flex items-center gap-1 text-xs font-medium text-err"><WifiOff className="size-3.5" /> Offline</span>;
    if (has(device, "onoff")) return <Switch size="sm" label={`Toggle ${device.name}`} checked={!!device.state.on} disabled={!canControl} onChange={(v) => send(device, { on: v })} />;
    if (has(device, "position"))
      return (
        <div className="flex gap-1" onClick={(e) => e.preventDefault()}>
          {[
            ["Open", 100],
            ["Close", 0],
          ].map(([l, p]) => (
            <button
              key={l}
              disabled={!canControl}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                send(device, { position: p as number });
              }}
              className={cx("focus-ring h-7 rounded-lg px-2.5 text-xs font-medium transition disabled:opacity-40", device.state.position === p ? "bg-mint text-mint-ink" : "bg-surface-3 text-text-2 hover:text-text")}
            >
              {l}
            </button>
          ))}
        </div>
      );
    if (has(device, "lock"))
      return (
        <button
          disabled={!canControl}
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (device.state.locked && !(await confirm({ title: `Unlock ${device.name}?`, body: "This unlocks a physical door. Make sure someone is expecting it.", confirmLabel: "Unlock", danger: true }))) return;
            send(device, { locked: !device.state.locked });
          }}
          className={cx("focus-ring inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition disabled:opacity-40", device.state.locked ? "bg-surface-3 text-text-2" : "bg-[color-mix(in_srgb,var(--warn)_18%,transparent)] text-warn")}
        >
          {device.state.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
          {device.state.locked ? "Locked" : "Unlocked"}
        </button>
      );
    return null;
  };

  return (
    <motion.div layout="position" whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}>
      <CardShell
        onOpen={onOpen}
        href={`/devices/${device.id}`}
        className={cx(
          "focus-ring group card relative flex h-full flex-col overflow-hidden p-4 transition-colors hover:border-line-strong",
          selected && "border-[var(--mint)]! ring-1 ring-[var(--mint)]",
          !device.online && "opacity-80",
        )}
      >
        <span className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" style={{ background: `color-mix(in srgb, ${accent} 22%, transparent)` }} />
        <div className="flex items-start justify-between gap-2">
          <DeviceGlyph device={device} size={compact ? "sm" : "md"} />
          <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
            {device.provider === "simulated" && !selectable && <DemoBadge label="SIM" />}
            {selectable && <Checkbox label={`Select ${device.name}`} checked={!!selected} onChange={(v) => onSelect?.(v)} />}
          </div>
        </div>
        <div className="mt-3 min-w-0">
          <div className="truncate text-[14px] font-semibold leading-tight">{device.name}</div>
          <div className="mt-0.5 truncate text-[12px] text-muted">
            {DEVICE_CATALOG[device.type].label}
            {roomName ? ` · ${roomName}` : ""}
          </div>
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div className="min-w-0">
            <div className={cx("truncate text-[13px] font-medium", device.online ? "text-text-2" : "text-err")}>{describeState(device)}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-faint">
              {power !== null && device.online && <span className="num">{watts(power)}</span>}
              {power !== null && device.online && <span>·</span>}
              <span>{relTime(device.lastSeenAt)}</span>
            </div>
          </div>
          <div onClick={(e) => e.preventDefault()}>{quick()}</div>
        </div>
      </CardShell>
    </motion.div>
  );
}

function CardShell({ href, onOpen, children, className }: { href: string; onOpen?: () => void; children: React.ReactNode; className?: string }) {
  if (!onOpen)
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())} className={cx(className, "cursor-pointer")}>
      {children}
    </div>
  );
}
