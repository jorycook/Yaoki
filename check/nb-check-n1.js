// The N1 notebook with every kind of entry (YK_LEVEL=N1 bash run-app.sh nb-check-n1.js), on 14 Oct 2026: every
// question of every lesson (drills, ★, exam-style, reading, listening), every word, the longest kanji words and every
// question of the four mini mocks, each with its longest wrong answer, a page of entries at a time. Each row keeps its
// one-line texts whole (the notebook cuts them itself, keeping the blank or the underlined word in view), and nothing
// leaves the frame. Then a review of one entry of each kind, the hardest of each, through to the notebook again.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, inspect, site, out } = require('./rt-check.js');
const { course } = require('./level.js');

const TODAY = '2026-10-14';
const N = course(TODAY);
const enc = (o) => encodeURIComponent(JSON.stringify(o));
/* the time a mistake was made: two days ago, a second apart, so the notebook and the review keep them in the order given */
const AT = Date.parse(N.add(TODAY, -2) + 'T09:00:00Z');

/* a question as the screens show it: an option the bank could not fill is left out, and the answer counted again */
const tidy = (q) => {
  if (!q || !Array.isArray(q.options)) return null;
  const keep = q.options.map((o, k) => ({ o, k: k + 1 })).filter((x) => x.o != null && x.o !== '');
  const answer = keep.findIndex((x) => x.k === q.answer) + 1;
  return answer > 0 && keep.length >= 2 ? { ...q, options: keep.map((x) => x.o), answer, short: q.short ? keep.map((x) => q.short[x.k - 1]) : null } : null;
};
/* the longest wrong answer a learner can give, as the screens keep it: the short form where there is one */
const worst = (src) => {
  const q = N.item(src);
  if (!q) return null;
  const labels = (q.short || q.options).map((o) => N.plain(o));
  let w = '';
  labels.forEach((l, k) => { if (k + 1 !== q.answer && l.length > w.length) w = l; });
  /* the ★ question keeps the tile put on the star, or says the order was wrong */
  if (/\.s$/.test(src)) q.tiles.forEach((t, k) => { if (k !== q.star && N.plain(t).length > w.length) w = N.plain(t); });
  if (/\.s$/.test(src) && '順番が違う'.length > w.length) w = '順番が違う';
  return { src, wrong: w, q };
};

/* every entry the bank can make */
const all = [];
N.lessons.forEach((l) => {
  ['d0', 'd1', 'd2', 's', 'x0', 'x1', 'x2'].forEach((k) => all.push(worst('g.' + l.id + '.' + k)));
  all.push(worst('r.' + l.id), worst('l.' + l.id));
});
N.words.forEach((x, wi) => all.push(worst('w.' + wi)));
/* the kanji words with the longest word, and those with the longest wrong reading */
const ks = [];
N.kanji.forEach((k, ki) => k.w.forEach((w, wj) => ks.push({ ki, wj, len: N.plain(w.w).length })));
ks.sort((a, b) => b.len - a.len);
ks.slice(0, 12).forEach((k) => all.push(worst('k.' + k.ki + '.' + k.wj)));
const kr = ks.map((k) => worst('k.' + k.ki + '.' + k.wj)).filter(Boolean).sort((a, b) => b.wrong.length - a.wrong.length);
kr.slice(0, 6).forEach((e) => all.push(e));
N.mocks.forEach((m) => { let n = 0; m.sections.forEach((s) => s.items.forEach(() => { n++; all.push(worst('m' + m.id + '.' + n)); })); });
const entries = all.filter(Boolean);
/* the text a row is made from: a mock question's sentence as its paper has it, or a passage's blank */
const lineOf = (q) => {
  if (!q.mock) return String(q.line || '');
  const mk = N.mocks.find((x) => x.id === q.mock);
  const it = mk.sections.reduce((a, s) => a.concat(s.items), [])[q.n - 1];
  if (it.kind === 'sentence') return it.ja;
  if ((it.kind === 'passage' || it.kind === 'pair') && String(q.ja).includes('（　　）')) return '（　　）';
  return String(q.line || '');
};
/* and a few left unanswered when the time ran out */
['g.u8l6.x1', 'm4.7', 'm3.9'].forEach((src) => { const e = worst(src); if (e) entries.push({ ...e, wrong: '無解答' }); });

