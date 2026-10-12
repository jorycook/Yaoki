// Local render check: turns each artboard into plain HTML (same markup, real fonts
// from @fontsource), screenshots it at 390x844 and reports clipping / overflow.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = process.argv[2];
const out = process.argv[3];
const fontBase = process.argv[4];

(async () => {
  const canvas = JSON.parse(fs.readFileSync(path.join(root, 'canvas.json'), 'utf8'));
  const names = Object.keys(canvas.boards);
  const browser = await chromium.launch();
  const fontCss = [
    'm-plus-rounded-1c/500.css', 'm-plus-rounded-1c/700.css', 'm-plus-rounded-1c/800.css',
    'klee-one/400.css', 'klee-one/600.css',
  ].map((f) => `<link rel="stylesheet" href="file://${fontBase}/@fontsource/${f}">`).join('');
  const report = [];
  for (const name of names) {
    const src = fs.readFileSync(path.join(root, name), 'utf8');
    const helmet = (src.match(/<helmet>([\s\S]*?)<\/helmet>/) || [])[1] || '';
    const styles = (helmet.match(/<style>[\s\S]*?<\/style>/g) || []).join('');
    const body = src.split('</helmet>')[1].split('</x-dc>')[0];
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">${fontCss}${styles}</head><body>${body}</body></html>`;
    const file = path.join(out, name.replace('.dc.html', '.html'));
    fs.writeFileSync(file, html);
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await page.goto('file://' + file);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const info = await page.evaluate(() => {
      const rootEl = document.body.firstElementChild;
      const res = { rootScrollH: rootEl.scrollHeight, rootClientH: rootEl.clientHeight, rootScrollW: rootEl.scrollWidth, issues: [] };
      for (const el of rootEl.querySelectorAll('*')) {
        if (el.closest('svg')) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const tag = el.tagName.toLowerCase();
        const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28);
        if (r.right > 390.5 || r.left < -0.5 || r.bottom > 844.5) res.issues.push(`OUT ${tag} "${txt}" l=${Math.round(r.left)} r=${Math.round(r.right)} b=${Math.round(r.bottom)}`);
        if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) res.issues.push(`OVERFLOW-X ${tag} "${txt}" sw=${el.scrollWidth} cw=${el.clientWidth}`);
        if (el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 1 && el !== rootEl) res.issues.push(`OVERFLOW-Y ${tag} "${txt}" sh=${el.scrollHeight} ch=${el.clientHeight}`);
        if ((tag === 'button' || tag === 'a') && (r.height < 43.5 || r.width < 43.5)) res.issues.push(`SMALL ${tag} "${txt}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      // free space left above the bottom inset inside the root (spacer height), if any
      res.fontsLoaded = [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '') + ' ' + f.weight))];
      return res;
    });
    await page.screenshot({ path: path.join(out, name.replace('.dc.html', '.png')) });
    report.push({ name, ...info });
    await page.close();
  }

  // contact sheets, one per canvas row
  const rows = {};
  for (const name of names) {
    const b = canvas.boards[name];
    (rows[b.y] = rows[b.y] || []).push({ name, x: b.x });
  }
  let i = 0;
  for (const y of Object.keys(rows).map(Number).sort((a, b) => a - b)) {
    i += 1;
    const items = rows[y].sort((a, b) => a.x - b.x);
    const imgs = items.map((it) => `<img src="file://${path.join(out, it.name.replace('.dc.html', '.png'))}" width="390" height="844" style="border-radius:28px;display:block">`).join('');
    const html = `<!doctype html><html><body style="margin:0;background:#888"><div style="display:flex;gap:24px;padding:24px;width:max-content">${imgs}</div></body></html>`;
    const page = await browser.newPage({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 1 });
    const sheet = path.join(out, `row${i}.html`);
    fs.writeFileSync(sheet, html);
    await page.goto('file://' + sheet);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `row${i}.png`), fullPage: true });
    await page.close();
  }
  await browser.close();
  for (const r of report) {
    console.log(`\n== ${r.name}  root scrollH=${r.rootScrollH} clientH=${r.rootClientH} scrollW=${r.rootScrollW}`);
    console.log('   fonts: ' + r.fontsLoaded.join(', '));
    for (const s of r.issues) console.log('   ' + s);
  }
})().catch((e) => { console.error(e); process.exit(1); });
