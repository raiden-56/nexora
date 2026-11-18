/** Browser stand-in for `node:path` (static demo build only). */
export function join(...parts: string[]) {
  return parts.join("/").replace(/\/+/g, "/");
}
const path = { join, sep: "/" };
export default path;
