// The N1 notebook entries (YK_LEVEL=N1 bash run-app.sh nb-check-n1.js): the check of nb-check.js with the longest wrong label of each N1 exercise.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, inspect, site, out } = require('./rt-check.js');

const WORST = {
  drill: 'といえども', star: '順番が違う', exam1: 'にひきかえ', exam2: 'とあって', exam3: '紹介された', scene: 'ふくぎゅう',
  reading: '回り道には必ず発見がある', listening: '手伝ってくれて助かった',
  mock1: 'はばんだ', mock2: '座礁', mock3: 'たびたび', mock4: 'ひたむきに笑い出した', mock5: 'までもなく', mock6: '言わない', mock7: 'わけにはいかない',
  mock8: '恐れる人は成長できない', mock9: 'Bは教えるべきでないとする', mock10: '会議室を予約し直す', mock11: 'スマートフォンで読む利点', mock12: '無理をしないで進めて',
};
(async () => {
  const fontsCss = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8');
  const browser = await chromium.launch();
  const keys = Object.keys(WORST);
  let bad = 0;
  for (let i = 0; i < keys.length; i += 3) {
    const group = keys.slice(i, i + 3);
    // "at" keeps the three in the order given and ahead of the two older entries
    const m = group.map((k, j) => ({ src: k, wrong: WORST[k], at: 9 - j }));
    const { page, logs } = await openBoard(browser, 'TShell.dc.html?screen=Notebook&m=' + encodeURIComponent(JSON.stringify(m)), fontsCss);
    const info = await inspect(page);
    const rows = await page.evaluate(() => [...document.querySelectorAll('div[lang=ja]')].filter((d) => d.style.fontSize === '15px').map((d) => {
      const r = document.createRange(); r.selectNodeContents(d);
      const lines = new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
      const ans = d.nextElementSibling;
      const tops = new Set([...ans.children].map((c) => Math.round(c.getBoundingClientRect().top)));
      return { t: d.textContent, w: Math.round(r.getBoundingClientRect().width), lines, ansLines: tops.size, ans: ans.textContent.replace(/\s+/g, ' ').trim() };
    }));
    const name = 'nb-' + group.join('-');
    await page.screenshot({ path: path.join(out, name + '.png') });
    for (const r of rows) { const flag = r.lines > 1 ? '  <-- WRAPS' : ''; if (r.lines > 1) bad += 1; console.log(`${String(r.w).padStart(4)}px lines=${r.lines} ans=${r.ansLines}  ${r.t}  |  ${r.ans}${flag}`); }
    if (info.errors.length || info.issues.length || info.unresolved) { bad += 1; console.log('   PROBLEMS ' + JSON.stringify(info)); }
    if (logs.length) console.log('   console: ' + JSON.stringify(logs.slice(0, 4)));
    await page.close();
  }
  // the two older entries on their own, and the cleared line
  for (const q of ['', '&rev=' + encodeURIComponent(JSON.stringify({ at: 1, kanji: true, listen: true }))]) {
    const { page } = await openBoard(browser, 'TShell.dc.html?screen=Notebook' + q, fontsCss);
    const info = await inspect(page);
    const rows = await page.evaluate(() => [...document.querySelectorAll('div[lang=ja]')].filter((d) => d.style.fontSize === '15px').map((d) => { const r = document.createRange(); r.selectNodeContents(d); return d.textContent + ' lines=' + new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size; }));
    const cleared = await page.evaluate(() => { const d = [...document.querySelectorAll('div')].find((x) => x.children.length === 1 && x.textContent.startsWith('Cleared today')); if (!d) return 'none'; const r = document.createRange(); r.selectNodeContents(d); return d.textContent + ' lines=' + new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size; });
    console.log('older: ' + JSON.stringify(rows) + ' | cleared: ' + cleared + (info.issues.length ? ' PROBLEMS ' + JSON.stringify(info.issues) : ''));
    await page.screenshot({ path: path.join(out, 'nb-older' + (q ? '-cleared' : '') + '.png') });
    await page.close();
  }
  console.log(bad ? 'NOTEBOOK CHECK: ' + bad + ' problem(s)' : 'NOTEBOOK CHECK PASS');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
