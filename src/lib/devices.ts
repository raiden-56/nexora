import type { Capability, Device, DeviceCommand, DeviceState, DeviceType } from "./types";

export const DEVICE_CATALOG: Record<
  DeviceType,
  { label: string; group: "Electrical" | "Lighting" | "Climate" | "Openings" | "Security" | "Sensors" | "Appliances"; capabilities: Capability[]; watts: number; defaults: DeviceState }
> = {
  switch: { label: "Smart switch", group: "Electrical", capabilities: ["onoff", "power_meter"], watts: 60, defaults: { on: false } },
  plug: { label: "Smart plug", group: "Electrical", capabilities: ["onoff", "power_meter"], watts: 120, defaults: { on: false } },
  relay: { label: "Smart relay", group: "Electrical", capabilities: ["onoff"], watts: 200, defaults: { on: false } },
  bulb: { label: "Smart bulb", group: "Lighting", capabilities: ["onoff", "brightness", "color_temp"], watts: 9, defaults: { on: false, brightness: 80, colorTemp: 3000 } },
  led_strip: { label: "RGB LED strip", group: "Lighting", capabilities: ["onoff", "brightness", "color"], watts: 18, defaults: { on: false, brightness: 60, color: "#69E3C0" } },
  fan: { label: "Ceiling fan", group: "Climate", capabilities: ["onoff", "fan_speed"], watts: 75, defaults: { on: false, speed: 2 } },
  ac: { label: "Air conditioner", group: "Climate", capabilities: ["onoff", "target_temp", "hvac_mode", "ac_fan", "swing", "power_meter"], watts: 1500, defaults: { on: false, targetTemp: 24, mode: "cool", acFan: "auto", swing: false } },
  thermostat: { label: "Thermostat", group: "Climate", capabilities: ["onoff", "target_temp", "hvac_mode", "temperature"], watts: 5, defaults: { on: true, targetTemp: 22, mode: "auto", temperature: 24 } },
  ventilation: { label: "Ventilation", group: "Climate", capabilities: ["onoff", "fan_speed"], watts: 110, defaults: { on: false, speed: 1 } },
  curtain: { label: "Smart curtain", group: "Openings", capabilities: ["position"], watts: 30, defaults: { position: 0 } },
  blind: { label: "Smart blind", group: "Openings", capabilities: ["position"], watts: 20, defaults: { position: 100 } },
  lock: { label: "Smart lock", group: "Security", capabilities: ["lock"], watts: 2, defaults: { locked: true } },
  motion_sensor: { label: "Motion sensor", group: "Sensors", capabilities: ["motion"], watts: 0.5, defaults: { motion: false } },
  door_sensor: { label: "Door sensor", group: "Sensors", capabilities: ["contact"], watts: 0.3, defaults: { contact: "closed" } },
  temp_sensor: { label: "Climate sensor", group: "Sensors", capabilities: ["temperature"], watts: 0.3, defaults: { temperature: 25 } },
  camera: { label: "CCTV camera", group: "Security", capabilities: ["camera", "recording", "privacy", "motion"], watts: 6, defaults: { recording: true, privacy: false, motion: false } },
  appliance: { label: "Smart appliance", group: "Appliances", capabilities: ["onoff", "power_meter"], watts: 900, defaults: { on: false } },
};

export const has = (d: Pick<Device, "capabilities">, c: Capability) => d.capabilities.includes(c);

export function isSensor(d: Pick<Device, "type">) {
  return d.type === "motion_sensor" || d.type === "door_sensor" || d.type === "temp_sensor";
}

/** True when the device is "active" (drawing load / open / triggered). */
export function isActive(d: Device): boolean {
  if (!d.online) return false;
  if (has(d, "onoff")) return !!d.state.on;
  if (has(d, "position")) return (d.state.position ?? 0) > 0;
  if (has(d, "camera")) return !!d.state.recording && !d.state.privacy;
  if (has(d, "lock")) return d.state.locked === false;
  if (has(d, "motion")) return !!d.state.motion;
  if (has(d, "contact")) return d.state.contact === "open";
  return false;
}

/** Can the device be part of an ON/OFF bulk action? */
export function isSwitchable(d: Device) {
  return has(d, "onoff");
}

