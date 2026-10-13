#!/bin/bash
# The checks run before a release while content is still growing: each prints its verdict line.
# Whole-level sweeps are run separately, a few units at a time: LEVEL=N4 bash sweep-chunks.sh <logdir> "1 2" "3 4" …
cd "$(dirname "$0")"
F='FAIL|PASS|PROBLEMS|problem\(s\)|CRASH|BUILD FAILED'
run() { local label="$1"; shift; echo "=== $label"; env "$@" 2>&1 | grep -E "$F" | cut -c1-300; }
run "app: interruptions 1"   timeout 300 bash run-app.sh pause-test.js
run "app: interruptions 2"   timeout 300 bash run-app.sh pause-test.js
run "app: day flow"          timeout 300 bash run-app.sh flow-test.js
run "app: level switch"      timeout 400 bash run-app.sh level-test.js
run "app: N5 mini mock"      timeout 400 bash run-app.sh n5-mock.js
run "app: N4 mini mock"      timeout 400 bash run-app.sh n4-mock.js
run "canvas: N2 mini mock"   timeout 480 bash run.sh e2e-mock.js
run "app: app checks"        timeout 600 bash run-app.sh app-test.js
run "canvas: every board"    timeout 300 bash run.sh rt-check.js
run "canvas: N5 day 1 of each unit" DAYS=n5u01d1,n5u02d1,n5u03d1,n5u04d1,n5u05d1,n5u06d1,n5u07d1,n5u08d1 LEVEL=N5 NOSOUND=1 timeout 3600 bash run.sh content-sweep.js
run "app: N5 day 1 of each unit" DAYS=n5u01d1,n5u02d1,n5u03d1,n5u04d1,n5u05d1,n5u06d1,n5u07d1,n5u08d1 LEVEL=N5 NOSOUND=1 timeout 3600 bash run-app.sh content-sweep.js
run "app: N4 day 1 of each unit" DAYS=n4u01d1,n4u02d1,n4u03d1,n4u04d1,n4u05d1,n4u06d1,n4u07d1,n4u08d1,n4u09d1,n4u10d1 LEVEL=N4 NOSOUND=1 timeout 3600 bash run-app.sh content-sweep.js
run "app: N2 every day"      NOSOUND=1 timeout 3000 bash run-app.sh content-sweep.js
echo "=== preview"; NODE_PATH=/opt/npm-tools/node_modules node preview-test.js 2>&1 | tail -3
echo "##### release checks done"
