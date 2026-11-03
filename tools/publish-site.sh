#!/bin/bash
# Publishes the website into docs/, as GitHub Pages serves it: the home page and the shared look from yaoki-site/, the Study app
# from yaoki-app/dist (built with `node build.mjs`) into docs/study/, the N1 course from yaoki-app/dist-n1 (`YK_LEVEL=N1
# node build.mjs`) into docs/n1/. The reader, the typing page and the speaking page are source in docs/ and are left alone.
# usage: bash tools/publish-site.sh            (after both builds)
set -e
HERE="$(cd "$(dirname "$0")/.." && pwd)"
DOCS="$HERE/docs"
for d in dist dist-n1; do [ -f "$HERE/yaoki-app/$d/index.html" ] || { echo "yaoki-app/$d is not built"; exit 1; }; done
mkdir -p "$DOCS/site"
cp "$HERE/yaoki-site/site.css" "$HERE/yaoki-site/site.js" "$DOCS/site/"
cp "$HERE/yaoki-site/index.html" "$DOCS/index.html"
rm -rf "$DOCS/study" "$DOCS/n1"
# nothing of an app at the root (an older layout had the Study app there; a worker left at the root would hold every page)
rm -rf "$DOCS/assets" "$DOCS/icons" "$DOCS/licenses.txt" "$DOCS/manifest.webmanifest" "$DOCS/sw.js"
cp -a "$HERE/yaoki-app/dist" "$DOCS/study"
cp -a "$HERE/yaoki-app/dist-n1" "$DOCS/n1"
# the licence texts come with Windows line endings from the typeface's licence file; the repository keeps them as plain lines
sed -i 's/\r$//' "$DOCS/study/licenses.txt" "$DOCS/n1/licenses.txt"
: > "$DOCS/.nojekyll"
echo "published: $(tail -n 1 "$DOCS/study/assets/build.js" | cut -d'"' -f2) and $(tail -n 1 "$DOCS/n1/assets/build.js" | cut -d'"' -f2)"
