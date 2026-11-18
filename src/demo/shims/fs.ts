/**
 * Browser stand-in for `node:fs` (static GitHub Pages demo build only).
 * Files live in the visitor's localStorage, so the JSON database in src/server/db.ts works unchanged.
 */
const PREFIX = "nexora:fs:";
const mem = new Map<string, string>(); // fallback when localStorage is unavailable (private mode, quota)

function store(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function get(p: string): string | null {
  const s = store();
  try {
    const v = s?.getItem(PREFIX + p);
    if (v != null) return v;
  } catch {
    /* fall through */
  }
  return mem.get(p) ?? null;
}

function set(p: string, v: string) {
  mem.set(p, v);
  const s = store();
  try {
    s?.setItem(PREFIX + p, v);
  } catch (err) {
    console.warn("[nexora demo] browser storage is full or blocked; changes will last until the tab closes", err);
  }
}

function remove(p: string) {
  mem.delete(p);
  try {
    store()?.removeItem(PREFIX + p);
  } catch {
    /* ignore */
  }
}

export function existsSync(p: string) {
  return get(p) != null;
}
export function readFileSync(p: string) {
  const v = get(p);
  if (v == null) throw Object.assign(new Error(`ENOENT: ${p}`), { code: "ENOENT" });
  return v;
}
export function writeFileSync(p: string, data: string) {
  set(p, String(data));
}
export function renameSync(from: string, to: string) {
  const v = get(from);
  if (v == null) return;
  remove(from);
  set(to, v);
}
export function mkdirSync() {
  /* directories are implicit */
}

const fs = { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync };
export default fs;
