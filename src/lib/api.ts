"use client";

export class ApiClientError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/** Thin fetch wrapper. All business logic lives on the server — this only moves JSON. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const err = data as { error?: string; code?: string } | null;
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth")) window.location.href = "/login";
    throw new ApiClientError(res.status, err?.error ?? `Request failed (${res.status})`, err?.code);
  }
  return data as T;
}

export const fetcher = <T,>(url: string) => api<T>(url);
