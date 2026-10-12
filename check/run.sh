#!/bin/bash
# usage: run.sh <node script and args...>   (rebuilds the site, serves it, runs the script, stops the server)
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
bash setup-site.sh >/dev/null
python3 -m http.server 8765 --directory site >/dev/null 2>&1 &
SERVER=$!
sleep 0.8
NODE_PATH=/opt/npm-tools/node_modules node "$@"
STATUS=$?
kill $SERVER 2>/dev/null
exit $STATUS
