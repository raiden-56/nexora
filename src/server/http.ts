import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { ApiError } from "./auth";
import { ensureScheduler } from "./automation/scheduler";

type Handler<P> = (req: Request, params: P) => Promise<unknown>;

/**
 * Wraps a route handler: starts the background scheduler (idempotent), converts thrown
 * ApiError / ZodError into JSON responses and never leaks stack traces.
 */
export function route<P = Record<string, string>>(handler: Handler<P>) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    ensureScheduler();
    try {
      const params = ctx?.params ? await ctx.params : ({} as P);
      const result = await handler(req, params);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      if (err instanceof ApiError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
      if (err instanceof ZodError) {
        const first = err.issues[0];
        return NextResponse.json({ error: first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input" }, { status: 422 });
      }
      console.error("[nexora:api]", err);
      return NextResponse.json({ error: "Something went wrong on our side." }, { status: 500 });
    }
  };
}

export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "Request body must be JSON.");
  }
  return schema.parse(json);
}

export function query(req: Request) {
  return new URL(req.url).searchParams;
}
