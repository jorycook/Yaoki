// Opens every screen of the app build on its own (YK_APP=1, via run-app.sh) and reports runtime errors,
// console problems and anything that leaves the 390 by 844 frame; saves a screenshot of each (out/app-<level>-<screen>.png).
// The N1 app has a screen for each state its plan can put it in: these are made from the course itself, on 14 Oct 2026.
// usage: bash run-app.sh screens-app.js            YK_LEVEL=N1 bash run-app.sh screens-app.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, inspect, out } = require('./rt-check.js');

const LEVEL = process.env.YK_LEVEL || 'N2';
const SCREENS = require('./screen-states.js')(LEVEL);

(async () => {
  const browser = await chromium.launch();
  let bad = 0;
  let pads = 0;
  for (const [screen, q, label, taps] of SCREENS) {
    const { page, logs } = await openBoard(browser, 'TShell.dc.html?screen=' + screen + q, '');
    let failed = '';
    for (const sel of taps || []) {
      try { await page.locator(sel).first().click({ timeout: 4000 }); await page.waitForTimeout(450); } catch (e) { failed = sel; break; }
    }
    if (taps) await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect.getTiming().iterations === Infinity), null, { timeout: 3000 }).catch(() => {});
    const info = await inspect(page);
    const name = screen + (label ? '-' + label : q ? '-' + q.replace(/[^a-z0-9]+/gi, '').slice(0, 12) : '');
    await page.screenshot({ path: path.join(out, 'app-' + LEVEL + '-' + name + '.png') });
    const noisy = logs.filter((l) => !/Download the React DevTools/.test(l));
    const flag = info.errors.length || info.issues.length || info.unresolved || noisy.length || failed;
    if (flag) bad += 1;
    pads += info.pad.length;
    console.log(`${name}: root=${info.rootH}` + (flag ? ' PROBLEMS ' + JSON.stringify({ e: info.errors, i: info.issues, u: info.unresolved, c: noisy.slice(0, 4), tap: failed || undefined }) : '') + (info.pad.length ? ' PAD WARNING ' + JSON.stringify(info.pad) : ''));
    await page.close();
  }
  if (pads) console.log(`PAD WARNINGS: ${pads} (content in the bottom 34 px)`);
  console.log(bad ? `SCREENS ${LEVEL}: ${bad} problem(s)` : `SCREENS ${LEVEL} PASS`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
