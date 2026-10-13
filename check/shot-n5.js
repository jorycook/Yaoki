// screenshots of N5 screens for a look by eye
const fs = require('fs'); const path = require('path'); const { chromium } = require('playwright');
const { openBoard, site, out } = require('./rt-check.js');
(async () => {
  const css = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8'); const b = await chromium.launch();
  const shots = [['Goal', ''], ['Main', '&cur=n5u01d1'], ['Teach', '&cur=n5u01d1'], ['Drill', '&cur=n5u01d3'], ['Listening', '&cur=n5u01d1'], ['Reading', '&cur=n5u01d6'], ['Scene', '&cur=n5u01d5'], ['Exam', '&cur=n5u01d4&set=day']];
  for (const [scr, q] of shots) {
    const { page } = await openBoard(b, 'TShell.dc.html?screen=' + scr + '&level=N5' + q, css);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `n5-${scr}.png`) }); await page.close();
  }
  await b.close();
})();
