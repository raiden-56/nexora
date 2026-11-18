/**
 * In-browser backend for the static GitHub Pages demo.
 *
 * GitHub Pages can only serve files, so this build bundles the real route handlers and services
 * from src/app/api and src/server into the page and dispatches `/api/*` calls to them directly
 * (Node built-ins are swapped for the browser shims in ./shims via next.config.ts). Data lives in
 * the visitor's localStorage and the automation scheduler runs only while a tab is open.
 * The server build does not include this module.
 */
import "./shims/globals";
import { ROUTES } from "./routes.generated";
import { ensureScheduler } from "@/server/automation/scheduler";

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

const compiled = ROUTES.map(([pattern, mod]) => {
  const names: string[] = [];
  const re = new RegExp(
    "^" +
      pattern.replace(/\[([^\]]+)\]/g, (_, n: string) => {
        names.push(n);
        return "([^/]+)";
      }) +
      "/?$",
  );
  return { re, names, mod };
});

/** Calls that can change who is signed in or which organization is active. */
const SESSION_PATHS = /^\/api\/(auth\/|onboarding|org|me|demo\/reset|properties\/select)/;

export async function demoFetch(path: string, init: RequestInit): Promise<Response> {
  ensureScheduler();
  const url = new URL(path, "https://nexora.demo");
  const method = (init.method ?? "GET").toUpperCase();
  for (const { re, names, mod } of compiled) {
    const m = re.exec(url.pathname);
    if (!m) continue;
    const handler = mod[method] as Handler | undefined;
    if (!handler) return Response.json({ error: "Method not allowed" }, { status: 405 });
    const params = Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
    const req = new Request(url, { method, headers: init.headers, body: method === "GET" || method === "HEAD" ? undefined : init.body });
    const res = await handler(req, { params: Promise.resolve(params) });
    if (res.ok && method !== "GET" && SESSION_PATHS.test(url.pathname)) window.dispatchEvent(new Event("nexora:session"));
    return res;
  }
  return Response.json({ error: "Not found" }, { status: 404 });
}
