// Checks for the Yaoki Library in the reader (docs/reader/library/, listed from docs/reader/index.html).
// usage: bash run-reader.sh library-test.js
// First the catalog and its files are checked on disk, so a new work cannot be published with a part that is
// missing, too long or in the wrong encoding. Then the library is used in a phone-sized browser: the button sits
// just under From Aozora Bunko, every work in the catalog opens and lists its parts, adding all parts puts them
// in the library in reading order, a part reads its whole text, and a catalog that fails to load says so.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SITE = 'http://127.0.0.1:8766/Yaoki/';
const READER = SITE + 'reader/';
const LIB = path.join(__dirname, '..', 'docs', 'reader', 'library');
const MAX = 30000;   // the reader's limit for one text
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok: ' : '  FAIL: ') + msg); if (!cond) fails += 1; };
const step = (msg) => console.log('-- ' + msg);
const norm = (raw) => raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/\s+$/, '');

step('the catalog and its files');
let cat = null;
try { cat = JSON.parse(fs.readFileSync(path.join(LIB, 'catalog.json'), 'utf8')); } catch (e) { ok(false, 'catalog.json is valid JSON (' + e.message + ')'); }
const works = (cat && cat.works) || [];
ok(works.length > 0, works.length + ' works in the catalog');
const ids = new Set();
const texts = {};
for (const w of works) {
  ok(w.id && /^[a-z0-9-]+$/.test(w.id) && !ids.has(w.id), (w.id || '(no id)') + ': has its own id');
  ids.add(w.id);
  ok(typeof w.title === 'string' && w.title.trim(), w.id + ': has a title');
  ok(!w.level || /^N[1-5]$/.test(w.level), w.id + ': level is N1 to N5 or left out (' + w.level + ')');
  ok(Array.isArray(w.parts) && w.parts.length > 0, w.id + ': has ' + ((w.parts || []).length) + ' parts');
  texts[w.id] = [];
  for (const p of w.parts || []) {
    const file = path.join(LIB, p.file || '');
    const inside = path.resolve(file).startsWith(path.resolve(LIB) + path.sep);
    ok(inside && fs.existsSync(file), w.id + ': ' + p.file + ' is there');
    if (!inside || !fs.existsSync(file)) continue;
    const bytes = fs.readFileSync(file);
    let raw = '';
    try { raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) { ok(false, p.file + ' is UTF-8'); continue; }
    const text = norm(raw);
    ok(text.length > 0 && text.length <= MAX, p.file + ': ' + text.length + ' characters (1 to ' + MAX + ')');
    ok(/[぀-ヿ㐀-鿿]/.test(text), p.file + ': holds Japanese text');
    ok(!/[《》｜［＃]/.test(text), p.file + ': no Aozora notation or ruby markup left in it');
    let glosses = null;
    if (p.glosses) {
      const gf = path.join(LIB, p.glosses);
      const gin = path.resolve(gf).startsWith(path.resolve(LIB) + path.sep);
      ok(gin && fs.existsSync(gf), w.id + ': ' + p.glosses + ' is there');
      if (gin && fs.existsSync(gf)) {
        try { glosses = JSON.parse(fs.readFileSync(gf, 'utf8')); } catch (e) { ok(false, p.glosses + ' is valid JSON (' + e.message + ')'); }
        const maps = ['gl', 'glx', 'rd', 'rdx', 'sf', 'bf', 'bfx'].filter((k) => glosses && glosses[k] && typeof glosses[k] === 'object');
        ok(glosses && maps.length > 0, p.glosses + ': holds override maps (' + maps.join(', ') + ')');
        if (glosses && glosses.gl) ok(Object.values(glosses.gl).every((v) => typeof v === 'string' && v.trim()), p.glosses + ': every gloss is a non-empty string');
      }
    }
    texts[w.id].push({ title: p.title, text, glosses });
  }
}

