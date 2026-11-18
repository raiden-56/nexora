import "server-only";
import type { Capability, Device, DeviceCommand, DeviceState, DeviceType, IntegrationAccount } from "@/lib/types";
import type { CommandResult, DeviceProvider, DiscoveredDevice } from "./types";

/**
 * Home Assistant REST adapter (https://developers.home-assistant.io/docs/api/rest/).
 * Credentials (base URL + long-lived access token) are stored server-side on the
 * IntegrationAccount and never serialised to the browser.
 *
 * Success is reported only when Home Assistant accepts the service call; the returned
 * entity state is read back to confirm the change.
 */

interface HaState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

function creds(integration: IntegrationAccount | null) {
  const baseUrl = integration?.secret?.baseUrl?.replace(/\/+$/, "");
  const token = integration?.secret?.token;
  if (!baseUrl || !token) throw new Error("Home Assistant is not configured. Add the URL and a long-lived access token.");
  return { baseUrl, token };
}

async function ha<T>(integration: IntegrationAccount | null, path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, token } = creds(integration);
  const res = await fetch(baseUrl + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("Home Assistant rejected the access token (401).");
  if (!res.ok) throw new Error(`Home Assistant responded ${res.status}.`);
  return (await res.json()) as T;
}

function mapEntity(s: HaState): { type: DeviceType; capabilities: Capability[]; state: DeviceState } | null {
  const [domain] = s.entity_id.split(".");
  const a = s.attributes;
  const modes = (a.supported_color_modes as string[] | undefined) ?? [];
  switch (domain) {
    case "light": {
      const caps: Capability[] = ["onoff"];
      if (modes.some((m) => m !== "onoff")) caps.push("brightness");
      if (modes.some((m) => ["hs", "rgb", "rgbw", "rgbww", "xy"].includes(m))) caps.push("color");
      if (modes.includes("color_temp")) caps.push("color_temp");
      return {
        type: caps.includes("color") ? "led_strip" : "bulb",
        capabilities: caps,
        state: { on: s.state === "on", brightness: typeof a.brightness === "number" ? Math.round((a.brightness / 255) * 100) : undefined },
      };
    }
    case "switch":
      return { type: "switch", capabilities: ["onoff"], state: { on: s.state === "on" } };
    case "fan":
      return { type: "fan", capabilities: ["onoff", "fan_speed"], state: { on: s.state === "on", speed: typeof a.percentage === "number" ? Math.max(1, Math.round(a.percentage / 20)) : 1 } };
    case "climate":
      return { type: "ac", capabilities: ["onoff", "target_temp", "hvac_mode"], state: { on: s.state !== "off", targetTemp: a.temperature as number, mode: (s.state === "off" ? "cool" : s.state) as DeviceState["mode"] } };
    case "cover":
      return { type: "curtain", capabilities: ["position"], state: { position: (a.current_position as number) ?? (s.state === "open" ? 100 : 0) } };
    case "lock":
      return { type: "lock", capabilities: ["lock"], state: { locked: s.state === "locked" } };
    default:
      return null;
  }
}

function serviceCalls(device: Device, cmd: DeviceCommand): { domain: string; service: string; data: Record<string, unknown> }[] {
  const entity_id = device.externalId;
  const [domain] = entity_id.split(".");
  const calls: { domain: string; service: string; data: Record<string, unknown> }[] = [];
  if (domain === "light") {
    if (cmd.on === false) return [{ domain, service: "turn_off", data: { entity_id } }];
    const data: Record<string, unknown> = { entity_id };
    if (cmd.brightness !== undefined) data.brightness_pct = cmd.brightness;
    if (cmd.colorTemp !== undefined) data.color_temp_kelvin = cmd.colorTemp;
    if (cmd.color) data.rgb_color = [1, 3, 5].map((i) => parseInt(cmd.color!.slice(i, i + 2), 16));
    calls.push({ domain, service: "turn_on", data });
  } else if (domain === "switch") {
    if (cmd.on !== undefined) calls.push({ domain, service: cmd.on ? "turn_on" : "turn_off", data: { entity_id } });
  } else if (domain === "fan") {
    if (cmd.on === false) return [{ domain, service: "turn_off", data: { entity_id } }];
    if (cmd.speed !== undefined) calls.push({ domain, service: "set_percentage", data: { entity_id, percentage: cmd.speed * 20 } });
    else if (cmd.on) calls.push({ domain, service: "turn_on", data: { entity_id } });
  } else if (domain === "climate") {
    if (cmd.on === false) return [{ domain, service: "turn_off", data: { entity_id } }];
    if (cmd.mode || cmd.on) calls.push({ domain, service: "set_hvac_mode", data: { entity_id, hvac_mode: cmd.mode ?? device.state.mode ?? "cool" } });
    if (cmd.targetTemp !== undefined) calls.push({ domain, service: "set_temperature", data: { entity_id, temperature: cmd.targetTemp } });
  } else if (domain === "cover") {
    if (cmd.stop) calls.push({ domain, service: "stop_cover", data: { entity_id } });
    else if (cmd.position !== undefined) calls.push({ domain, service: "set_cover_position", data: { entity_id, position: cmd.position } });
  } else if (domain === "lock") {
    if (cmd.locked !== undefined) calls.push({ domain, service: cmd.locked ? "lock" : "unlock", data: { entity_id } });
  }
  return calls;
}

export const homeAssistantProvider: DeviceProvider = {
  key: "home_assistant",
  label: "Home Assistant",
  real: true,

  async discover(integration) {
    const states = await ha<HaState[]>(integration, "/api/states");
    const out: DiscoveredDevice[] = [];
    for (const s of states) {
      const m = mapEntity(s);
      if (!m) continue;
      out.push({
        externalId: s.entity_id,
        name: (s.attributes.friendly_name as string) || s.entity_id,
        ...m,
        manufacturer: "Home Assistant",
        model: s.entity_id.split(".")[0],
        firmware: "—",
        ratedWatts: m.type === "ac" ? 1500 : m.type === "fan" ? 75 : 10,
        details: s.entity_id,
      });
    }
    return out;
  },

  async sendCommand(device, command, integration): Promise<CommandResult> {
    const calls = serviceCalls(device, command);
    if (!calls.length) return { ok: false, error: "This command is not supported by the Home Assistant entity.", retryable: false };
    try {
      for (const c of calls) await ha(integration, `/api/services/${c.domain}/${c.service}`, { method: "POST", body: JSON.stringify(c.data) });
      const s = await ha<HaState>(integration, `/api/states/${device.externalId}`);
      if (s.state === "unavailable") return { ok: false, error: "Entity is unavailable in Home Assistant.", retryable: true, offline: true };
      const mapped = mapEntity(s);
      return { ok: true, state: { ...device.state, ...(mapped?.state ?? {}) }, confirmed: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message, retryable: true };
    }
  },

  async testConnection(device, integration) {
    const start = Date.now();
    try {
      const s = await ha<HaState>(integration, `/api/states/${device.externalId}`);
      return { ok: s.state !== "unavailable", latencyMs: Date.now() - start, message: s.state === "unavailable" ? "Entity unavailable" : `Entity state: ${s.state}` };
    } catch (e) {
      return { ok: false, latencyMs: Date.now() - start, message: (e as Error).message };
    }
  },

  async testIntegration(integration) {
    try {
      const r = await ha<{ message: string }>(integration, "/api/");
      return { ok: true, message: r.message || "Connected to Home Assistant." };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },
};
