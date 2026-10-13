#!/bin/bash
# Builds check/site: the artboards exactly as published, served next to the canvas runtime
# (as ./support.js) and local copies of the two typefaces, so screens can be run for real.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$HERE/../yaoki/project"
RUNTIME="$HERE/../artifact-files/628b3861-d421-42e3-bf73-3108792aff8d/artifact-type/dc-runtime.js"
SITE="$HERE/site"
PORT="${PORT:-8765}"
rm -rf "$SITE"
mkdir -p "$SITE/fonts"
cp "$PROJECT"/*.dc.html "$SITE"/
# the sound player and its two data scripts sit next to the screens
cp "$PROJECT"/*.js "$SITE"/ 2>/dev/null || true
cp "$RUNTIME" "$SITE/support.js"
# TShell: the prototype frame with its starting state taken from the URL, for testing mid-flow states
if [ -f "$SITE/App.dc.html" ]; then
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
# FAST_MOCK=1 shortens the mini mock section clocks to 3 seconds in the test copy only, to reach the time-up path
if [ -n "$FAST_MOCK" ]; then sed -i "s/en: 'Vocabulary, grammar, reading', total: 600/en: 'Vocabulary, grammar, reading', total: 3/" "$SITE/MockRun.dc.html"; grep -q "total: 3," "$SITE/MockRun.dc.html" || echo "WARNING: FAST_MOCK patch did not apply"; fi
# FAST_EXAM=1 shortens the exam-style clock to 4 seconds in the test copy only, to reach the time-up state
if [ -n "$FAST_EXAM" ]; then sed -i "s/day: { seconds: 150,/day: { seconds: 4,/" "$SITE/Exam.dc.html"; grep -q "seconds: 4," "$SITE/Exam.dc.html" || echo "WARNING: FAST_EXAM patch did not apply"; fi
ln -s "$HERE/node_modules/@fontsource/m-plus-rounded-1c" "$SITE/fonts/m-plus-rounded-1c"
ln -s "$HERE/node_modules/@fontsource/klee-one" "$SITE/fonts/klee-one"
: > "$SITE/fonts.css"
for f in m-plus-rounded-1c/500.css m-plus-rounded-1c/700.css m-plus-rounded-1c/800.css klee-one/400.css klee-one/600.css; do
  pkg="${f%%/*}"
  sed "s#url(./files/#url(http://localhost:$PORT/fonts/$pkg/files/#g" "$HERE/node_modules/@fontsource/$f" >> "$SITE/fonts.css"
done
echo "site ready: $(ls "$SITE" | wc -l) entries, fonts.css $(wc -c < "$SITE/fonts.css") bytes"
