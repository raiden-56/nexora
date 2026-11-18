/**
 * Browser stand-in for `next/headers` (static demo build only). The "session cookie" is kept in
 * localStorage next to the demo database, so src/server/auth.ts runs unchanged in the browser.
 */
const KEY = "nexora:cookies";
const mem: Record<string, string> = {};

function read(): Record<string, string> {
  try {
    return { ...mem, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { ...mem };
  }
}
function write(jar: Record<string, string>) {
  Object.assign(mem, jar);
  for (const k of Object.keys(mem)) if (!(k in jar)) delete mem[k];
  try {
    localStorage.setItem(KEY, JSON.stringify(jar));
  } catch {
    /* in-memory only */
  }
}

export async function cookies() {
  return {
    get(name: string) {
      const v = read()[name];
      return v === undefined ? undefined : { name, value: v };
    },
    set(name: string, value: string) {
      write({ ...read(), [name]: value });
    },
    delete(name: string) {
      const jar = read();
      delete jar[name];
      write(jar);
    },
  };
}

export async function headers() {
  return new Headers({ "user-agent": typeof navigator === "undefined" ? "demo" : navigator.userAgent });
}
