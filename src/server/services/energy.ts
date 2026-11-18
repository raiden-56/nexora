import "server-only";
import { estimateWatts } from "@/lib/devices";
import type { Device } from "@/lib/types";
import type { Ctx } from "../auth";
import { db } from "../db";
import { seeded } from "../util";
import { zonedParts } from "../automation/time";

/**
 * Energy analytics.
 *
 * Simulated devices have no meter, so historical consumption is generated from a deterministic
 * usage profile per device type and labelled `source: "demonstration"` everywhere it's shown.
 * Real providers would write EnergyReadings rows from telemetry; those would replace `hourlyWh`.
 */

const PROFILE: Record<string, number[]> = {
  // share of rated power used per local hour, 0..23
  light: [0.05, 0.02, 0.02, 0.02, 0.02, 0.05, 0.25, 0.4, 0.3, 0.15, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.2, 0.45, 0.8, 0.95, 0.95, 0.85, 0.6, 0.2],
  climate: [0.5, 0.5, 0.45, 0.4, 0.35, 0.3, 0.2, 0.15, 0.2, 0.3, 0.4, 0.55, 0.65, 0.7, 0.7, 0.65, 0.55, 0.45, 0.5, 0.6, 0.65, 0.7, 0.65, 0.55],
  office: [0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.05, 0.2, 0.6, 0.95, 1, 1, 0.9, 0.95, 1, 1, 0.95, 0.8, 0.4, 0.15, 0.05, 0.03, 0.02, 0.02],
  always: Array(24).fill(0.6),
  base: [0.1, 0.05, 0.05, 0.05, 0.05, 0.1, 0.3, 0.4, 0.35, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.35, 0.4, 0.55, 0.65, 0.7, 0.6, 0.4, 0.2],
};

function profileFor(dev: Device, commercial: boolean) {
  if (dev.essential) return PROFILE.always;
  if (commercial) return PROFILE.office;
  if (dev.type === "bulb" || dev.type === "led_strip" || dev.type === "switch") return PROFILE.light;
  if (dev.type === "ac" || dev.type === "fan" || dev.type === "ventilation" || dev.type === "thermostat") return PROFILE.climate;
  return PROFILE.base;
}

/** Wh consumed by a device in the hour starting at `hourStart` (demonstration profile). */
export function hourlyWh(dev: Device, hourStart: Date, localHour: number, commercial: boolean, weekend: boolean) {
  let share = profileFor(dev, commercial)[localHour] ?? 0.2;
  if (commercial && weekend && !dev.essential) share *= 0.12;
  if (!commercial && (dev.type === "ac" || dev.type === "ventilation")) share *= 0.45;
  const noise = 0.75 + seeded(dev.id + hourStart.toISOString().slice(0, 13)) * 0.5;
  return dev.ratedWatts * share * noise;
}

export type EnergyRange = "24h" | "7d" | "30d";

