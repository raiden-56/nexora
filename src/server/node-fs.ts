// Indirection so the static GitHub Pages build can swap in a localStorage-backed shim (next.config.ts).
import fs from "node:fs";
export default fs;
