#!/bin/bash
# Runs the whole test matrix and prints one line per run. usage: bash all.sh
# This is the canvas side: the screens run in the design canvas's own runtime (setup-site.sh). The click-throughs here are
# the main app's (N5 to N2); the N1 app's run against the app build (YK_LEVEL=N1 bash all-app.sh). With YK_LEVEL=N1 this checks
# every N1 board and the two time-up paths on the canvas.
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
export YK_LEVEL="${YK_LEVEL:-N2}"
export PORT="${PORT:-8765}"
N1=""; [ "$YK_LEVEL" = "N1" ] && N1=1
F='FAIL|PASS|PROBLEMS|problem\(s\)|console problems: \[.+\]|STEP FAILED|Error|took'
run() { # label, env..., script
  local label="$1"; shift
  pkill -f "[h]ttp.server $PORT" 2>/dev/null; sleep 0.5
  echo "=== $label"
  env "$@" 2>&1 | grep -E "$F" | cut -c1-400
}
if [ "$YK_LEVEL" != "N1" ]; then
run "day flow, sound"              timeout 300 bash run.sh flow-test.js
run "mock, sound"                 timeout 480 bash run.sh e2e-mock.js
run "mock, held back"             HELDBACK=1 timeout 300 bash run.sh e2e-mock.js
run "mock, bad clips"             BADCLIPS=1 timeout 300 bash run.sh e2e-mock.js
run "day flow, no scripts"         NOSOUND=1 timeout 300 bash run.sh flow-test.js
run "mock, no scripts"            NOSOUND=1 timeout 300 bash run.sh e2e-mock.js
run "day flow, mode 2"             OMELETTE=1 timeout 300 bash run.sh flow-test.js
run "mock, mode 2, sound"         OMELETTE=1 timeout 480 bash run.sh e2e-mock.js
run "interruptions, sound"        timeout 300 bash run.sh pause-test.js
run "interruptions, full run"     FULL=1 timeout 480 bash run.sh pause-test.js
run "interruptions, held back"    HELDBACK=1 timeout 300 bash run.sh pause-test.js
run "interruptions, no scripts"   NOSOUND=1 timeout 300 bash run.sh pause-test.js
run "interruptions, mode 2"       OMELETTE=1 timeout 300 bash run.sh pause-test.js
run "content sweep"                timeout 2400 bash run.sh content-sweep.js
run "content sweep, mode 2"        OMELETTE=1 timeout 2400 bash run.sh content-sweep.js
run "content sweep, N5"           LEVEL=N5 NOSOUND=1 timeout 2400 bash run.sh content-sweep.js
run "N5 mini mock"                timeout 400 bash run.sh n5-mock.js
run "N4 mini mock"                timeout 400 bash run.sh n4-mock.js
run "N3 mini mock"                timeout 400 bash run.sh n3-mock.js
run "sound decode"                timeout 120 bash run.sh sound-test.js
run "writing with a finger"       timeout 900 bash run.sh write-flow.js
else
run "writing with a finger"       timeout 900 bash run.sh write-flow-n1.js
fi
pkill -f "[h]ttp.server $PORT" 2>/dev/null; sleep 0.5
for mode in "" OMELETTE; do
  echo "=== every board${N1:+ (N1)}${mode:+, mode 2}"
  if [ -n "$mode" ]; then OUT=$(OMELETTE=1 bash run.sh rt-check.js 2>&1); else OUT=$(bash run.sh rt-check.js 2>&1); fi
  echo "$OUT" | grep -c "root=844/844 unresolved=0" | sed 's/$/ boards clean/'
  echo "$OUT" | grep -vE "^== .* root=844/844 unresolved=0$" | cut -c1-300
  sleep 0.5
done
echo "=== mock time-up"
FAST_MOCK=1 bash run.sh step.js 'TShell?screen=MockRun' '[{"click":"button:has-text(\"Start\")","after":800},{"wait":3600},{"text":"[lang=ja]:has-text(\"時間切れ\")"},{"shot":"fm-timeup"}]' 2>&1 | cut -c1-300
sleep 0.5
echo "=== exam-style time-up"
FAST_EXAM=1 bash run.sh step.js 'TShell?screen=Exam' '[{"wait":5200},{"text":"div:has-text(\"Time is up\") >> nth=-1"},{"shot":"fe-timeup"}]' 2>&1 | cut -c1-300
echo "=== done"
