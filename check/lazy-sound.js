// The N5 unit sound is fetched when the unit is in use, in the canvas and in the app.
const fs = require('fs'); const path = require('path'); const { chromium } = require('playwright');
const { openBoard, site } = require('./rt-check.js');
(async () => {
  const css = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8'); const b = await chromium.launch(); let bad = 0;
  for (const [cur, key, notKey] of [['n5u03d1', 'x_n5u03d1_p1_1', 'x_n5u05d1_p1_1'], ['n5u08d5', 's_n5u8d5_oclock', 'x_n5u01d1_p1_1']]) {
    const { page } = await openBoard(b, 'TShell.dc.html?screen=Teach&level=N5&cur=' + cur, css);
    await page.waitForTimeout(1500);
    const r = await page.evaluate(([k, n]) => ({ has: !!(window.__ykClips && window.__ykClips[k]), other: !!(window.__ykClips && window.__ykClips[n]) }), [key, notKey]);
    console.log(cur, JSON.stringify(r)); if (!r.has || r.other) bad++;
    await page.close();
  }
  await b.close(); console.log(bad ? 'LAZY SOUND FAIL' : 'LAZY SOUND PASS'); process.exit(bad ? 1 : 0);
})();