async function newPage(ctx, logs) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => logs.push('pageerror: ' + String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text()) && !/ERR_FAILED|net::|404|500/.test(m.text())) logs.push('console: ' + m.text().slice(0, 200)); });
  return page;
}
const cards = (page) => page.locator('#texts .tc-title').allInnerTexts();
const toastText = async (page) => { await page.waitForSelector('#toast:not([hidden])', { timeout: 5000 }); return page.locator('#toast').innerText(); };
const shownText = (page) => page.evaluate(() => {
  let o = '';
  document.querySelectorAll('#passage p').forEach((p) => { const c = p.cloneNode(true); c.querySelectorAll('.rt').forEach((r) => r.remove()); o += c.textContent; });
  return o;
});
const strip = (s) => s.replace(/\s+/g, '');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const logs = [];
  const out = process.env.OUT || path.join(require('os').tmpdir(), 'library-test');
  fs.mkdirSync(out, { recursive: true });
  const page = await newPage(ctx, logs);
  await page.goto(READER);
  await page.waitForSelector('#texts .text-card');

  step('the button');
  const order = await page.evaluate(() => {
    const a = document.getElementById('go-aoz'), b = document.getElementById('go-ykl');
    return a && b ? { next: a.nextElementSibling === b, label: b.innerText.replace(/\s+/g, ' ') } : null;
  });
  ok(order && order.next, 'From the Yaoki Library sits just under From Aozora Bunko');
  ok(order && /ヤオキ文庫/.test(order.label) && /Yaoki Library/.test(order.label), 'its label: ' + (order && order.label));
  const lines = await page.evaluate(() => { const s = document.querySelector('#go-ykl > span'); return Math.round(s.getBoundingClientRect().height / parseFloat(getComputedStyle(s).lineHeight)); });
  ok(lines === 1, 'the label fits on one line at phone width (' + lines + ')');
  await page.screenshot({ path: path.join(out, 'library-button.png') });

  step('the list of works');
  await page.click('#go-ykl');
  await page.waitForSelector('#ykl-works .text-card');
  const listed = await page.locator('#ykl-works .tc-title').allInnerTexts();
  ok(listed.length === works.length && works.every((w, i) => listed[i] === w.title), 'every work in the catalog is listed, in its order: ' + listed.join('、'));
  const tags = await page.locator('#ykl-works .tag').allInnerTexts();
  ok(works.filter((w) => w.level).length === tags.length, 'level tags: ' + tags.join(', '));
  await page.screenshot({ path: path.join(out, 'library-list.png') });

  for (const [k, w] of works.entries()) {
    step(w.title + ': the work page');
    await page.locator('#ykl-works .text-card').nth(k).click();
    await page.waitForSelector('#ykl-work [data-part]', { timeout: 15000 });
    ok(await page.locator('#ykl-work .work-h').innerText().then((t) => t.startsWith(w.title)), 'the work page shows its title');
    ok(await page.locator('#ykl-work [data-part]').count() === w.parts.length, w.parts.length + ' parts listed');
    const heads = await page.locator('#ykl-work .ps').allInnerTexts();
    ok(w.parts.every((p, i) => !p.title || heads[i].startsWith(p.title)), 'each part shows its title');
    await page.screenshot({ path: path.join(out, 'library-' + w.id + '.png') });

    const before = await cards(page);
    if (w.parts.length > 1) {
      await page.locator('#ykl-work .add-all').click();
      await page.waitForSelector('#v-lib:not([hidden])');
      const note = await toastText(page);
      ok(/Added \d+ parts? of /.test(note), 'adding all says so: ' + note);
    } else {
      await page.locator('#ykl-work [data-part]').click();
      await page.waitForSelector('#v-read:not([hidden])');
      await page.locator('#read-back').click();
    }
    const after = await cards(page);
    const titles = w.parts.map((p, i) => p.title || w.title + (w.parts.length > 1 ? '（' + (i + 1) + '/' + w.parts.length + '）' : ''));
    ok(titles.every((t) => after.includes(t)), 'all parts are in the library');
    const pos = titles.map((t) => after.indexOf(t));
    ok(pos.every((p, i) => i === 0 || p === pos[i - 1] + 1), 'in reading order, together (' + pos.join(', ') + ')');
    ok(after.length === before.length + w.parts.length, 'nothing else changed in the library');

    step(w.title + ': adding again changes nothing');
    await page.click('#go-ykl');
    await page.waitForSelector('#ykl-works .text-card');
    await page.locator('#ykl-works .text-card').nth(k).click();
    await page.waitForSelector('#ykl-work [data-part]');
    ok(await page.locator('#ykl-work [data-part].done').count() === w.parts.length, 'every part now says Read');
    if (w.parts.length > 1) ok(/All parts are in your library/.test(await page.locator('#ykl-work .add-all').innerText()), 'the add-all button says they are all in');

    step(w.title + ': reading a part');
    const pick = Math.min(1, w.parts.length - 1);
    await page.locator('#ykl-work [data-part="' + pick + '"]').click();
    await page.waitForSelector('#v-read:not([hidden])');
    await page.waitForSelector('#passage .ph', { timeout: 180000 });
    ok(await page.locator('#read-title').innerText() === titles[pick], 'the reader opens ' + titles[pick]);
    const n = await page.locator('#passage .ph').count();
    ok(strip(await shownText(page)) === strip(texts[w.id][pick].text), titles[pick] + ': ' + texts[w.id][pick].text.length + ' characters, ' + n + ' phrases, the whole text is shown');
    const gl = texts[w.id][pick].glosses;
    if (gl && gl.gl) {
      /* the part's own glosses: hold a phrase holding one of its words and read the lens */
      const probe = { shimatsusho: ['仰いました', /honorific/, /look up/] }[w.id] || null;
      if (probe) {
        const idx = await page.evaluate((f) => {
          const all = Array.from(document.querySelectorAll('#passage .ph'));
          return all.findIndex((b) => { const c = b.cloneNode(true); c.querySelectorAll('.rt').forEach((r) => r.remove()); return c.textContent.includes(f); });
        }, probe[0]);
        ok(idx >= 0, titles[pick] + ': has a phrase with ' + probe[0]);
        if (idx >= 0) {
          const ph = page.locator('#passage .ph').nth(idx);
          await ph.scrollIntoViewIfNeeded();
          const b = await ph.boundingBox();
          await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
          await page.mouse.down();
          await page.waitForTimeout(250);
          const lens = await page.locator('#lens').innerText();
          await page.mouse.up();
          ok(probe[1].test(lens) && !probe[2].test(lens), titles[pick] + ': holding ' + probe[0] + ' shows the gloss chosen for the text (' + lens.replace(/\s+/g, ' ').slice(0, 70) + ')');
        }
      }
    }
    await page.screenshot({ path: path.join(out, 'library-' + w.id + '-read.png') });
    await page.locator('#read-back').click();
    await page.waitForSelector('#v-lib:not([hidden])');
  }

  step('back from a work goes to the list, then to the library');
  await page.click('#go-ykl');
  await page.waitForSelector('#ykl-works .text-card');
  await page.locator('#ykl-works .text-card').first().click();
  await page.waitForSelector('#ykl-work [data-part]');
  await page.click('#ykl-back');
  ok(await page.locator('#ykl-list').isVisible() && !(await page.locator('#ykl-work').isVisible()), 'back from a work shows the list');
  await page.click('#ykl-back');
  ok(await page.locator('#v-lib').isVisible(), 'back from the list shows the library');

  step('kept after a reload');
  const kept = await cards(page);
  await page.reload();
  await page.waitForSelector('#texts .text-card');
  ok(JSON.stringify(await cards(page)) === JSON.stringify(kept), 'the added parts are still there');

  step('Aozora Bunko still has its own part list');
  await page.click('#go-aoz');
  await page.waitForSelector('#v-aoz:not([hidden])');
  ok(await page.locator('#aoz-find').isVisible(), 'From Aozora Bunko opens its search');
  await page.click('#aoz-back');

  step('when the catalog or a file cannot be fetched');
  const p2 = await newPage(ctx, logs);
  await p2.route('**/reader/library/catalog.json', (r) => r.fulfill({ status: 500, body: 'no' }));
  await p2.goto(READER);
  await p2.waitForSelector('#texts .text-card');
  await p2.click('#go-ykl');
  await p2.waitForFunction(() => /did not load/.test(document.getElementById('ykl-state').textContent), null, { timeout: 10000 });
  ok(true, 'a catalog that fails says so: ' + await p2.locator('#ykl-state').innerText());
  await p2.unroute('**/reader/library/catalog.json');
  await p2.route('**/reader/library/catalog.json', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ works: [{ id: 'one', title: '一つだけの話', parts: [{ file: 'one/1.txt' }] }, { id: 'gone', title: 'ない話', parts: [{ file: 'gone/1.txt' }] }] }) }));
  await p2.route('**/reader/library/one/1.txt', (r) => r.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: '﻿　昔、ある村に一人の男が住んでいた。\r\n　男は毎朝、川へ水をくみに行った。\r\n\r\n' }));
  await p2.click('#ykl-back');
  await p2.click('#go-ykl');
  await p2.waitForSelector('#ykl-works .text-card');
  ok((await p2.locator('#ykl-works .tc-title').allInnerTexts()).join('、') === '一つだけの話、ない話', 'a new catalog is read again after a failure');
  await p2.locator('#ykl-works .text-card').nth(1).click();
  await p2.waitForSelector('#ykl-work .problem', { timeout: 10000 });
  ok(await p2.locator('#ykl-work button', { hasText: 'Try again' }).count() === 1, 'a missing file says so and offers Try again');
  await p2.click('#ykl-back');
  await p2.locator('#ykl-works .text-card').nth(0).click();
  await p2.waitForSelector('#ykl-work [data-part]');
  ok(await p2.locator('#ykl-work [data-part]').innerText() === 'Add and read', 'a one-part work offers Add and read');
  await p2.locator('#ykl-work [data-part]').click();
  await p2.waitForSelector('#passage .ph', { timeout: 180000 });
  ok(await p2.locator('#read-title').innerText() === '一つだけの話', 'a one-part work is titled with the work\'s title');
  ok(strip(await shownText(p2)) === strip('昔、ある村に一人の男が住んでいた。男は毎朝、川へ水をくみに行った。'), 'its text is shown without the byte-order mark and line-end characters');
  await p2.close();

  step('page errors');
  ok(logs.length === 0, 'no page errors' + (logs.length ? ': ' + logs.join(' | ') : ''));
  console.log('screenshots in ' + out);
  await browser.close();
  console.log(fails ? fails + ' FAILED' : 'all passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
