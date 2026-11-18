import "server-only";
import type { ProviderKey } from "@/lib/types";
import type { DeviceProvider } from "./types";

/**
 * Adapters for ecosystems whose transport is not wired up in this release.
 * They implement the full DeviceProvider contract but always report failure — they never
 * pretend a device was discovered, paired or controlled.
 *
 *  - matter:  requires a Matter controller (e.g. python-matter-server / chip-tool) on the local gateway
 *  - tuya:    requires Tuya Cloud project credentials + HMAC-SHA256 request signing (server-side only)
 *  - mqtt:    requires an MQTT broker connection from the gateway process
 *  - zigbee:  requires a coordinator via Zigbee2MQTT (then handled by the mqtt adapter)
 */
const NOTES: Record<string, { label: string; why: string }> = {
  matter: { label: "Matter", why: "Matter commissioning runs on the Nexora local gateway, which is not running." },
  tuya: { label: "Tuya Smart", why: "Tuya Cloud credentials are not configured on the server." },
  mqtt: { label: "MQTT", why: "No MQTT broker is configured for this organization." },
  zigbee: { label: "Zigbee", why: "Zigbee requires a coordinator (Zigbee2MQTT) connected through the gateway." },
};

export function pendingProvider(key: Exclude<ProviderKey, "simulated" | "home_assistant">): DeviceProvider {
  const n = NOTES[key];
  return {
    key,
    label: n.label,
    real: true,
    async discover() {
      throw new Error(n.why);
    },
    async sendCommand() {
      return { ok: false, error: n.why, retryable: false };
    },
    async testConnection() {
      return { ok: false, latencyMs: 0, message: n.why };
    },
    async testIntegration() {
      return { ok: false, message: n.why };
    },
  };
}
