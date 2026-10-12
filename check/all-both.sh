#!/bin/bash
cd "$(dirname "$0")"
echo "##### canvas"; bash ./all.sh
echo "##### app"; bash ./all-app.sh
echo "##### app-only checks"; timeout 500 bash ./run-app.sh app-test.js 2>&1 | tail -8
echo "##### preview"; NODE_PATH=/opt/npm-tools/node_modules node preview-test.js 2>&1 | tail -4
echo "##### all done"
