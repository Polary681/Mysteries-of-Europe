#!/bin/sh
# Opens the site in your default browser (works straight from the file, no server needed).
# Optional: "./start.sh serve" runs the tiny local server instead (needs Node.js) at http://localhost:8080
cd "$(dirname "$0")"
if [ "$1" = "serve" ]; then exec node tools/serve.mjs 8080; fi
if command -v xdg-open >/dev/null 2>&1; then xdg-open index.html; elif command -v open >/dev/null 2>&1; then open index.html; else echo "Open index.html in your browser."; fi
