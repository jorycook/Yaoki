#!/bin/bash
# usage: run-reader.sh reader-test.js   (serves docs/ at /Yaoki/ on localhost:8766, as GitHub Pages does, runs the script, stops the server)
# The app and the reader are served together, so the test also sees the app's offline worker next to the reader.
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(mktemp -d)"
ln -s "$HERE/../docs" "$ROOT/Yaoki"
python3 -m http.server 8766 --bind 127.0.0.1 --directory "$ROOT" >/dev/null 2>&1 &
SERVER=$!
sleep 0.8
NODE_PATH=/opt/npm-tools/node_modules node "$@"
STATUS=$?
kill $SERVER 2>/dev/null
rm -rf "$ROOT"
exit $STATUS
