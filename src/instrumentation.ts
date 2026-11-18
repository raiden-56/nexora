/**
 * Next.js instrumentation hook — runs once when the server process boots.
 * Starts the automation scheduler so routines run with no browser open.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureScheduler } = await import("./server/automation/scheduler");
    ensureScheduler();
  }
}