/** Estimated live draw in watts from state. Only meaningful for simulated devices or devices that report power. */
export function estimateWatts(d: Device): number {
  if (!d.online) return 0;
  const rated = d.ratedWatts;
  if (has(d, "onoff") && !d.state.on) return rated > 2 ? 0.4 : 0; // standby
  switch (d.type) {
    case "bulb":
    case "led_strip":
      return +(rated * ((d.state.brightness ?? 100) / 100)).toFixed(1);
    case "fan":
    case "ventilation":
      return +(rated * (0.3 + 0.14 * (d.state.speed ?? 1))).toFixed(1);
    case "ac": {
      const delta = Math.max(0, 30 - (d.state.targetTemp ?? 24));
      return Math.round(rated * (0.35 + delta * 0.06));
    }
    case "curtain":
    case "blind":
      return d.state.moving ? rated : 0.3;
    default:
      return rated;
  }
}

export function describeState(d: Device): string {
  if (!d.online) return "Offline";
  const s = d.state;
  switch (d.type) {
    case "bulb":
    case "led_strip":
      return s.on ? `On · ${s.brightness ?? 100}%` : "Off";
    case "fan":
    case "ventilation":
      return s.on ? `On · Speed ${s.speed ?? 1}` : "Off";
    case "ac":
      return s.on ? `${capitalize(s.mode ?? "cool")} · ${s.targetTemp ?? 24}°C` : "Off";
    case "thermostat":
      return `${s.temperature ?? "–"}°C → ${s.targetTemp ?? "–"}°C`;
    case "curtain":
    case "blind":
      return s.moving ? capitalize(s.moving) : s.position === 0 ? "Closed" : s.position === 100 ? "Open" : `${s.position}% open`;
    case "lock":
      return s.locked ? "Locked" : "Unlocked";
    case "motion_sensor":
      return s.motion ? "Motion detected" : "Clear";
    case "door_sensor":
      return s.contact === "open" ? "Open" : "Closed";
    case "temp_sensor":
      return `${s.temperature ?? "–"}°C`;
    case "camera":
      return s.privacy ? "Privacy mode" : s.motion ? "Motion detected" : s.recording ? "Recording" : "Live · not recording";
    default:
      return s.on ? "On" : "Off";
  }
}

export function describeCommand(cmd: DeviceCommand): string {
  const parts: string[] = [];
  if (cmd.on !== undefined) parts.push(cmd.on ? "Turn on" : "Turn off");
  if (cmd.brightness !== undefined) parts.push(`brightness ${cmd.brightness}%`);
  if (cmd.colorTemp !== undefined) parts.push(`${cmd.colorTemp}K`);
  if (cmd.color) parts.push(`color ${cmd.color}`);
  if (cmd.speed !== undefined) parts.push(`speed ${cmd.speed}`);
  if (cmd.oscillate !== undefined) parts.push(cmd.oscillate ? "oscillate" : "no oscillation");
  if (cmd.targetTemp !== undefined) parts.push(`${cmd.targetTemp}°C`);
  if (cmd.mode) parts.push(`${cmd.mode} mode`);
  if (cmd.acFan) parts.push(`fan ${cmd.acFan}`);
  if (cmd.swing !== undefined) parts.push(cmd.swing ? "swing on" : "swing off");
  if (cmd.position !== undefined) parts.push(cmd.position === 100 ? "Open" : cmd.position === 0 ? "Close" : `position ${cmd.position}%`);
  if (cmd.stop) parts.push("Stop");
  if (cmd.locked !== undefined) parts.push(cmd.locked ? "Lock" : "Unlock");
  if (cmd.recording !== undefined) parts.push(cmd.recording ? "Start recording" : "Stop recording");
  if (cmd.privacy !== undefined) parts.push(cmd.privacy ? "Privacy mode on" : "Privacy mode off");
  const s = parts.join(", ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

export const PROVIDER_LABEL: Record<string, string> = {
  simulated: "Simulated",
  home_assistant: "Home Assistant",
  tuya: "Tuya Smart",
  matter: "Matter",
  mqtt: "MQTT",
  zigbee: "Zigbee",
};
