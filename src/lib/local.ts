import type { Device, DeviceCommand, DeviceState } from "./types";

/** Client-side mirror of the provider's state transition — used only for optimistic UI. */
export function applyLocal(device: Device, cmd: DeviceCommand): DeviceState {
  const next: DeviceState = { ...device.state };
  for (const [k, v] of Object.entries(cmd)) if (k !== "stop") (next as Record<string, unknown>)[k] = v;
  if (cmd.brightness !== undefined && cmd.on === undefined && device.capabilities.includes("onoff")) next.on = true;
  return next;
}
