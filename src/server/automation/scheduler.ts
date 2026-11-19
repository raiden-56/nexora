import "@/server/guard";
import { has } from "@/lib/devices";
import { bus } from "../bus";
import { db, persist } from "../db";
import { runAutomation } from "./executor";
import { dueOccurrences } from "./time";

/**
 * Server-side scheduler. Runs inside the Node.js server process (started from instrumentation.ts),
 * so routines execute whether or not any browser is open.
 *
 * Production: replace the interval with BullMQ repeatable jobs on Redis (one queue per org,
 * jobId = dedupeKey for exactly-once enqueueing) and run the same `runAutomation` in workers.
 */
const TICK_MS = 15_000;
const MAX_CATCH_UP_MS = 5 * 60_000; // never replay routines missed during long downtime

const g = globalThis as typeof globalThis & { __nexoraScheduler?: NodeJS.Timeout; __nexoraTicking?: boolean };

export function ensureScheduler() {
  if (g.__nexoraScheduler || process.env.NEXORA_DISABLE_SCHEDULER === "1") return;
  g.__nexoraScheduler = setInterval(() => void tick(), TICK_MS);
  g.__nexoraScheduler.unref?.();
  bus.on((e) => {
    if (e.type === "device.changed") void onDeviceChanged(e.device.id, e.previous as Record<string, unknown>);
  });
  console.log("[nexora] automation scheduler started");
  void tick();
}

export async function tick(now = new Date()) {
  if (g.__nexoraTicking) return;
  g.__nexoraTicking = true;
  try {
    const d = db();
    const last = d.meta.schedulerLastTick ? new Date(d.meta.schedulerLastTick) : new Date(now.getTime() - TICK_MS);
    const from = new Date(Math.max(last.getTime(), now.getTime() - MAX_CATCH_UP_MS));
    d.meta.schedulerLastTick = now.toISOString();
    persist();

    for (const automation of d.automations) {
      if (!automation.enabled) continue;
      const t = automation.trigger.type;
      if (t !== "time" && t !== "sunrise" && t !== "sunset") continue;
      const property = d.properties.find((p) => p.id === automation.propertyId);
      if (!property) continue;
      for (const occ of dueOccurrences(automation, property, from, now)) {
        void runAutomation(automation, { phase: occ.phase, source: "scheduler", dedupeKey: occ.dedupeKey });
      }
    }
    simulateTelemetry(d);
  } catch (err) {
    console.error("[nexora:scheduler]", err);
  } finally {
    g.__nexoraTicking = false;
  }
}

/** Event-driven triggers: device state changes, motion, doors, temperature thresholds. */
async function onDeviceChanged(deviceId: string, previous: Record<string, unknown>) {
  const d = db();
  const device = d.devices.find((x) => x.id === deviceId);
  if (!device) return;
  for (const a of d.automations) {
    if (!a.enabled || a.orgId !== device.orgId) continue;
    const t = a.trigger;
    let fire = false;
    if (t.type === "device_state" && t.deviceId === deviceId) {
      const cur = (device.state as Record<string, unknown>)[t.key];
      fire = cur === t.equals && previous[t.key] !== t.equals;
    } else if (t.type === "temperature_change" && t.deviceId === deviceId) {
      const cur = device.state.temperature ?? -Infinity;
      const prev = (previous.temperature as number | undefined) ?? -Infinity;
      fire = cur > t.above && prev <= t.above;
    }
    if (fire) await runAutomation(a, { phase: "start", source: "event", dedupeKey: `${a.id}:event:${Date.now()}`, recordSkips: false });
  }
}

/** Gentle drift for simulated climate sensors so dashboards and temperature triggers stay alive. */
function simulateTelemetry(d: ReturnType<typeof db>) {
  for (const dev of d.devices) {
    if (dev.provider !== "simulated" || !dev.online) continue;
    if (dev.type === "camera") {
      // Simulated cameras occasionally see someone walk past; motion clears on the next tick.
      const prev = { ...dev.state };
      dev.state.motion = !dev.state.privacy && !prev.motion && Math.random() < 0.06;
      if (dev.state.motion !== prev.motion) {
        dev.lastSeenAt = new Date().toISOString();
        bus.emit({ type: "device.changed", device: dev, previous: prev, source: "system" });
      }
      continue;
    }
    if (!has(dev, "temperature")) continue;
    const prev = { ...dev.state };
    const t = dev.state.temperature ?? 25;
    const target = dev.type === "thermostat" && dev.state.on ? dev.state.targetTemp ?? 24 : 26.5;
    dev.state.temperature = Math.round((t + (target - t) * 0.05 + (Math.random() - 0.5) * 0.3) * 10) / 10;
    dev.lastSeenAt = new Date().toISOString();
    if (dev.state.temperature !== prev.temperature) bus.emit({ type: "device.changed", device: dev, previous: prev, source: "system" });
  }
  persist();
}
