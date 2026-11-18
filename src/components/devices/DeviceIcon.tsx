import {
  AirVent,
  Blinds,
  Cpu,
  DoorClosed,
  DoorOpen,
  Fan,
  Lightbulb,
  Lock,
  LockOpen,
  Plug,
  Radar,
  Refrigerator,
  Thermometer,
  ToggleRight,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Device, DeviceType } from "@/lib/types";
import { cx } from "@/lib/format";
import { isActive } from "@/lib/devices";

const MAP: Record<DeviceType, LucideIcon> = {
  switch: ToggleRight,
  plug: Plug,
  relay: Zap,
  bulb: Lightbulb,
  led_strip: Lightbulb,
  fan: Fan,
  ac: AirVent,
  thermostat: Thermometer,
  ventilation: Wind,
  curtain: Blinds,
  blind: Blinds,
  lock: Lock,
  motion_sensor: Radar,
  door_sensor: DoorClosed,
  temp_sensor: Thermometer,
  appliance: Refrigerator,
};

export function iconFor(d: Pick<Device, "type" | "state">): LucideIcon {
  if (d.type === "lock") return d.state.locked === false ? LockOpen : Lock;
  if (d.type === "door_sensor") return d.state.contact === "open" ? DoorOpen : DoorClosed;
  return MAP[d.type] ?? Cpu;
}

/** Accent colour that reflects what the device is doing (warm light, cooling, etc.). */
export function accentFor(d: Device): string {
  if (!d.online) return "var(--err)";
  if (!isActive(d)) return "var(--idle)";
  switch (d.type) {
    case "bulb":
      return (d.state.colorTemp ?? 3000) < 3600 ? "#F2C46D" : "#E9F1FF";
    case "led_strip":
      return d.state.color ?? "var(--mint)";
    case "ac":
      return d.state.mode === "heat" ? "#F29A6D" : "var(--cyan)";
    case "lock":
      return "var(--warn)";
    case "motion_sensor":
    case "door_sensor":
      return "var(--warn)";
    default:
      return "var(--mint)";
  }
}

export function DeviceGlyph({ device, size = "md", className }: { device: Device; size?: "sm" | "md" | "lg"; className?: string }) {
  const Icon = iconFor(device);
  const c = accentFor(device);
  const active = isActive(device);
  const spin = device.type === "fan" && active && device.online;
  const box = { sm: "size-8 rounded-xl", md: "size-10 rounded-2xl", lg: "size-16 rounded-[22px]" }[size];
  const ic = { sm: "size-4", md: "size-[18px]", lg: "size-7" }[size];
  return (
    <span
      className={cx("relative flex shrink-0 items-center justify-center transition-colors duration-300", box, className)}
      style={{ color: c, background: active ? `color-mix(in srgb, ${c} 16%, transparent)` : "var(--surface-3)", boxShadow: active ? `0 0 24px -6px ${c}` : undefined }}
    >
      <Icon className={cx(ic, spin && "animate-spin")} style={spin ? { animationDuration: `${2.2 - (device.state.speed ?? 1) * 0.35}s` } : undefined} />
    </span>
  );
}
