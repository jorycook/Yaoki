#!/bin/bash
# Builds check/site: the artboards exactly as published, served next to the canvas runtime
# (as ./support.js) and local copies of the two typefaces, so screens can be run for real.
# YK_LEVEL=N1 builds it from the N1 screens instead (yaoki-n1/project), with the course and its clip files.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
LEVEL="${YK_LEVEL:-N2}"
PROJECT="$HERE/../yaoki/project"
[ "$LEVEL" = "N1" ] && PROJECT="$HERE/../yaoki-n1/project"
RUNTIME="$HERE/../artifact-files/628b3861-d421-42e3-bf73-3108792aff8d/artifact-type/dc-runtime.js"
SITE="$HERE/site"
PORT="${PORT:-8765}"
rm -rf "$SITE"
mkdir -p "$SITE/fonts"
cp "$PROJECT"/*.dc.html "$SITE"/
# the sound player and its two data scripts sit next to the screens (for N1 also the course, the plan and audio/, its clips)
cp "$PROJECT"/*.js "$SITE"/ 2>/dev/null || true
[ -d "$PROJECT/audio" ] && cp -r "$PROJECT/audio" "$SITE/audio"
cp "$RUNTIME" "$SITE/support.js"
# TShell: the prototype frame with its starting state taken from the URL, for testing mid-flow states
# For N1 the plan comes from the address too, as in the app's test mode: plan=demo (the sample plan) or the plan itself, day=n opens that day
if [ -f "$SITE/App.dc.html" ] && [ "$LEVEL" = "N1" ]; then
  sed "s#this.state = { screen: 'Goal', g: 0, k: 0, r: 0, mistakes: \[\], rev: null, mock: null, plan: null };#const q = new URLSearchParams(location.search); const plan = q.get('plan') === 'demo' ? window.ykN1.demo() : JSON.parse(q.get('plan') || 'null'); if (plan \&\& q.has('day')) plan.open = +q.get('day'); this.state = { screen: q.get('screen') || 'Goal', g: 0, k: 0, r: 0, mistakes: JSON.parse(q.get('m') || '[]'), rev: JSON.parse(q.get('rev') || 'null'), mock: JSON.parse(q.get('mock') || 'null'), plan };#" "$SITE/App.dc.html" > "$SITE/TShell.dc.html"
  grep -c "URLSearchParams" "$SITE/TShell.dc.html" >/dev/null || echo "WARNING: TShell patch did not apply"
elif [ -f "$SITE/App.dc.html" ]; then
  python3 - "$SITE/App.dc.html" "$SITE/TShell.dc.html" <<'PY'
import sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
a = "this.state = window.ykCourse.fresh();"
b = ("const q = new URLSearchParams(location.search); const j = (k, d) => { try { return JSON.parse(q.get(k) || 'null') || d; } catch (e) { return d; } }; "
     "if (q.get('now')) window.__ykNow = +q.get('now'); "
     "const screen = q.get('screen') || 'Goal'; "
     "this.state = { ...window.ykCourse.fresh(), screen, started: screen !== 'Goal', plan: j('plan', screen !== 'Goal' ? { start: window.ykCourse.today(window.ykCourse.now()), exam: '2026-12-06', pace: 'fit' } : null), done: j('done', {}), tests: j('tests', {}), mistakes: j('m', []), mock: j('mock', null), level: q.get('level'), plans: j('plans', {}), cur: q.get('cur'), tp: +(q.get('tp') || 0), set: q.get('set') || 'day' };")
if a not in s: sys.exit('TShell patch did not apply')
open(dst, 'w', encoding='utf-8').write(s.replace(a, b))
PY
fi
# FAST_MOCK=1 shortens the mini mock section clocks to 3 seconds in the test copy only, to reach the time-up path:
# the main app's mock gives its first section 600 seconds; the N1 mock runs its clocks at the rate CLOCK
if [ -n "$FAST_MOCK" ] && [ "$LEVEL" = "N1" ]; then sed -i "s/const CLOCK = 1;/const CLOCK = 0.005;/" "$SITE/MockRun.dc.html"; grep -q "const CLOCK = 0.005;" "$SITE/MockRun.dc.html" || echo "WARNING: FAST_MOCK patch did not apply"
elif [ -n "$FAST_MOCK" ]; then sed -i "s/en: 'Vocabulary, grammar, reading', total: 600/en: 'Vocabulary, grammar, reading', total: 3/" "$SITE/MockRun.dc.html"; grep -q "total: 3," "$SITE/MockRun.dc.html" || echo "WARNING: FAST_MOCK patch did not apply"; fi
# FAST_EXAM=1 shortens the exam-style clock to 4 seconds in the test copy only, to reach the time-up state:
# the main app sets it in the day settings of Exam.dc.html, the N1 Exam screen in TOTAL
if [ -n "$FAST_EXAM" ] && [ "$LEVEL" = "N1" ]; then sed -i "s/const TOTAL = 150;/const TOTAL = 4;/" "$SITE/Exam.dc.html"; grep -q "const TOTAL = 4;" "$SITE/Exam.dc.html" || echo "WARNING: FAST_EXAM patch did not apply"
elif [ -n "$FAST_EXAM" ]; then sed -i "s/day: { seconds: 150,/day: { seconds: 4,/" "$SITE/Exam.dc.html"; grep -q "seconds: 4," "$SITE/Exam.dc.html" || echo "WARNING: FAST_EXAM patch did not apply"; fi
ln -s "$HERE/node_modules/@fontsource/m-plus-rounded-1c" "$SITE/fonts/m-plus-rounded-1c"
ln -s "$HERE/node_modules/@fontsource/klee-one" "$SITE/fonts/klee-one"
: > "$SITE/fonts.css"
for f in m-plus-rounded-1c/500.css m-plus-rounded-1c/700.css m-plus-rounded-1c/800.css klee-one/400.css klee-one/600.css; do
  pkg="${f%%/*}"
  sed "s#url(./files/#url(http://localhost:$PORT/fonts/$pkg/files/#g" "$HERE/node_modules/@fontsource/$f" >> "$SITE/fonts.css"
done
echo "site ready: $(ls "$SITE" | wc -l) entries, fonts.css $(wc -c < "$SITE/fonts.css") bytes"
