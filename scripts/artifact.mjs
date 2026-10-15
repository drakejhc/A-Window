// Turns the Vite build into a page for publishing as a Claude artifact, which supplies its own document
// shell: keep the title, fonts, stylesheet, root element and module script, and copy the assets alongside.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const html = readFileSync("dist/index.html", "utf8");
const pick = (re) => [...html.matchAll(re)].map((m) => m[0]).join("\n");
rmSync("artifact", { recursive: true, force: true });
mkdirSync("artifact", { recursive: true });
cpSync("dist/assets", "artifact/assets", { recursive: true });
writeFileSync(
  "artifact/index.html",
  [
    pick(/<title>[^<]*<\/title>/g),
    pick(/<meta name="description"[^>]*>/g),
    pick(/<link rel="(?:preconnect|stylesheet)"[^>]*>/g),
    '<div id="root"></div>',
    pick(/<script type="module"[^>]*><\/script>/g),
    "",
  ].join("\n"),
);
console.log("artifact/index.html written");
