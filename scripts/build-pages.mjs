// Builds the static GitHub Pages demo into ./out.
// Usage: node scripts/build-pages.mjs [basePath]   (default basePath: /nexora)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const basePath = process.argv[2] ?? process.env.NEXORA_BASE_PATH ?? "/nexora";
const env = { ...process.env, NEXORA_STATIC: "1", NEXORA_BASE_PATH: basePath, NEXT_TELEMETRY_DISABLED: "1" };
const r = spawnSync("npx next build", { stdio: "inherit", env, shell: true });
if (r.status !== 0) process.exit(r.status ?? 1);
fs.writeFileSync("out/.nojekyll", "");

// The router prefetches segments as flat files (e.g. overview/__next.!KGFwcCk.overview.__PAGE__.txt)
// while the export writes them nested (overview/__next.!KGFwcCk/overview/__PAGE__.txt). A static
// host can't rewrite, so also write the flat names.
let copied = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (!e.isDirectory()) continue;
    if (e.name.startsWith("__next.")) {
      (function flatten(d, prefix) {
        for (const f of fs.readdirSync(d, { withFileTypes: true })) {
          const name = `${prefix}.${f.name}`;
          if (f.isDirectory()) flatten(path.join(d, f.name), name);
          else {
            fs.copyFileSync(path.join(d, f.name), path.join(dir, name));
            copied++;
          }
        }
      })(p, e.name);
    } else walk(p);
  }
})("out");
console.log(`Flattened ${copied} segment prefetch files`);
console.log(`\nStatic demo written to ./out (basePath "${basePath}")`);
