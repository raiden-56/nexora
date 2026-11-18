import "@/server/guard";
import { describeCommand } from "@/lib/devices";
import type { Automation, DeviceCommand, Execution, ExecutionStatus, ExecutionStep, Scene } from "@/lib/types";
import { db, persist } from "../db";
import { executeDeviceCommand } from "../services/devices";
import { notify } from "../services/log";
import { id, nowIso, sleep } from "../util";
import { evaluateAll, evaluateCondition, type ConditionEnv } from "./conditions";

const g = globalThis as typeof globalThis & { __nexoraInflight?: Set<string> };
const inflight = (g.__nexoraInflight ??= new Set());

function envFor(orgId: string, propertyId: string): ConditionEnv | null {
  const d = db();
  const property = d.properties.find((p) => p.id === propertyId && p.orgId === orgId);
  if (!property) return null;
  return {
    property,
    devices: new Map(d.devices.filter((x) => x.orgId === orgId).map((x) => [x.id, x])),
    rooms: new Map(d.rooms.filter((x) => x.orgId === orgId).map((x) => [x.id, x])),
    now: new Date(),
  };
}

function rollup(steps: ExecutionStep[]): ExecutionStatus {
  const ran = steps.filter((s) => s.status !== "skipped");
  if (!ran.length) return "skipped";
  const failed = ran.filter((s) => s.status === "failed").length;
  if (!failed) return "success";
  return failed === ran.length ? "failed" : "partial";
}

async function runDeviceStep(opts: {
  orgId: string;
  deviceId: string;
  command: DeviceCommand;
  source: "automation" | "scene";
  automationId: string | null;
  userId: string | null;
  userName: string | null;
  attempts: number;
  skipIfOffline: boolean;
}): Promise<ExecutionStep> {
  const device = db().devices.find((x) => x.id === opts.deviceId && x.orgId === opts.orgId);
  if (!device) return { label: `Missing device → ${describeCommand(opts.command)}`, status: "failed", detail: "Device was removed" };
  const label = `${device.name} → ${describeCommand(opts.command)}`;
  if (!device.online && opts.skipIfOffline) return { label, status: "skipped", detail: "Device offline — skipped per policy" };
  try {
    const r = await executeDeviceCommand({ device, command: opts.command, source: opts.source, userId: opts.userId, userName: opts.userName, automationId: opts.automationId, maxAttempts: opts.attempts });
    return r.ok ? { label, status: "success", attempts: r.attempts } : { label, status: "failed", detail: r.error, attempts: r.attempts };
  } catch (e) {
    return { label, status: "failed", detail: (e as Error).message };
  }
}

/** Runs a scene's actions in their configured order. */
export async function runScene(scene: Scene, opts: { source: Execution["source"]; userId: string | null; userName: string | null; automationId?: string | null }): Promise<Execution> {
  const startedAt = nowIso();
  const steps: ExecutionStep[] = [];
  for (const a of scene.actions) {
    steps.push(
      await runDeviceStep({ orgId: scene.orgId, deviceId: a.deviceId, command: a.command, source: "scene", automationId: opts.automationId ?? null, userId: opts.userId, userName: opts.userName, attempts: 2, skipIfOffline: false }),
    );
  }
  scene.lastActivatedAt = nowIso();
  const exec: Execution = {
    id: id("exe_"),
    orgId: scene.orgId,
    propertyId: scene.propertyId,
    automationId: opts.automationId ?? null,
    sceneId: scene.id,
    name: scene.name,
    phase: "scene",
    status: rollup(steps),
    source: opts.source,
    startedAt,
    finishedAt: nowIso(),
    steps,
    dedupeKey: id("scene_"),
    userId: opts.userId,
  };
  db().executions.push(exec);
  if (exec.status === "failed" || exec.status === "partial") {
    notify({ orgId: scene.orgId, propertyId: scene.propertyId, type: "automation_failed", severity: "warning", title: `Scene "${scene.name}" ${exec.status === "failed" ? "failed" : "partially failed"}`, body: `${steps.filter((s) => s.status === "failed").length} of ${steps.length} actions could not be completed.`, link: "/scenes" });
  }
  persist();
  return exec;
}

/**
 * Executes an automation. Idempotent per dedupeKey: a scheduled occurrence never runs twice,
 * even if two scheduler ticks or two server instances race (in-flight set + persisted key).
 */
