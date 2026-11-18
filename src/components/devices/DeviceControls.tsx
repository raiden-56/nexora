"use client";
import { useEffect, useState } from "react";
import { Minus, Pause, Plus, Power, WifiOff } from "lucide-react";
import { motion } from "framer-motion";
import { describeState, has } from "@/lib/devices";
import { cx } from "@/lib/format";
import type { Device, DeviceCommand, HvacMode } from "@/lib/types";
import { useDeviceCommand } from "@/hooks/useNexora";
import { Segmented, Slider, Switch } from "../ui/controls";
import { Button } from "../ui/button";
import { useConfirm } from "../ui/feedback";
import { accentFor, DeviceGlyph } from "./DeviceIcon";

const SWATCHES = ["#69E3C0", "#7DD9F2", "#5B6CFF", "#9C8CF6", "#F27BB8", "#F2B66D", "#F27878", "#FFFFFF"];

function Row({ label, value, children }: { label: string; value?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-medium text-text-2">{label}</span>
        {value !== undefined && <span className="num font-semibold text-text">{value}</span>}
      </div>
      {children}
    </div>
  );
}

/** Keeps a slider's value local while dragging and commits once on release. */
function useLocal(remote: number | undefined, fallback: number) {
  const [v, setV] = useState(remote ?? fallback);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!dragging) setV(remote ?? fallback);
  }, [remote, fallback, dragging]);
  return { v, set: (x: number) => (setDragging(true), setV(x)), done: () => setDragging(false) };
}

/**
 * Renders only the controls the device actually supports, derived from its capability list.
 */
