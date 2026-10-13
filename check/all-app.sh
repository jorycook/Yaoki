#!/bin/bash
# The test matrix against the installable app build. usage: bash all-app.sh
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
F='FAIL|PASS|PROBLEMS|problem\(s\)|console problems: \[.+\]|STEP FAILED|Error|took|BUILD FAILED|WARNING'
run() {
  local label="$1"; shift
  pkill -f "[h]ttp.server 8765" 2>/dev/null; sleep 0.5
  echo "=== app: $label"
  env "$@" 2>&1 | grep -E "$F" | cut -c1-400
}
run "day flow, sound"              timeout 300 bash run-app.sh flow-test.js
run "mock, sound"                 timeout 480 bash run-app.sh e2e-mock.js
run "mock, held back"             HELDBACK=1 timeout 300 bash run-app.sh e2e-mock.js
run "mock, bad clips"             BADCLIPS=1 timeout 300 bash run-app.sh e2e-mock.js
run "day flow, no scripts"         NOSOUND=1 timeout 300 bash run-app.sh flow-test.js
run "mock, no scripts"            NOSOUND=1 timeout 300 bash run-app.sh e2e-mock.js
run "interruptions, sound"        timeout 300 bash run-app.sh pause-test.js
run "interruptions, full run"     FULL=1 timeout 480 bash run-app.sh pause-test.js
run "interruptions, held back"    HELDBACK=1 timeout 300 bash run-app.sh pause-test.js
run "interruptions, no scripts"   NOSOUND=1 timeout 300 bash run-app.sh pause-test.js
run "content sweep"                timeout 2400 bash run-app.sh content-sweep.js
run "content sweep, N5"            LEVEL=N5 timeout 2400 bash run-app.sh content-sweep.js
run "level switch"               timeout 400 bash run-app.sh level-test.js
run "N5 mini mock, sound"        timeout 400 bash run-app.sh n5-mock.js
run "N4 mini mock"                timeout 400 bash run-app.sh n4-mock.js
run "N5 mini mock, no sound"     NOSOUND=1 timeout 400 bash run-app.sh n5-mock.js
pkill -f "[h]ttp.server 8765" 2>/dev/null; sleep 0.5
echo "=== app: mock time-up"
FAST_MOCK=1 bash run-app.sh step.js 'TShell?screen=MockRun' '[{"click":"button:has-text(\"Start\")","after":800},{"wait":3600},{"text":"[lang=ja]:has-text(\"時間切れ\")"},{"shot":"app-fm-timeup"}]' 2>&1 | cut -c1-300
sleep 0.5
echo "=== app: exam-style time-up"
FAST_EXAM=1 bash run-app.sh step.js 'TShell?screen=Exam' '[{"wait":5200},{"text":"div:has-text(\"Time is up\") >> nth=-1"},{"shot":"app-fe-timeup"}]' 2>&1 | cut -c1-300
echo "=== done"
