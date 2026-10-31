// Bundles src/app.js (+ three.js, only what is used) into ONE classic script: js/bundle.js
// A classic (non-module) script is used on purpose so the site also works by double-clicking
// index.html (file://), where browsers block ES-module imports.
//   npm run bundle
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dev = process.argv.includes("--dev");
const r = await build({
  entryPoints: [path.join(root, "src/app.js")],
  outfile: path.join(root, "js/bundle.js"),
  bundle: true, format: "iife", target: "es2020", minify: !dev, sourcemap: dev, legalComments: "none", logLevel: "info",
  banner: { js: "/* Mysteries of Europe - 3D bundle (three.js r170, MIT). Built from /src with esbuild. */" },
});
