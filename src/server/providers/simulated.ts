import "server-only";
import { DEVICE_CATALOG } from "@/lib/devices";
import type { Device, DeviceCommand, DeviceState, DeviceType } from "@/lib/types";
import { sleep } from "../util";
import type { CommandResult, DeviceProvider, DiscoveredDevice } from "./types";

/**
 * Simulated provider for development and demonstrations.
 * Devices created through it are always labelled "Simulated" in the UI.
 * It behaves like real hardware: network latency, offline devices reject commands, and
 * an optional failure rate (NEXORA_SIM_FAILURE_RATE) exercises retries and rollbacks.
 */
const FAILURE_RATE = Number(process.env.NEXORA_SIM_FAILURE_RATE ?? 0);

const DISCOVERABLE: { name: string; type: DeviceType; model: string }[] = [
  { name: "Hallway Bulb", type: "bulb", model: "Lumen A60 Tunable" },
  { name: "Accent RGB Strip", type: "led_strip", model: "Lumen Flex RGB" },
  { name: "Wall Switch 2-Gang", type: "switch", model: "NX-SW2 Touch Switch" },
  { name: "Heater Plug", type: "plug", model: "NX-PL16 Smart Plug" },
  { name: "Patio Ceiling Fan", type: "fan", model: "Aero BLDC 1200" },
  { name: "Split AC Bridge", type: "ac", model: "Climate IR Bridge" },
  { name: "Sheer Curtain Motor", type: "curtain", model: "Glide Curtain Motor" },
  { name: "Back Door Contact", type: "door_sensor", model: "Sense Contact" },
  { name: "Corridor PIR", type: "motion_sensor", model: "Sense PIR" },
];

export function applyCommand(device: Device, cmd: DeviceCommand): DeviceState {
  const next: DeviceState = { ...device.state };
  for (const [k, v] of Object.entries(cmd)) {
    if (k === "stop") continue;
    (next as Record<string, unknown>)[k] = v;
  }
  if (cmd.brightness !== undefined && cmd.on === undefined && device.capabilities.includes("onoff")) next.on = true;
  if (cmd.position !== undefined) next.moving = null;
  if (cmd.stop) next.moving = null;
  return next;
}

export const simulatedProvider: DeviceProvider = {
  key: "simulated",
  label: "Nexora Simulator",
  real: false,

  async discover() {
    await sleep(900);
    return DISCOVERABLE.map((d, i): DiscoveredDevice => {
      const cat = DEVICE_CATALOG[d.type];
      return {
        externalId: `sim-disc-${Date.now().toString(36)}-${i}`,
        name: d.name,
        type: d.type,
        capabilities: [...cat.capabilities],
        manufacturer: "Nexora Labs (simulated)",
        model: d.model,
        firmware: "2.4.1",
        ratedWatts: cat.watts,
        state: { ...cat.defaults },
        details: `Simulated · RSSI −${48 + i * 4} dBm`,
      };
    });
  },

  async sendCommand(device, command): Promise<CommandResult> {
    await sleep(120 + Math.random() * 260);
    if (!device.online) return { ok: false, error: `${device.name} is offline and did not respond.`, retryable: true, offline: true };
    if (FAILURE_RATE > 0 && Math.random() < FAILURE_RATE) return { ok: false, error: "Simulated transient timeout.", retryable: true };
    return { ok: true, state: applyCommand(device, command), confirmed: true };
  },

  async testConnection(device) {
    const start = Date.now();
    await sleep(300 + Math.random() * 400);
    return device.online
      ? { ok: true, latencyMs: Date.now() - start, message: "Simulated device responded." }
      : { ok: false, latencyMs: Date.now() - start, message: "No response — simulated device is offline." };
  },

  async testIntegration() {
    return { ok: true, message: "Simulator is always available." };
  },
};
