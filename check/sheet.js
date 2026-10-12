// usage: node sheet.js <outname> <shot1> <shot2> ...   (shots are out/st-<name>.png or out/<name>.png)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const out = path.join(__dirname, 'out');
  const [name, ...shots] = process.argv.slice(2);
  const imgs = shots.map((s) => {
    const f = fs.existsSync(path.join(out, 'st-' + s + '.png')) ? 'st-' + s + '.png' : s + '.png';
    return `<figure style="margin:0"><img src="file://${path.join(out, f)}" width="390" height="844" style="border-radius:28px;display:block"><figcaption style="font:14px sans-serif;color:#fff;padding:4px 8px">${s}</figcaption></figure>`;
  }).join('');
  const html = `<!doctype html><html><body style="margin:0;background:#777"><div style="display:flex;gap:20px;padding:20px;width:max-content">${imgs}</div></body></html>`;
  const file = path.join(out, name + '.html');
  fs.writeFileSync(file, html);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 1 });
  await page.goto('file://' + file);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
  await browser.close();
})();
