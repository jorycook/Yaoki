#!/bin/bash
# The writing practice is one panel and one engine for both apps: they are kept in the main app's screens
# (yaoki/project/Write.dc.html, yk-write.js) and copied to the N1 app's here. Run after changing either.
# --check only says whether the two copies are the same (release-checks.sh runs it).
HERE="$(cd "$(dirname "$0")" && pwd)"
FROM="$HERE/../yaoki/project"
TO="$HERE/../yaoki-n1/project"
if [ "$1" = "--check" ]; then
  bad=0
  for f in Write.dc.html yk-write.js; do cmp -s "$FROM/$f" "$TO/$f" || { echo "SYNC-WRITE FAIL: $f differs between the two apps (run tools/sync-write.sh)"; bad=1; }; done
  [ $bad = 0 ] && echo "SYNC-WRITE PASS: the two apps have the same writing panel and engine"
  exit $bad
fi
for f in Write.dc.html yk-write.js; do cp "$FROM/$f" "$TO/$f"; done
echo "sync-write: copied Write.dc.html and yk-write.js to yaoki-n1/project"
