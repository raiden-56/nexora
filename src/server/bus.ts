import "server-only";
import type { Device, DeviceState } from "@/lib/types";

export type BusEvent = { type: "device.changed"; device: Device; previous: DeviceState; source: string };
type Listener = (e: BusEvent) => void;

const g = globalThis as typeof globalThis & { __nexoraBus?: Listener[] };
const listeners = (g.__nexoraBus ??= []);

export const bus = {
  on(l: Listener) {
    listeners.length = 0; // single subscriber (automation engine); avoids duplicates across hot reloads
    listeners.push(l);
  },
  emit(e: BusEvent) {
    for (const l of listeners) {
      try {
        l(e);
      } catch (err) {
        console.error("[nexora:bus]", err);
      }
    }
  },
};