(async () => {
  const fontsCss = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8');
  const browser = await chromium.launch();
  let bad = 0;
  let pads = 0;
  const kinds = {};
  entries.forEach((e) => { const k = e.src.replace(/^m\d+\./, 'mock.').replace(/\..*$/, '') + (e.q.mock ? '.' + e.q.kind : e.src[0] === 'g' ? '.' + e.src.split('.')[2][0] : ''); kinds[k] = (kinds[k] || 0) + 1; });
  console.log('entries: ' + entries.length + ' ' + JSON.stringify(kinds));

  // ---------- the notebook, a page of entries at a time ----------
  const PER = 60;
  for (let i = 0; i < entries.length; i += PER) {
    const group = entries.slice(i, i + PER);
    const m = group.map((e, j) => ({ src: e.src, wrong: e.wrong, at: AT - j * 1000 }));
    const { page, logs } = await openBoard(browser, 'TShell.dc.html?screen=Notebook&plan=demo&day=17&ykdate=' + TODAY + '&m=' + enc(m), fontsCss);
    const info = await inspect(page);
    const rows = await page.evaluate(() => {
      const clipped = (el) => !!el && el.scrollWidth > el.clientWidth + 1;
      return [...document.querySelectorAll('div[lang=ja]')].filter((d) => d.style.fontSize === '15px' && d.style.whiteSpace === 'nowrap').map((line) => {
        const head = line.previousElementSibling;
        const ans = line.nextElementSibling;
        const cut = [...ans.querySelectorAll('span')].filter((s) => s.style.textOverflow === 'ellipsis');
        const lines = new Set([...ans.children].map((c) => Math.round(c.getBoundingClientRect().top))).size;
        return {
          type: head.firstElementChild.textContent.trim(),
          when: head.children[1].textContent.trim(),
          line: line.textContent,
          under: [...line.querySelectorAll('span')].some((s) => /solid/.test(s.style.borderBottom)),
          wrong: cut[0] ? cut[0].textContent : '',
          right: cut[1] ? cut[1].textContent : '',
          clipped: [clipped(line) && 'line', clipped(head.children[1]) && 'when', cut.some(clipped) && 'answer'].filter(Boolean),
          ansLines: lines,
          w: Math.round(line.getBoundingClientRect().width),
        };
      });
    });
    await page.screenshot({ path: path.join(out, 'nb-n1-' + String(i / PER + 1).padStart(2, '0') + '.png') });
    const problems = [];
    if (rows.length !== group.length) problems.push(`${rows.length} rows for ${group.length} entries`);
    for (const r of rows) {
      if (r.clipped.length) problems.push(`clipped ${r.clipped.join('+')}: ${r.type} | ${r.line} | ${r.wrong} -> ${r.right}`);
      if (r.ansLines > 2) problems.push(`answers on ${r.ansLines} lines: ${r.wrong} -> ${r.right}`);
    }
    /* each entry's row keeps what matters in view: a blank, the underlined word, the wrong answer as given */
    group.forEach((e, j) => {
      /* the rows come in the order the mistakes were made, the latest first */
      const r = rows[j];
      if (!r || r.type !== e.q.type || !e.wrong.startsWith(r.wrong.replace(/…$/, ''))) { problems.push(`row ${j + 1} should be ${e.src} (${e.q.type}, ${e.wrong}), got ${r ? r.type + ', ' + r.wrong : 'none'}`); return; }
      const text = lineOf(e.q);
      if (/（　　）/.test(text) && !r.line.includes('（　　）')) problems.push(`${e.src}: the blank is cut off: ${r.line}`);
      if ((e.q.type === '漢字読み' || e.q.usage || /【/.test(text)) && !r.under) problems.push(`${e.src}: the underlined word is cut off: ${r.line}`);
      if (e.q.mock && !r.when.includes('Mini mock ' + e.q.mock)) problems.push(`${e.src}: the row should name its mock: ${r.when}`);
    });
    const noisy = logs.filter((l) => !/Download the React DevTools/.test(l));
    if (info.errors.length || info.issues.length || info.unresolved) problems.push('PROBLEMS ' + JSON.stringify({ e: info.errors, i: info.issues, u: info.unresolved }));
    if (noisy.length) problems.push('console: ' + JSON.stringify(noisy.slice(0, 4)));
    pads += info.pad.length;
    const widest = rows.reduce((a, r) => Math.max(a, r.w), 0);
    console.log(`page ${i / PER + 1}: ${group[0].src} … ${group[group.length - 1].src}, ${rows.length} rows, widest line ${widest}px` + (info.pad.length ? ' PAD WARNING ' + JSON.stringify(info.pad) : ''));
    for (const p of problems) console.log('   ' + p);
    bad += problems.length;
    await page.close();
  }

  // ---------- the cleared group: entries cleared, and others waiting days ahead ----------
  {
    const longest = entries.slice().sort((a, b) => String(b.q.line).length - String(a.q.line).length);
    const m = longest.slice(0, 8).map((e, j) => ({ src: e.src, wrong: e.wrong, at: AT - j * 1000, step: 3, cleared: N.add(TODAY, -1) }))
      .concat(longest.slice(8, 12).map((e, j) => ({ src: e.src, wrong: e.wrong, at: AT - j * 1000, step: 2, next: N.add(TODAY, 5) })));
    const { page } = await openBoard(browser, 'TShell.dc.html?screen=Notebook&plan=demo&day=17&ykdate=' + TODAY + '&m=' + enc(m), fontsCss);
    await page.locator('button[aria-expanded]:has-text("Cleared")').first().click({ timeout: 4000 });
    await page.waitForTimeout(400);
    const info = await inspect(page);
    const res = await page.evaluate(() => ({
      cleared: [...document.querySelectorAll('div[lang=ja]')].filter((d) => d.style.fontSize === '14px' && d.style.whiteSpace === 'nowrap').map((d) => ({ t: d.textContent, clipped: d.scrollWidth > d.clientWidth + 1 })),
      text: document.querySelector('#yk-stage').textContent.replace(/\s+/g, ' '),
    }));
    await page.screenshot({ path: path.join(out, 'nb-n1-cleared.png') });
    const problems = [];
    if (res.cleared.length !== 8) problems.push('8 cleared rows expected, got ' + res.cleared.length);
    res.cleared.filter((c) => c.clipped).forEach((c) => problems.push('cleared line clipped: ' + c.t));
    if (!res.text.includes('Cleared · 8') || !res.text.includes('cleared 13 Oct')) problems.push('the cleared group should count 8, cleared yesterday');
    if (!res.text.includes('back 19 Oct') || !res.text.includes('Nothing is due today. The next one comes back on 19 Oct.')) problems.push('the waiting entries should come back on 19 Oct');
    if (info.errors.length || info.issues.length || info.unresolved) problems.push('PROBLEMS ' + JSON.stringify(info.issues));
    pads += info.pad.length;
    console.log(`cleared: ${res.cleared.length} rows` + (info.pad.length ? ' PAD WARNING ' + JSON.stringify(info.pad) : ''));
    for (const p of problems) console.log('   ' + p);
    bad += problems.length;
    await page.close();
  }

  // ---------- a review: one entry of each kind, the longest of each ----------
  {
    const pickBy = (test, size) => entries.filter((e) => test(e) && e.wrong !== '無解答').sort((a, b) => size(b) - size(a))[0];
    const len = (e) => String(e.q.line || '').length + (e.q.passage ? String(e.q.passage).length : 0) + (e.q.texts ? JSON.stringify(e.q.texts).length : 0);
    const opts = (e) => e.q.options.reduce((a, o) => a + N.plain(o).length, 0);
    const lessonKind = (k) => (e) => e.src[0] === 'g' && e.src.split('.')[2][0] === k[0] && (k.length === 1 || !!e.q.order === (k === 'xo'));
    const mockKind = (kind, type) => (e) => e.q.mock && e.q.kind === kind && (!type || e.q.type === type);
    const list = [
      pickBy((e) => e.src[0] === 'k', (e) => e.wrong.length),
      pickBy((e) => e.src[0] === 'w' && e.q.type === '文脈規定', len),
      pickBy((e) => e.src[0] === 'w' && e.q.type === '言い換え類義', len),
      pickBy((e) => e.src[0] === 'w' && e.q.usage, opts),
      pickBy(lessonKind('d'), len),
      pickBy(lessonKind('s'), len),
      pickBy(lessonKind('xf'), len),
      pickBy(lessonKind('xo'), len),
      pickBy((e) => e.src[0] === 'r', len),
      pickBy((e) => e.src[0] === 'l', (e) => -opts(e)),
      pickBy(mockKind('sentence', '漢字読み'), len),
      pickBy(mockKind('sentence', '文の文法2'), len),
      pickBy(mockKind('usage'), opts),
      pickBy(mockKind('passage', '文章の文法'), len),
      pickBy(mockKind('passage', '内容理解（短文）'), len),
      pickBy(mockKind('pair'), len),
      pickBy(mockKind('quick'), (e) => -len(e)),
    ].filter(Boolean);
    /* all due today, in the order given; the first two have been right twice already, so a right answer now clears them */
    const m = list.map((e, j) => ({ src: e.src, wrong: e.wrong, at: AT - j * 1000, next: TODAY, ...(j < 2 ? { step: 2 } : {}) }));
    const { page, logs } = await openBoard(browser, 'TShell.dc.html?screen=Notebook&plan=demo&day=17&ykdate=' + TODAY + '&m=' + enc(m), fontsCss);
    let fails = 0;
    const ok = (cond, msg) => { if (!cond) { fails += 1; console.log('   FAIL: ' + msg); } };
    const body = async () => ((await page.locator('#yk-stage').textContent()) || '').replace(/\s+/g, ' ');
    const click = async (sel, wait = 400) => { await page.locator(sel).first().click({ timeout: 5000 }); await page.waitForTimeout(wait); };
    const shot = async (name) => {
      const info = await inspect(page);
      await page.screenshot({ path: path.join(out, 'nb-n1-rev-' + name + '.png') });
      const flag = info.errors.length || info.issues.length || info.unresolved;
      if (flag) console.log(`   ${name}: PROBLEMS ` + JSON.stringify({ e: info.errors, i: info.issues, u: info.unresolved }));
      if (info.pad.length) console.log(`   ${name}: PAD WARNING ` + JSON.stringify(info.pad));
      pads += info.pad.length;
      ok(!flag, name + ': layout or runtime problems');
    };
    ok((await body()).includes('Review ' + list.length + ' due'), 'review: the notebook should have ' + list.length + ' due');
    await click('a:has-text("Review ' + list.length + ' due")', 700);
    let right = 0;
    for (let n = 0; n < list.length; n++) {
      const e = list[n];
      const q = tidy(N.item(e.src));
      const name = String(n + 1).padStart(2, '0') + '-' + e.src.replace(/[^a-z0-9]+/gi, '-');
      ok((await body()).includes((n + 1) + ' / ' + list.length), `review ${e.src}: item ${n + 1} of ${list.length} expected`);
      if (q.listen) {
        ok((await page.locator('button[aria-pressed][aria-disabled="true"]').count()) === q.options.length, `review ${e.src}: the answers should wait for the audio`);
        await click('button[aria-label^="Play"]', 300);
        await page.waitForFunction((n) => [...document.querySelectorAll('button[aria-pressed]')].filter((b) => b.getAttribute('aria-disabled') !== 'true').length === n, q.options.length, { timeout: 90000 });
      }
      await shot(name);
      const good = n % 3 !== 2;
      if (good) right++;
      await click(`button[aria-pressed] >> nth=${(good ? q.answer : (q.answer % q.options.length) + 1) - 1}`, 300);
      await click('button:has-text("Check")', 600);
      await shot(name + '-checked');
      const t = await body();
      ok(t.includes(good ? 'せいかい' : 'おしい'), `review ${e.src}: the verdict is wrong`);
      ok(good ? (n < 2 ? t.includes('Cleared: it leaves your notebook') : t.includes('1 of 3 in a row')) : t.includes('Back to the start'), `review ${e.src}: the step note is wrong`);
      await click(n === list.length - 1 ? 'button:has-text("Finish")' : 'button:has-text("Next")', 500);
    }
    await shot('summary');
    ok((await body()).includes(`Review done: ${right} of ${list.length} right.`), 'review: the summary line is wrong');
    await click('a:has-text("Back to the notebook")', 700);
    await shot('notebook-after');
    const t = await body();
    ok(t.includes('all caught up') && t.includes(`Today's review: ${right} of ${list.length} right.`), 'notebook: after the review nothing should be due, and the review counted');
    ok(t.includes('Cleared · 2'), 'notebook: the two answered right a third time should be cleared');
    ok(t.includes('back 17 Oct') && t.includes('back tomorrow'), 'notebook: right answers come back in 3 days, wrong ones tomorrow');
    const noisy = logs.filter((l) => !/Download the React DevTools/.test(l));
    if (noisy.length) { fails++; console.log('   console: ' + JSON.stringify(noisy.slice(0, 4))); }
    console.log(`review: ${list.length} items (${list.map((e) => e.src).join(' ')}), ${right} right`);
    bad += fails;
    await page.close();
  }
  if (pads) console.log(`PAD WARNINGS: ${pads} (content in the bottom 34 px)`);
  console.log(bad ? 'NOTEBOOK CHECK: ' + bad + ' problem(s)' : 'NOTEBOOK CHECK PASS');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