export function DeviceControls({ device, canControl }: { device: Device; canControl: boolean }) {
  const sendRaw = useDeviceCommand();
  const confirm = useConfirm();
  const send = (c: DeviceCommand) => sendRaw(device, c);
  const disabled = !canControl || !device.online;
  const s = device.state;
  const bright = useLocal(s.brightness, 100);
  const ct = useLocal(s.colorTemp, 3000);
  const pos = useLocal(s.position, 0);
  const accent = accentFor(device);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-[22px] border border-line bg-surface-2 p-5">
        <motion.div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full blur-3xl" animate={{ background: `color-mix(in srgb, ${accent} 26%, transparent)` }} transition={{ duration: 0.6 }} />
        <div className="relative flex items-center gap-4">
          <DeviceGlyph device={device} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="text-eyebrow">Current state</div>
            <div className="mt-1 text-[22px] font-bold font-display leading-tight">{describeState(device)}</div>
            {has(device, "temperature") && s.temperature !== undefined && device.type !== "temp_sensor" && <div className="mt-0.5 text-[13px] text-muted">Room reads {s.temperature}°C</div>}
          </div>
          {has(device, "onoff") && (
            <button
              aria-label={s.on ? "Turn off" : "Turn on"}
              disabled={disabled}
              onClick={() => send({ on: !s.on })}
              className={cx("focus-ring flex size-14 shrink-0 items-center justify-center rounded-full border transition active:scale-95 disabled:opacity-40", s.on ? "border-transparent bg-mint text-mint-ink shadow-[0_0_30px_-6px_var(--mint)]" : "border-line-strong bg-surface-3 text-muted hover:text-text")}
            >
              <Power className="size-6" />
            </button>
          )}
        </div>
        {!device.online && (
          <div className="relative mt-4 flex items-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--err)_12%,transparent)] px-3 py-2.5 text-[13px] text-err">
            <WifiOff className="size-4" /> This device isn&apos;t responding. Controls are disabled until it reconnects.
          </div>
        )}
        {!canControl && device.online && <div className="relative mt-4 text-[12.5px] text-faint">Your role can view this device but not control it.</div>}
      </div>

      {has(device, "brightness") && (
        <Row label="Brightness" value={`${bright.v}%`}>
          <Slider label="Brightness" min={1} max={100} value={bright.v} disabled={disabled} onChange={bright.set} onCommit={(v) => (bright.done(), send({ brightness: v }))} fill={accent.startsWith("var") ? undefined : accent} />
        </Row>
      )}

      {has(device, "color_temp") && (
        <Row label="Colour temperature" value={`${ct.v}K`}>
          <Slider label="Colour temperature" min={2200} max={6500} step={100} value={ct.v} disabled={disabled} onChange={ct.set} onCommit={(v) => (ct.done(), send({ colorTemp: v }))} track="linear-gradient(90deg,#F2B66D,#FFF1DC 55%,#D6E6FF)" />
          <div className="flex justify-between text-[11px] text-faint">
            <span>Warm</span>
            <span>Daylight</span>
          </div>
        </Row>
      )}

      {has(device, "color") && (
        <Row label="Colour">
          <div className="flex flex-wrap items-center gap-2.5">
            {SWATCHES.map((c) => (
              <button
                key={c}
                aria-label={`Set colour ${c}`}
                disabled={disabled}
                onClick={() => send({ color: c })}
                className={cx("focus-ring size-9 rounded-full border-2 transition hover:scale-105 disabled:opacity-40", s.color?.toLowerCase() === c.toLowerCase() ? "border-text" : "border-transparent")}
                style={{ background: c }}
              />
            ))}
            <label className="relative size-9 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-line-strong" title="Custom colour">
              <input type="color" aria-label="Custom colour" className="absolute inset-0 size-full cursor-pointer opacity-0" disabled={disabled} value={s.color ?? "#69e3c0"} onChange={(e) => send({ color: e.target.value })} />
              <span className="flex size-full items-center justify-center text-faint">
                <Plus className="size-4" />
              </span>
            </label>
          </div>
        </Row>
      )}

      {has(device, "fan_speed") && (
        <Row label={device.type === "fan" ? "Speed / regulator" : "Speed"} value={s.on ? `Level ${s.speed ?? 1}` : "Off"}>
          <Segmented label="Speed" value={s.speed ?? 1} onChange={(v) => send({ speed: v, on: true })} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} className={cx("w-full", disabled && "pointer-events-none opacity-40")} />
        </Row>
      )}

      {has(device, "oscillate") && (
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-text-2">Oscillation</span>
          <Switch label="Oscillation" checked={!!s.oscillate} disabled={disabled} onChange={(v) => send({ oscillate: v })} />
        </div>
      )}

      {has(device, "target_temp") && (
        <Row label="Target temperature">
          <div className="flex items-center justify-between rounded-2xl border border-line bg-surface-2 p-2">
            <Button variant="ghost" size="lg" aria-label="Decrease temperature" disabled={disabled || (s.targetTemp ?? 24) <= 16} onClick={() => send({ targetTemp: Math.max(16, (s.targetTemp ?? 24) - 0.5) })}>
              <Minus className="size-5" />
            </Button>
            <div className="text-center">
              <div className="num font-display text-[34px] font-bold leading-none">{(s.targetTemp ?? 24).toFixed(1)}°</div>
              <div className="mt-1 text-[11px] text-faint">16° – 30°C</div>
            </div>
            <Button variant="ghost" size="lg" aria-label="Increase temperature" disabled={disabled || (s.targetTemp ?? 24) >= 30} onClick={() => send({ targetTemp: Math.min(30, (s.targetTemp ?? 24) + 0.5) })}>
              <Plus className="size-5" />
            </Button>
          </div>
        </Row>
      )}

      {has(device, "hvac_mode") && (
        <Row label="Mode">
          <Segmented<HvacMode> label="Mode" value={s.mode ?? "cool"} onChange={(v) => send({ mode: v })} options={(["cool", "heat", "dry", "fan", "auto"] as HvacMode[]).map((m) => ({ value: m, label: m[0].toUpperCase() + m.slice(1) }))} className={cx("w-full", disabled && "pointer-events-none opacity-40")} />
        </Row>
      )}

      {has(device, "ac_fan") && (
        <Row label="Fan speed">
          <Segmented label="Fan speed" value={s.acFan ?? "auto"} onChange={(v) => send({ acFan: v })} options={(["auto", "low", "medium", "high"] as const).map((m) => ({ value: m, label: m[0].toUpperCase() + m.slice(1) }))} className={cx("w-full", disabled && "pointer-events-none opacity-40")} />
        </Row>
      )}

      {has(device, "swing") && (
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-text-2">Swing</span>
          <Switch label="Swing" checked={!!s.swing} disabled={disabled} onChange={(v) => send({ swing: v })} />
        </div>
      )}

      {has(device, "position") && (
        <Row label="Position" value={pos.v === 0 ? "Closed" : pos.v === 100 ? "Open" : `${pos.v}% open`}>
          <div className="grid grid-cols-3 gap-2">
            <Button variant={s.position === 100 ? "primary" : "secondary"} disabled={disabled} onClick={() => send({ position: 100 })}>
              Open
            </Button>
            <Button variant="secondary" disabled={disabled} icon={<Pause className="size-4" />} onClick={() => send({ stop: true })}>
              Stop
            </Button>
            <Button variant={s.position === 0 ? "primary" : "secondary"} disabled={disabled} onClick={() => send({ position: 0 })}>
              Close
            </Button>
          </div>
          <Slider label="Position" value={pos.v} disabled={disabled} onChange={pos.set} onCommit={(v) => (pos.done(), send({ position: v }))} />
        </Row>
      )}

      {has(device, "lock") && (
        <Button
          size="lg"
          className="w-full"
          variant={s.locked ? "outline" : "primary"}
          disabled={disabled}
          onClick={async () => {
            if (s.locked && !(await confirm({ title: `Unlock ${device.name}?`, body: "This unlocks a physical door. Only continue if someone is expecting access.", confirmLabel: "Unlock", danger: true }))) return;
            send({ locked: !s.locked });
          }}
        >
          {s.locked ? "Unlock door" : "Lock door"}
        </Button>
      )}

      {(has(device, "motion") || has(device, "contact") || device.type === "temp_sensor") && (
        <div className="grid grid-cols-2 gap-3">
          {has(device, "motion") && <Reading label="Motion" value={s.motion ? "Detected" : "Clear"} active={!!s.motion} />}
          {has(device, "contact") && <Reading label="Contact" value={s.contact === "open" ? "Open" : "Closed"} active={s.contact === "open"} />}
          {has(device, "temperature") && <Reading label="Temperature" value={`${s.temperature ?? "–"}°C`} />}
        </div>
      )}
    </div>
  );
}

function Reading({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2 p-4">
      <div className="text-eyebrow">{label}</div>
      <div className={cx("mt-1.5 font-display text-[20px] font-bold", active ? "text-warn" : "text-text")}>{value}</div>
    </div>
  );
}
