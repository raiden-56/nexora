/**
 * Browser stand-in for `node:crypto`, used only by the static GitHub Pages demo build
 * (see next.config.ts). The real server build uses Node's crypto.
 *
 * Password hashing here is NOT scrypt: the demo keeps all data in the visitor's own browser,
 * so there is nothing to protect. Never use this module on a server.
 */

class Bytes extends Uint8Array {
  toString(enc?: string): string {
    if (enc === "hex") return Array.from(this, (b) => b.toString(16).padStart(2, "0")).join("");
    if (enc === "base64url" || enc === "base64") {
      let bin = "";
      for (const b of this) bin += String.fromCharCode(b);
      const b64 = btoa(bin);
      return enc === "base64" ? b64 : b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    return new TextDecoder().decode(this);
  }
}

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256(data: Uint8Array): Bytes {
  const len = data.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(data);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, len * 8);
  view.setUint32(padded.length - 8, Math.floor(len / 0x20000000));
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const t1 = (hh + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  const out = new Bytes(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, h[i]);
  return out;
}

const enc = (s: string | Uint8Array) => (typeof s === "string" ? new TextEncoder().encode(s) : s);

function createHash(alg: string) {
  if (alg !== "sha256") throw new Error(`demo crypto: unsupported hash ${alg}`);
  let buf = new Uint8Array(0);
  const api = {
    update(s: string | Uint8Array) {
      const next = enc(s);
      const merged = new Uint8Array(buf.length + next.length);
      merged.set(buf);
      merged.set(next, buf.length);
      buf = merged;
      return api;
    },
    digest(encoding?: string) {
      const d = sha256(buf);
      return encoding ? d.toString(encoding) : d;
    },
  };
  return api;
}

function randomBytes(n: number) {
  const b = new Bytes(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

/** Demo-only key derivation (iterated SHA-256), not scrypt. */
function scryptSync(password: string, salt: string, keylen: number) {
  let h = sha256(enc(`${salt}:${password}`));
  for (let i = 0; i < 500; i++) h = sha256(h);
  const out = new Bytes(keylen);
  for (let i = 0; i < keylen; i += 32) out.set(sha256(enc(`${h.toString("hex")}:${i}`)).subarray(0, Math.min(32, keylen - i)), i);
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) throw new RangeError("Input buffers must have the same byte length");
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const randomUUID = () => globalThis.crypto.randomUUID();

const shim = { createHash, randomBytes, scryptSync, timingSafeEqual, randomUUID };
export default shim;
export { createHash, randomBytes, scryptSync, timingSafeEqual, randomUUID, Bytes };
