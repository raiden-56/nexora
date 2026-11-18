import { useParams, useSearchParams } from "next/navigation";

/** True in the static GitHub Pages build, where the backend runs inside the browser. */
export const STATIC_DEMO = process.env.NEXT_PUBLIC_NEXORA_STATIC === "1";
/** Base path the app is served under ("" normally, "/nexora" on GitHub Pages). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const DETAIL = /^\/(devices|rooms|automations)\/([^/?#]+)\/?$/;

/**
 * Link to a detail page. A static export can only pre-render known paths, so in the static build
 * `/devices/abc` becomes `/devices/_/?id=abc`, served by one pre-rendered page per detail route.
 */
export function appHref(path: string): string {
  if (!STATIC_DEMO) return path;
  const m = DETAIL.exec(path);
  return m ? `/${m[1]}/_/?id=${encodeURIComponent(m[2])}` : path;
}

/** The `[id]` of a detail page, in both the server and the static build. */
export function useRouteId(): string {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  return params.id === "_" ? search.get("id") ?? "" : params.id;
}
