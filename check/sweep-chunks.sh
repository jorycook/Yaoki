#!/bin/bash
# Sweeps a level's days a few units at a time (one long run outlives its timeout).
# usage: LEVEL=N4 bash sweep-chunks.sh <logdir> "1 2" "3 4" ...
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
LOGDIR="$1"; shift
lv=$(echo "${LEVEL:-N4}" | tr 'N' 'n')
for group in "$@"; do
  D=$(python3 -c "import sys;print(','.join(f'$lv' + f'u{u:02d}d{d}' for u in map(int, sys.argv[1:]) for d in range(1, 7)))" $group)
  NOSOUND=1 DAYS="$D" timeout 2400 bash run.sh content-sweep.js > "$LOGDIR/sw-${group// /-}.log" 2>&1
done
