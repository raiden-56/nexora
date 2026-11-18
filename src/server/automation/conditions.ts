import type { Condition, Device, Property, Room } from "@/lib/types";
import { zonedParts } from "./time";

export interface ConditionEnv {
  devices: Map<string, Device>;
  rooms: Map<string, Room>;
  property: Property;
  now: Date;
}

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Evaluates one IF-condition. Returns a human-readable reason when it fails. */
export function evaluateCondition(c: Condition, env: ConditionEnv): { ok: boolean; reason: string } {
  switch (c.type) {
    case "device_online": {
      const d = env.devices.get(c.deviceId);
      return d?.online ? { ok: true, reason: "" } : { ok: false, reason: `${d?.name ?? "Device"} is offline` };
    }
    case "device_on": {
      const d = env.devices.get(c.deviceId);
      return d?.online && d.state.on ? { ok: true, reason: "" } : { ok: false, reason: `${d?.name ?? "Device"} is not on` };
    }
    case "room_occupied": {
      const r = env.rooms.get(c.roomId);
      return r?.occupied ? { ok: true, reason: "" } : { ok: false, reason: `${r?.name ?? "Room"} is not occupied` };
    }
    case "temperature_above": {
      const d = env.devices.get(c.deviceId);
      const t = d?.state.temperature;
      return t !== undefined && t > c.value ? { ok: true, reason: "" } : { ok: false, reason: `${d?.name ?? "Sensor"} reads ${t ?? "–"}°C (needs > ${c.value}°C)` };
    }
    case "day_of_week": {
      const dow = zonedParts(env.now, env.property.timezone).dow;
      return c.days.includes(dow) ? { ok: true, reason: "" } : { ok: false, reason: `Today (${DAY[dow]}) is not selected` };
    }
    case "property_mode":
      return env.property.mode === c.mode ? { ok: true, reason: "" } : { ok: false, reason: `Property is in ${env.property.mode} mode, not ${c.mode}` };
  }
}

export function evaluateAll(conditions: Condition[], env: ConditionEnv) {
  for (const c of conditions) {
    const r = evaluateCondition(c, env);
    if (!r.ok) return r;
  }
  return { ok: true, reason: "" };
}
