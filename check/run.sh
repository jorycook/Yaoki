#!/bin/bash
# usage: run.sh <node script and args...>   (rebuilds the site, serves it, runs the script, stops the server)
# YK_LEVEL=N1 builds the site from the N1 screens; PORT serves it on another port (8765 by default)
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
bash setup-site.sh >/dev/null
export PORT="${PORT:-8765}"
python3 -m http.server "$PORT" --directory site >/dev/null 2>&1 &
SERVER=$!
sleep 0.8
NODE_PATH=/opt/npm-tools/node_modules node "$@"
STATUS=$?
kill $SERVER 2>/dev/null
exit $STATUS
