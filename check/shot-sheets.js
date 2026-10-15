// screenshots of the answered Listening and Reading sheets, for a look by eye
const fs = require('fs'); const path = require('path'); const { chromium } = require('playwright');
const { openBoard, site, out } = require('./rt-check.js');
(async () => {
  const css = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8'); const b = await chromium.launch();
  const tap = (p, s) => p.locator(s).first().click({ timeout: 4000 }).then(() => p.waitForTimeout(400));
  for (const [scr, cur, k] of [['Listening', 'u03d1', 1], ['Listening', 'u03d3', 0], ['Reading', 'u03d2', 0], ['Reading', 'u03d6', 0]]) {
    const { page } = await openBoard(b, 'TShell.dc.html?screen=' + scr + '&cur=' + cur, css);
    if (scr === 'Listening') { await tap(page, 'button[aria-label="Play audio"]'); await page.waitForFunction(() => !document.querySelector('button[aria-pressed][disabled]'), null, { timeout: 60000 }); }
    await tap(page, `button[aria-pressed] >> nth=${k}`);
    if (scr === 'Reading') await tap(page, 'button:has-text("Check")');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `sheet-${scr}-${cur}.png`) }); await page.close();
  }
  await b.close();
})();
