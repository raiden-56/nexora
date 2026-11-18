/** Minimal `Buffer.from(hex, "hex")` for src/server/util.ts in the static demo build. */
import { Bytes } from "./crypto";

const g = globalThis as unknown as { Buffer?: unknown };
if (typeof g.Buffer === "undefined") {
  g.Buffer = {
    from(s: string, enc?: string) {
      if (enc !== "hex") return new TextEncoder().encode(s);
      const out = new Bytes(s.length >> 1);
      for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
      return out;
    },
  };
}
export {};
