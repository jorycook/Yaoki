#!/bin/bash
# Runs the whole test matrix and prints one line per run. usage: bash all.sh
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
F='FAIL|PASS|PROBLEMS|problem\(s\)|console problems: \[.+\]|STEP FAILED|Error|took'
run() { # label, env..., script
  local label="$1"; shift
  pkill -f "[h]ttp.server 8765" 2>/dev/null; sleep 0.5
  echo "=== $label"
  env "$@" 2>&1 | grep -E "$F" | cut -c1-400
}
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
run "sound decode"                timeout 120 bash run.sh sound-test.js
pkill -f "[h]ttp.server 8765" 2>/dev/null; sleep 0.5
for mode in "" OMELETTE; do
  echo "=== every board${mode:+, mode 2}"
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
