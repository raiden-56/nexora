"use client";
import { BASE_PATH, STATIC_DEMO } from "./routes";

export class ApiClientError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/** Thin fetch wrapper. All business logic lives on the server — this only moves JSON. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const init: RequestInit = {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  };
  // Static GitHub Pages build: the backend runs in this browser tab (src/demo/backend.ts).
  const res = STATIC_DEMO ? await (await import("nexora-demo-backend")).demoFetch(path, init) : await fetch(path, init);
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const err = data as { error?: string; code?: string } | null;
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth")) window.location.href = `${BASE_PATH}/login${STATIC_DEMO ? "/" : ""}`;
    throw new ApiClientError(res.status, err?.error ?? `Request failed (${res.status})`, err?.code);
  }
  return data as T;
}

export const fetcher = <T,>(url: string) => api<T>(url);