export function energyReport(ctx: Ctx, propertyId: string | null, range: EnergyRange) {
  const d = db();
  const props = d.properties.filter((p) => p.orgId === ctx.orgId && ctx.canAccessProperty(p.id) && (!propertyId || p.id === propertyId));
  const org = d.orgs.find((o) => o.id === ctx.orgId)!;
  const commercial = org.type !== "residential";
  const now = new Date();
  const hourMs = 3600_000;
  const currentHour = Math.floor(now.getTime() / hourMs) * hourMs;

  const buckets = range === "24h" ? 24 : range === "7d" ? 7 : 30;
  const bucketHours = range === "24h" ? 1 : 24;
  const series: { label: string; at: string; kwh: number; previousKwh: number }[] = [];
  const byDevice = new Map<string, number>();
  const byRoom = new Map<string, number>();
  const byProperty = new Map<string, number>();
  let total = 0;
  let previousTotal = 0;
  let allSimulated = true;

  for (const p of props) {
    const devices = d.devices.filter((x) => x.propertyId === p.id && x.ratedWatts > 1);
    if (devices.some((x) => x.provider !== "simulated")) allSimulated = false;
    for (let b = buckets - 1; b >= 0; b--) {
      const start = currentHour - (b + 1) * bucketHours * hourMs + hourMs;
      let kwh = 0;
      let prevKwh = 0;
      for (let h = 0; h < bucketHours; h++) {
        const t = new Date(start + h * hourMs);
        const tPrev = new Date(t.getTime() - buckets * bucketHours * hourMs);
        const zp = zonedParts(t, p.timezone);
        const dow = zp.dow;
        const lh = Math.floor(zp.minutes / 60);
        const zpPrev = zonedParts(tPrev, p.timezone);
        const dowPrev = zpPrev.dow;
        for (const dev of devices) {
          const wh = hourlyWh(dev, t, lh, commercial, dow === 0 || dow === 6);
          kwh += wh / 1000;
          prevKwh += hourlyWh(dev, tPrev, Math.floor(zpPrev.minutes / 60), commercial, dowPrev === 0 || dowPrev === 6) / 1000;
          byDevice.set(dev.id, (byDevice.get(dev.id) ?? 0) + wh / 1000);
          byRoom.set(dev.roomId, (byRoom.get(dev.roomId) ?? 0) + wh / 1000);
        }
      }
      const idx = buckets - 1 - b;
      const at = new Date(start);
      const label = range === "24h" ? zonedParts(at, p.timezone).hhmm : at.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: p.timezone });
      if (!series[idx]) series[idx] = { label, at: at.toISOString(), kwh: 0, previousKwh: 0 };
      series[idx].kwh += kwh;
      series[idx].previousKwh += prevKwh;
      total += kwh;
      previousTotal += prevKwh;
      byProperty.set(p.id, (byProperty.get(p.id) ?? 0) + kwh);
    }
  }

  const tariff = props.length ? props.reduce((s, p) => s + p.tariffPerKwh, 0) / props.length : 8;
  const currency = props[0]?.currency ?? "INR";
  const liveWatts = d.devices.filter((x) => props.some((p) => p.id === x.propertyId)).reduce((s, x) => s + estimateWatts(x), 0);
  const devName = (deviceId: string) => d.devices.find((x) => x.id === deviceId);
  const round = (n: number) => Math.round(n * 100) / 100;

  const topDevices = [...byDevice.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([deviceId, kwh]) => {
    const dev = devName(deviceId)!;
    return { deviceId, name: dev.name, type: dev.type, room: d.rooms.find((r) => r.id === dev.roomId)?.name ?? "", kwh: round(kwh), cost: round(kwh * tariff), essential: dev.essential };
  });

  // Energy-saving opportunities derived from live state + usage
  const opportunities: { title: string; detail: string; savingKwh: number }[] = [];
  for (const dev of d.devices.filter((x) => props.some((p) => p.id === x.propertyId))) {
    const room = d.rooms.find((r) => r.id === dev.roomId);
    if (dev.online && dev.state.on && !dev.essential && room && !room.occupied && (dev.type === "ac" || dev.type === "bulb") && dev.ratedWatts > 20) {
      opportunities.push({ title: `${dev.name} is on in an unoccupied room`, detail: `${room.name} shows no occupancy. An occupancy rule could switch it off automatically.`, savingKwh: round((estimateWatts(dev) * 4) / 1000) });
    }
    if (dev.type === "ac" && dev.state.on && (dev.state.targetTemp ?? 24) < 23 && !dev.essential) {
      opportunities.push({ title: `Raise ${dev.name} to 24°C`, detail: `Each degree above ${dev.state.targetTemp}°C saves roughly 6% of cooling energy.`, savingKwh: round((dev.ratedWatts * 0.06 * (24 - (dev.state.targetTemp ?? 24)) * 8) / 1000) });
    }
  }

  return {
    source: allSimulated ? ("demonstration" as const) : ("mixed" as const),
    range,
    currency,
    tariff,
    liveWatts: Math.round(liveWatts),
    totalKwh: round(total),
    previousKwh: round(previousTotal),
    cost: round(total * tariff),
    changePct: previousTotal ? round(((total - previousTotal) / previousTotal) * 100) : 0,
    series: series.map((s) => ({ ...s, kwh: round(s.kwh), previousKwh: round(s.previousKwh) })),
    byDevice: topDevices,
    byRoom: [...byRoom.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([roomId, kwh]) => ({ roomId, name: d.rooms.find((r) => r.id === roomId)?.name ?? "Room", kwh: round(kwh), cost: round(kwh * tariff) })),
    byProperty: [...byProperty.entries()].map(([pid, kwh]) => ({ propertyId: pid, name: d.properties.find((p) => p.id === pid)?.name ?? "", kwh: round(kwh), cost: round(kwh * tariff) })),
    opportunities: opportunities.sort((a, b) => b.savingKwh - a.savingKwh).slice(0, 6),
    projectedMonthlyCost: round((total / (buckets * bucketHours)) * 24 * 30 * tariff),
  };
}
