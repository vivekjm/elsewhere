#!/bin/zsh
# Starts the local Trips Loom backend replica on http://127.0.0.1:8787 for
# end-to-end tests of a Debug build (see ios/README.md, "Testing sync").
set -e
cd "$(dirname "$0")"
root=../../..
# The web's own validator, so every save is checked exactly as the Worker does.
npx --yes esbuild "$root/lib/model.ts" --bundle --format=esm --platform=node --outfile=.model.mjs --log-level=warning
(sleep 1 && curl -s -X POST --data @seed.json http://127.0.0.1:8787/__admin/seed >/dev/null && echo "seeded a web-made workspace") &
exec node server.mjs
