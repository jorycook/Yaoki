const fs = require('fs'); const path = require('path'); const { chromium } = require('playwright');
const { openBoard, site, out } = require('./rt-check.js');
(async () => {
  const css = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8'); const b = await chromium.launch();
  const tap = (p, s) => p.locator(s).first().click({ timeout: 4000 }).then(() => p.waitForTimeout(300));
  // drill item 6 (a star item) of day 2: answer the first five
  let { page } = await openBoard(b, 'TShell.dc.html?screen=Drill&level=N5&cur=n5u01d2', css);
  const d = await page.evaluate(() => window.ykCourse.day('n5u01d2').grammar.drill);
  const plain = (t) => t.replace(/\[([^|\]]*)\|[^\]]*\]/g, '$1');
  for (let j = 0; j < 5; j++) { const it = d[j]; if (it.kind === 'star') { for (const t of it.tiles) await tap(page, `button[aria-label="${plain(t)}"]`); } else await tap(page, `button[aria-pressed] >> nth=${it.answer - 1}`); await tap(page, 'button:has-text("Check")'); await tap(page, 'a:has-text("Next")'); }
  await tap(page, `button[aria-label="${plain(d[5].tiles[0])}"]`);
  await page.screenshot({ path: path.join(out, 'n5b-drill.png') }); await page.close();
  ({ page } = await openBoard(b, 'TShell.dc.html?screen=Exam&level=N5&cur=n5u01d6&set=day', css));
  for (let j = 0; j < 2; j++) { await tap(page, 'button[aria-pressed] >> nth=0'); await tap(page, 'button:has-text("Next")'); }
  await page.screenshot({ path: path.join(out, 'n5b-exam.png') }); await page.close();
  ({ page } = await openBoard(b, 'TShell.dc.html?screen=Scene&level=N5&cur=n5u01d5', css));
  await page.screenshot({ path: path.join(out, 'n5b-scene.png') }); await page.close();
  await b.close();
})();
