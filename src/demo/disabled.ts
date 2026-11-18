/** Server build: the in-browser demo backend is not included (see next.config.ts). */
export async function demoFetch(): Promise<Response> {
  throw new Error("The in-browser demo backend is only available in the static GitHub Pages build.");
}
