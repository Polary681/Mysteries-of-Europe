// Static checks: every local asset referenced by index.html / css exists; every legend has a card; both adventures are wired in.   node tools/check-links.mjs
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."); let bad = 0;
const fail = m => { bad++; console.error("FAIL:", m); }, pass = m => console.log("ok  :", m);
const html = fs.readFileSync(path.join(root, "index.html"), "utf8"), css = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
for (const m of html.matchAll(/<(a|script|link|img|source)\b[^>]*?(?:src|href)="([^"#?]+)"/g)) { const tag = m[1]; m[1] = m[2]; if (/^(https?:|data:|mailto:)/.test(m[1])) { tag === "a" ? console.log("note: outbound link (not loaded automatically): " + m[1]) : fail("external resource in index.html: " + m[1]); continue; } fs.existsSync(path.join(root, m[1])) ? pass("index.html → " + m[1]) : fail("missing file " + m[1]); }
for (const m of css.matchAll(/url\(["']?([^)"']+)["']?\)/g)) { if (m[1].startsWith("data:")) continue; if (/^https?:/.test(m[1])) { fail("external url in css: " + m[1]); continue; } fs.existsSync(path.join(root, "css", m[1])) ? pass("css → " + m[1]) : fail("css asset missing " + m[1]); }
const data = fs.readFileSync(path.join(root, "js/data.js"), "utf8"), main = fs.readFileSync(path.join(root, "js/main.js"), "utf8"), app = fs.readFileSync(path.join(root, "src/app.js"), "utf8");
for (const k of ["woolpit", "skye", "hoia", "babayaga", "sibilla", "bathory"]) { data.includes(k) ? pass("legend '" + k + "' exists in data.js") : fail("legend missing: " + k); app.includes(k) ? pass("adventure '" + k + "' registered in app.js") : fail("adventure not registered: " + k); }
main.includes("?play=") || main.includes("play=") ? pass("deep link ?play= handled") : fail("deep link missing");
for (const f of ["js/bundle.js", "js/data.js", "js/geo-data.js", "js/main.js"]) fs.existsSync(path.join(root, f)) ? pass(f + " present") : fail(f + " missing");
for (const m of fs.readFileSync(path.join(root, "js/bundle.js"), "utf8").matchAll(/["'`](https?:\/\/[^"'`\s]+)["'`]/g)) if (!/w3\.org|threejs\.org|github\.com|mrdoob|naturalearth|example/.test(m[1])) console.log("note: URL string in bundle:", m[1].slice(0, 80));
console.log(bad ? `\n${bad} problem(s)` : "\nALL OK"); process.exit(bad ? 1 : 0);
