// Checks for the Yaoki Library in the reader (docs/reader/library/, listed from docs/reader/index.html).
// usage: bash run-reader.sh library-test.js
// First the catalog and its files are checked on disk, so a new work cannot be published with a part that is
// missing, too long or in the wrong encoding. Then the library is used in a phone-sized browser: the button sits
// just under From Aozora Bunko, every work in the catalog opens and lists its parts, adding all parts puts them
// in the library in reading order, a part reads its whole text, and a catalog that fails to load says so.
// A part with its own analysis file (目川日記) must show that analysis and open without loading the dictionary.
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
const squeeze = (s) => s.replace(/[\s　]+/g, '');
/* the text an analysis shows (as the reader draws it), without spaces and line breaks */
const anText = (a) => squeeze(a.paras.map((p) => p.map((c) => c.w ? (c.h || '') + c.w.map((w) => w.s.map((g) => g[0]).join('')).join('') + (c.t || '') : (c.x || '')).join('')).join(''));

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
    let analysis = null;
    if (p.analysis) {
      const af = path.join(LIB, p.analysis);
      const ain = path.resolve(af).startsWith(path.resolve(LIB) + path.sep) && /^[a-z0-9-]+\/[A-Za-z0-9_.-]+\.json$/.test(p.analysis);
      ok(ain && fs.existsSync(af), w.id + ': ' + p.analysis + ' is there, under a name the reader accepts');
      if (ain && fs.existsSync(af)) {
        try { analysis = JSON.parse(fs.readFileSync(af, 'utf8')); } catch (e) { ok(false, p.analysis + ' is valid JSON (' + e.message + ')'); }
        const shape = analysis && Array.isArray(analysis.paras) && analysis.paras.every((pa) => Array.isArray(pa) && pa.every((c) => c && (c.w ? Array.isArray(c.w) && c.w.length && c.w.every((x) => Array.isArray(x.s) && x.s.every((g) => Array.isArray(g) && typeof g[0] === 'string' && typeof g[1] === 'string')) : typeof c.x === 'string')));
        ok(shape, p.analysis + ': has the shape the engine produces');
        ok(analysis && analysis.pre === 1 && typeof analysis.rev === 'string', p.analysis + ': is marked as made in advance, with a revision');
        if (shape) ok(anText(analysis) === squeeze(text), p.analysis + ': shows exactly the text of ' + p.file);
        if (shape) {
          const words = analysis.paras.flat().filter((c) => c.w).flatMap((c) => c.w);
          const content = words.filter((x) => !x.f);
          ok(content.length && content.every((x) => typeof x.e === 'string' || !x.e) && content.filter((x) => x.e).length / content.length > 0.9, p.analysis + ': ' + content.length + ' words, ' + content.filter((x) => x.e).length + ' with a gloss');
          const kanjiSegs = words.flatMap((x) => x.s).filter((g) => /[㐀-鿿々]/.test(g[0]));
          ok(kanjiSegs.every((g) => g[1]), p.analysis + ': every kanji has its reading (' + kanjiSegs.length + ')');
        }
      }
    }
    texts[w.id].push({ title: p.title, text, glosses, analysis });
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
    if (!(await page.locator('#ykl-works').isVisible())) {
      await page.click('#go-ykl');
      await page.waitForSelector('#ykl-works .text-card');
    }
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
    const dictLoads = [];
    const onReq = (r) => { if (/\/reader\/engine\/(jm-\d|dict\/)/.test(r.url())) dictLoads.push(r.url()); };
    page.on('request', onReq);
    await page.locator('#ykl-work [data-part="' + pick + '"]').click();
    await page.waitForSelector('#v-read:not([hidden])');
    await page.waitForSelector('#passage .ph', { timeout: 180000 });
    page.off('request', onReq);
    if (texts[w.id][pick].analysis) {
      ok(dictLoads.length === 0, titles[pick] + ': opened from its own analysis, without the dictionary (' + dictLoads.length + ' dictionary requests)');
      ok(await page.locator('#passage .ph').count() === texts[w.id][pick].analysis.paras.flat().filter((c) => c.w).length, titles[pick] + ': as many phrases as its analysis');
    }
    ok(await page.locator('#read-title').innerText() === titles[pick], 'the reader opens ' + titles[pick]);
    const n = await page.locator('#passage .ph').count();
    ok(strip(await shownText(page)) === strip(texts[w.id][pick].text), titles[pick] + ': ' + texts[w.id][pick].text.length + ' characters, ' + n + ' phrases, the whole text is shown');
    /* the part's own glosses or analysis: hold a phrase holding one of its words and read the lens */
    const probes = [
      { shimatsusho: ['飲まれました', /honorific/, /swallowed/], 'mekawa-n5': ['駅です', /station/, /dictionary/], 'mekawa-n4': ['夏まつり', /festival/, /dictionary/],
        'mekawa-n3': ['だるまは', /rights itself/, /dictionary/], 'mekawa-n2': ['吹雪が', /snowstorm/, /dictionary/] }[w.id] || null,
      /* a note of the text's own, shown with the word meanings */
      { 'mekawa-n3': ['はり始めた', /注[\s\S]*start pasting/, /文法[\s\S]*文法[\s\S]*文法[\s\S]*文法/] }[w.id] || null,
    ];
    for (const probe of probes) {
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

  /* A new edition: a part saved from an earlier edition of its work (same part, other text) is updated in place,
     from the work page or from a note in the reader, and keeps its place in the library. */
  const older = (s) => '（旧版）\n' + s;
  const seeded = async (seed) => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await c.addInitScript((s) => {
      if (!localStorage.getItem('yomu.test.seeded')) { localStorage.setItem('yomu.texts', JSON.stringify(s)); localStorage.setItem('yomu.test.seeded', '1'); }
    }, seed);
    return c;
  };
  const savedTexts = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('yomu.texts') || '[]'));
  const wk = works.find((w) => w.parts.length > 2 && w.parts.every((p) => p.analysis));
  if (wk) {
    step(wk.title + ': parts saved from an earlier edition');
    const wi = works.indexOf(wk), tx = texts[wk.id];
    const c3 = await seeded([
      { id: 'told1', title: wk.parts[0].title, by: wk.by || '', text: older(tx[0].text), created: 3000, seen: [0, 1, 2], n: 99, av: 5, src: wk.parts[0].analysis },
      { id: 'told2', title: wk.parts[1].title, by: wk.by || '', text: older(tx[1].text), created: 2999, seen: [4], n: 99, av: 5, src: wk.parts[1].analysis },
      { id: 'tmine', title: '自分の文', by: '', text: '今日は雨です。', created: 100, seen: [], n: 0, av: 0 },
    ]);
    const p3 = await newPage(c3, logs);
    await p3.goto(READER);
    await p3.waitForSelector('#texts .text-card');
    await p3.click('#go-ykl');
    await p3.waitForSelector('#ykl-works .text-card');
    await p3.locator('#ykl-works .text-card').nth(wi).click();
    await p3.waitForSelector('#ykl-work [data-part]');
    const labels = await p3.locator('#ykl-work [data-part]').allInnerTexts();
    ok(labels[0] === 'Update' && labels[1] === 'Update' && labels.slice(2).every((l) => l === 'Add'), 'the two earlier parts say Update, the others Add (' + labels.join(', ') + ')');
    const allLabel = await p3.locator('#ykl-work .add-all').innerText();
    ok(allLabel === 'Add ' + (wk.parts.length - 2) + ' parts, update 2', 'the add-all button: ' + allLabel);
    const why = (await p3.locator('#ykl-work .revised-parts').innerText()).replace(/\s+/g, ' ');
    ok(/2 parts in your library are from an earlier edition/.test(why), 'a note says why: ' + why);
    await p3.screenshot({ path: path.join(out, 'library-update-work.png') });

    step(wk.title + ': updating one part');
    await p3.locator('#ykl-work [data-part="0"]').click();
    const said = await toastText(p3);
    ok(/^Updated .+ to the new text\. Its looked-up list starts over\.$/.test(said), 'it says so: ' + said);
    await p3.waitForFunction(() => document.querySelector('#ykl-work [data-part="0"]').textContent === 'Read');
    ok(true, 'the part now says Read');
    let saved = await savedTexts(p3);
    const s1 = saved.find((t) => t.id === 'told1');
    ok(s1 && s1.text === tx[0].text, 'the saved copy has the new text');
    ok(s1 && s1.created === 3000 && s1.seen.length === 0 && s1.title === wk.parts[0].title, 'in its place, with its looked-up list started over');
    ok(s1 && s1.src === wk.parts[0].analysis && s1.part === wk.parts[0].file, 'it keeps its analysis file and now also its text file');
    ok(saved.length === 3 && saved.filter((t) => t.src === wk.parts[0].analysis).length === 1, 'no second copy');
    const why2 = (await p3.locator('#ykl-work .revised-parts').innerText()).replace(/\s+/g, ' ');
    ok(/One part in your library is from an earlier edition/.test(why2), 'the note counts what is left: ' + why2);

    step(wk.title + ': adding and updating the rest at once');
    ok(await p3.locator('#ykl-work .add-all').innerText() === 'Add ' + (wk.parts.length - 2) + ' parts, update 1', 'the add-all button counts both');
    await p3.locator('#ykl-work .add-all').click();
    await p3.waitForSelector('#v-lib:not([hidden])');
    const both = await toastText(p3);
    ok(both === 'Added ' + (wk.parts.length - 2) + ' parts and updated 1 part of ' + wk.title + '. The updated ones start their looked-up lists over.', 'it says so: ' + both);
    const list3 = await cards(p3);
    ok(JSON.stringify(list3) === JSON.stringify(wk.parts.map((p) => p.title).concat(['自分の文', '片目のだるま'])), 'every part once, in reading order, above the reader\'s own text: ' + list3.join('、'));
    saved = await savedTexts(p3);
    ok(saved.every((t) => t.id === 'tmine' || tx.some((x) => x.text === t.text)), 'every part holds the new text');
    ok(saved.find((t) => t.id === 'told2').created === 2999, 'the second earlier part kept its place too');

    step(wk.title + ': an updated part reads at once');
    const dict3 = [];
    p3.on('request', (r) => { if (/\/reader\/engine\/(jm-\d|dict\/)/.test(r.url())) dict3.push(r.url()); });
    await p3.locator('#texts .text-card').nth(1).click();
    await p3.waitForSelector('#passage .ph', { timeout: 30000 });
    ok(strip(await shownText(p3)) === strip(tx[1].text), wk.parts[1].title + ': the new text');
    ok(dict3.length === 0, 'from its own analysis, without the dictionary (' + dict3.length + ' requests)');
    ok(await p3.locator('#read-update').isHidden(), 'and no note');
    await p3.close();
    await c3.close();
  }

  const w4 = works.find((w) => w.parts[0] && w.parts[0].analysis && w !== wk) || wk;
  if (w4) {
    step(w4.title + ': the reader offers a new edition of a saved part');
    const t4 = texts[w4.id][0];
    const oldAn = Object.assign({}, t4.analysis, { rev: 'earlier', paras: [[{ x: '（旧版）' }]].concat(t4.analysis.paras) });
    const c4 = await seeded([{ id: 'tn4', title: w4.parts[0].title, by: w4.by || '', text: older(t4.text), created: 5000, seen: [], n: 0, av: 0, src: w4.parts[0].analysis }]);
    const p4 = await newPage(c4, logs);
    const dict4 = [];
    p4.on('request', (r) => { if (/\/reader\/engine\/(jm-\d|dict\/)/.test(r.url())) dict4.push(r.url()); });
    const anRoute = '**/reader/library/' + w4.parts[0].analysis;
    await p4.route(anRoute, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(oldAn) }));
    await p4.goto(READER);
    await p4.waitForSelector('#texts .text-card');
    await p4.locator('#texts .text-card').first().click();
    await p4.waitForSelector('#passage .ph', { timeout: 30000 });
    ok(strip(await shownText(p4)) === strip(older(t4.text)), 'a part saved from an earlier edition reads as it was saved');
    ok(await p4.locator('#read-update').isHidden(), 'while the library has that same edition, there is no note');
    await p4.locator('#read-back').click();
    await p4.unroute(anRoute);
    await p4.locator('#texts .text-card').first().click();
    await p4.waitForSelector('#read-update:not([hidden])', { timeout: 15000 });
    const offer = (await p4.locator('#read-update').innerText()).replace(/\s+/g, ' ');
    ok(/^Revised\. This part has a new edition in the Yaoki Library/.test(offer) && await p4.locator('#read-update-go').isVisible(), 'once the library has a new edition, a note offers it: ' + offer);
    ok(strip(await shownText(p4)) === strip(older(t4.text)), 'until it is taken, the saved text stays');
    await p4.screenshot({ path: path.join(out, 'library-update-reader.png') });
    await p4.click('#read-update-go');
    const said4 = await toastText(p4);
    ok(/^Updated to the new text\./.test(said4), 'Update says so: ' + said4);
    await p4.waitForFunction(() => document.getElementById('read-update').hidden);
    ok(strip(await shownText(p4)) === strip(t4.text), 'the new text is shown at once, and the note is gone');
    ok(await p4.locator('#passage .ph').count() === t4.analysis.paras.flat().filter((c) => c.w).length, 'with the phrases of its own analysis');
    ok(dict4.length === 0, 'without the dictionary (' + dict4.length + ' requests)');
    const s4 = await savedTexts(p4);
    ok(s4.length === 1 && s4[0].id === 'tn4' && s4[0].text === t4.text && s4[0].created === 5000 && s4[0].part === w4.parts[0].file, 'the saved copy took the new text in its place');
    await p4.reload();
    await p4.waitForSelector('#texts .text-card');
    await p4.locator('#texts .text-card').first().click();
    await p4.waitForSelector('#passage .ph', { timeout: 30000 });
    ok(strip(await shownText(p4)) === strip(t4.text) && await p4.locator('#read-update').isHidden(), 'after a reload it opens on the new text, with no note');
    await p4.close();
    await c4.close();

    step(w4.title + ': an earlier copy beside the new one');
    const c5 = await seeded([
      { id: 'tw-new', title: w4.parts[0].title, by: w4.by || '', text: t4.text, created: 6001, seen: [], n: 0, av: 0, src: w4.parts[0].analysis },
      { id: 'tw-old', title: w4.parts[0].title, by: w4.by || '', text: older(t4.text), created: 6000, seen: [], n: 0, av: 0, src: w4.parts[0].analysis },
    ]);
    const p5 = await newPage(c5, logs);
    await p5.route('**/reader/engine/**', (r) => (/jm-\d|dict\//.test(r.request().url()) ? r.abort() : r.continue()));
    await p5.goto(READER);
    await p5.waitForSelector('#texts .text-card');
    await p5.locator('#texts .text-card').nth(1).click();
    await p5.waitForSelector('#read-update:not([hidden])', { timeout: 15000 });
    const twin = (await p5.locator('#read-update').innerText()).replace(/\s+/g, ' ');
    ok(/^Earlier edition\. The new text of this part is already in your library as another copy/.test(twin) && await p5.locator('#read-update-go').isHidden(), 'the note says the new text is already there, with nothing to update: ' + twin);
    await p5.locator('#read-back').click();
    await p5.locator('#texts .text-card').first().click();
    await p5.waitForSelector('#passage .ph', { timeout: 30000 });
    ok(await p5.locator('#read-update').isHidden(), 'the new copy opens with no note');
    await p5.close();
    await c5.close();
  }

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
