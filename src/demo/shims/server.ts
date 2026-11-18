/** Browser stand-in for `next/server` (static demo build only): just what route handlers use. */
export class NextResponse extends Response {
  static json(body: unknown, init?: ResponseInit) {
    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json");
    return new Response(JSON.stringify(body), { ...init, headers });
  }
}
