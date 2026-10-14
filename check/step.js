// Drives one artboard in the real runtime through a list of steps.
// usage: node step.js <Board> '<json steps>'
// steps: {"click":"selector"} | {"shot":"name"} | {"text":"selector"} | {"wait":ms} | {"count":"selector"} | {"url":1} | {"audio":1}
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, inspect, site, out } = require('./rt-check.js');

(async () => {
  const board = process.argv[2];
  const steps = JSON.parse(process.argv[3] || '[]');
  const fontsCss = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8');
  const browser = await chromium.launch();
  const [bname, bquery] = board.split('?');
  const { page, logs } = await openBoard(browser, bname + '.dc.html' + (bquery ? '?' + bquery : ''), fontsCss);
  for (const st of steps) {
    try {
      if (st.click) { await page.locator(st.click).first().click({ timeout: 4000 }); await page.waitForTimeout(st.after || 350); }
      else if (st.wait) await page.waitForTimeout(st.wait);
      else if (st.text) console.log(`text[${st.text}] = ` + JSON.stringify((await page.locator(st.text).allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim().slice(0, 120))));
      else if (st.count) console.log(`count[${st.count}] = ` + (await page.locator(st.count).count()));
      else if (st.url) console.log('url = ' + page.url());
      else if (st.audio) console.log('audio = ' + JSON.stringify(await page.evaluate(() => (window.__audio || []).map((a) => a.ev + ' ' + a.d + ' @' + a.t))) + ' on=' + (await page.evaluate(() => !!(window.ykSound && window.ykSound.on()))));
      else if (st.shot) {
        const info = await inspect(page);
        await page.screenshot({ path: path.join(out, 'st-' + st.shot + '.png') });
        console.log(`shot ${st.shot}: root=${info.rootH} unresolved=${info.unresolved}` + (info.errors.length ? ' ERRORS ' + JSON.stringify(info.errors) : '') + (info.issues.length ? '\n   ' + info.issues.join('\n   ') : '') + (info.pad.length ? '\n   ' + info.pad.join('\n   ') : ''));
      }
    } catch (e) {
      console.log('STEP FAILED ' + JSON.stringify(st) + ': ' + String(e).split('\n')[0]);
    }
  }
  if (logs.length) console.log('console: ' + JSON.stringify(logs.slice(0, 8)));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
