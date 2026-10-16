#!/bin/bash
# The test matrix against the installable app build. usage: bash all-app.sh     YK_LEVEL=N1 bash all-app.sh
# Without YK_LEVEL it builds and tests the main app (N5 to N2). With YK_LEVEL=N1 the N1 app is built and tested: its own
# click-throughs (the *-n1.js scripts), and the shared checks.
# PORT and YK_TESTDIR (see run-app.sh) let two matrices run at once, each with its own server and build folder.
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
export YK_LEVEL="${YK_LEVEL:-N2}"
export PORT="${PORT:-8765}"
F='FAIL|PASS|PROBLEMS|problem\(s\)|console problems: \[.+\]|STEP FAILED|Error|took|BUILD FAILED|WARNING'
run() {
  local label="$1"; shift
  pkill -f "[h]ttp.server $PORT" 2>/dev/null; sleep 0.5
  echo "=== app ($YK_LEVEL): $label"
  env "$@" 2>&1 | grep -E "$F" | cut -c1-400
}
if [ "$YK_LEVEL" = "N1" ]; then
# the N1 click-throughs and sweep go through the whole course, so they take longer
run "main flow, sound"            timeout 420 bash run-app.sh e2e-n1.js
run "mock, sound"                 timeout 480 bash run-app.sh e2e-mock-n1.js
run "main flow, held back"        HELDBACK=1 timeout 420 bash run-app.sh e2e-n1.js
run "mock, held back"             HELDBACK=1 timeout 300 bash run-app.sh e2e-mock-n1.js
run "main flow, bad clips"        BADCLIPS=1 timeout 420 bash run-app.sh e2e-n1.js
run "mock, bad clips"             BADCLIPS=1 timeout 300 bash run-app.sh e2e-mock-n1.js
run "main flow, no scripts"       NOSOUND=1 timeout 420 bash run-app.sh e2e-n1.js
run "mock, no scripts"            NOSOUND=1 timeout 300 bash run-app.sh e2e-mock-n1.js
run "interruptions, sound"        timeout 300 bash run-app.sh pause-test.js
run "interruptions, full run"     FULL=1 timeout 480 bash run-app.sh pause-test.js
run "interruptions, held back"    HELDBACK=1 timeout 300 bash run-app.sh pause-test.js
run "interruptions, no scripts"   NOSOUND=1 timeout 300 bash run-app.sh pause-test.js
run "notebook entries"            timeout 720 bash run-app.sh nb-check-n1.js
run "answer-state sweep"          NOSOUND=1 timeout 1200 bash run-app.sh sweep-n1.js
run "every screen"                timeout 200 bash run-app.sh screens-app.js
else
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
# the whole of N5 outlives one run's timeout (about an hour and a half): a unit at a time, every day still swept
for u in 1 2 3 4 5 6 7 8; do
  run "content sweep, N5 unit $u" LEVEL=N5 DAYS="$(printf 'n5u%02dd1,n5u%02dd2,n5u%02dd3,n5u%02dd4,n5u%02dd5,n5u%02dd6' $u $u $u $u $u $u)" timeout 2400 bash run-app.sh content-sweep.js
done
run "level switch"               timeout 400 bash run-app.sh level-test.js
run "N5 mini mock, sound"        timeout 400 bash run-app.sh n5-mock.js
run "N4 mini mock"                timeout 400 bash run-app.sh n4-mock.js
run "N3 mini mock"                timeout 400 bash run-app.sh n3-mock.js
run "N5 mini mock, no sound"     NOSOUND=1 timeout 400 bash run-app.sh n5-mock.js
fi
pkill -f "[h]ttp.server $PORT" 2>/dev/null; sleep 0.5
echo "=== app ($YK_LEVEL): mock time-up"
FAST_MOCK=1 bash run-app.sh step.js 'TShell?screen=MockRun' '[{"click":"button:has-text(\"Start\")","after":800},{"wait":3600},{"text":"[lang=ja]:has-text(\"時間切れ\")"},{"shot":"app-fm-timeup"}]' 2>&1 | cut -c1-300
sleep 0.5
echo "=== app ($YK_LEVEL): exam-style time-up"
FAST_EXAM=1 bash run-app.sh step.js 'TShell?screen=Exam' '[{"wait":5200},{"text":"div:has-text(\"Time is up\") >> nth=-1"},{"shot":"app-fe-timeup"}]' 2>&1 | cut -c1-300
echo "=== done"