export async function runAutomation(
  automation: Automation,
  opts: { phase: "start" | "end"; source: Execution["source"]; dedupeKey: string; userId?: string | null; userName?: string | null; recordSkips?: boolean },
): Promise<Execution | null> {
  const d = db();
  if (inflight.has(opts.dedupeKey) || d.executions.some((e) => e.dedupeKey === opts.dedupeKey)) return null;
  inflight.add(opts.dedupeKey);
  try {
    const env = envFor(automation.orgId, automation.propertyId);
    if (!env) return null;
    const startedAt = nowIso();
    const steps: ExecutionStep[] = [];
    const userId = opts.userId ?? null;
    const userName = opts.userName ?? null;
    const policy = automation.onUnreachable;

    if (opts.phase === "start") {
      const gate = evaluateAll(automation.conditions, env);
      if (!gate.ok) {
        if (opts.recordSkips === false) return null;
        steps.push({ label: "Conditions", status: "skipped", detail: gate.reason });
      } else {
        for (const action of automation.actions) {
          if (action.type === "device") {
            if (action.conditions?.length) {
              const c = evaluateAll(action.conditions, { ...env, now: new Date() });
              if (!c.ok) {
                const dev = env.devices.get(action.deviceId);
                steps.push({ label: `${dev?.name ?? "Device"} → ${describeCommand(action.command)}`, status: "skipped", detail: `Condition not met: ${c.reason}` });
                continue;
              }
            }
            const step = await runDeviceStep({
              orgId: automation.orgId,
              deviceId: action.deviceId,
              command: action.command,
              source: "automation",
              automationId: automation.id,
              userId,
              userName,
              attempts: policy === "retry_then_notify" ? 3 : 1,
              skipIfOffline: policy === "skip",
            });
            steps.push(step);
            if (step.status === "failed" && policy === "abort") {
              steps.push({ label: "Remaining actions", status: "skipped", detail: "Aborted after a device could not be reached" });
              break;
            }
          } else if (action.type === "scene") {
            const scene = d.scenes.find((s) => s.id === action.sceneId && s.orgId === automation.orgId);
            if (!scene) {
              steps.push({ label: "Run scene", status: "failed", detail: "Scene no longer exists" });
              continue;
            }
            const exec = await runScene(scene, { source: opts.source, userId, userName, automationId: automation.id });
            steps.push({ label: `Run scene "${scene.name}"`, status: exec.status === "success" ? "success" : exec.status === "skipped" ? "skipped" : "failed", detail: exec.status === "partial" ? "Some scene actions failed" : undefined });
          } else if (action.type === "notify") {
            notify({ orgId: automation.orgId, propertyId: automation.propertyId, type: "automation_executed", severity: "info", title: automation.name, body: action.message, link: `/automations/${automation.id}` });
            steps.push({ label: `Notify: ${action.message}`, status: "success" });
          } else if (action.type === "delay") {
            await sleep(Math.min(action.seconds, 300) * 1000);
            steps.push({ label: `Wait ${action.seconds}s`, status: "success" });
          }
        }
      }
    } else {
      // END phase — switch off what the automation switched on. Essential loads are never touched.
      const ids = new Set<string>();
      for (const a of automation.actions) {
        if (a.type === "device" && (a.command.on === true || a.command.brightness !== undefined || a.command.speed !== undefined || a.command.targetTemp !== undefined)) ids.add(a.deviceId);
      }
      for (const deviceId of ids) {
        const dev = env.devices.get(deviceId);
        if (dev?.essential) {
          steps.push({ label: `${dev.name} → Turn off`, status: "skipped", detail: "Essential load preserved" });
          continue;
        }
        steps.push(
          await runDeviceStep({ orgId: automation.orgId, deviceId, command: { on: false }, source: "automation", automationId: automation.id, userId, userName, attempts: policy === "retry_then_notify" ? 3 : 1, skipIfOffline: policy === "skip" }),
        );
      }
    }

    const status = rollup(steps);
    const exec: Execution = {
      id: id("exe_"),
      orgId: automation.orgId,
      propertyId: automation.propertyId,
      automationId: automation.id,
      sceneId: null,
      name: automation.name,
      phase: opts.source === "user" ? "manual" : opts.phase,
      status,
      source: opts.source,
      startedAt,
      finishedAt: nowIso(),
      steps,
      dedupeKey: opts.dedupeKey,
      userId,
    };
    d.executions.push(exec);
    automation.lastRunAt = exec.finishedAt;
    automation.lastStatus = status;
    if (status === "failed" || status === "partial") {
      const failed = steps.filter((s) => s.status === "failed");
      notify({
        orgId: automation.orgId,
        propertyId: automation.propertyId,
        type: "automation_failed",
        severity: status === "failed" ? "error" : "warning",
        title: `${automation.name} ${status === "failed" ? "failed" : "partially failed"}`,
        body: `${failed.length} action${failed.length === 1 ? "" : "s"} failed: ${failed.map((f) => f.label.split(" → ")[0]).join(", ")}`,
        link: `/automations/${automation.id}`,
      });
    } else if (status === "success" && opts.source !== "event") {
      notify({ orgId: automation.orgId, propertyId: automation.propertyId, type: "automation_executed", severity: "success", title: `${automation.name} ran`, body: `${steps.filter((s) => s.status === "success").length} actions completed${opts.phase === "end" ? " (end of schedule)" : ""}.`, link: `/automations/${automation.id}` });
    }
    persist();
    return exec;
  } finally {
    inflight.delete(opts.dedupeKey);
  }
}

export { evaluateCondition };
