#!/bin/bash
# usage: run-app.sh <node script and args...>   (builds the app into its test folder, serves it, runs the script against it, stops the server)
# The test build lives in yaoki-app/dist-test; the release build in yaoki-app/dist is never touched from here.
HERE="$(cd "$(dirname "$0")" && pwd)"
APPDIR="$HERE/../yaoki-app"
TESTDIR="$APPDIR/dist-test"
cd "$APPDIR" && NODE_PATH=/opt/npm-tools/node_modules YK_OUT=dist-test YK_BUILD_DATE="${YK_BUILD_DATE:-test build}" node build.mjs >/dev/null || { echo "BUILD FAILED"; exit 1; }
# FAST_MOCK=1 / FAST_EXAM=1 shorten the clocks in the built copy only, to reach the time-up paths
if [ -n "$FAST_MOCK" ]; then sed -i "s/en: 'Vocabulary, grammar, reading', total: 600/en: 'Vocabulary, grammar, reading', total: 3/" "$TESTDIR/assets/screens.js"; grep -q "total: 3," "$TESTDIR/assets/screens.js" || echo "WARNING: FAST_MOCK patch did not apply"; fi
if [ -n "$FAST_EXAM" ]; then sed -i "s/const TOTAL = 150;/const TOTAL = 4;/" "$TESTDIR/assets/screens.js"; grep -q "const TOTAL = 4;" "$TESTDIR/assets/screens.js" || echo "WARNING: FAST_EXAM patch did not apply"; fi
cd "$HERE"
python3 -m http.server 8765 --directory "$TESTDIR" >/dev/null 2>&1 &
SERVER=$!
sleep 0.8
YK_APP=1 NODE_PATH=/opt/npm-tools/node_modules node "$@"
STATUS=$?
kill $SERVER 2>/dev/null
exit $STATUS
