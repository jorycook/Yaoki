// The games inside the prototype frame: today's game on Today's spread once the three lessons are done (the kanji parts
// puzzle on N2 week 3, day 4: a wrong part, so a まる, and its mark back on Today), then the Games tab: the week chips, a
// clean Kanji match on week 1 (a はなまる, shown on the chip and the tile), Listening catch and the Sentence builder on
// week 3 with every answer right, and the kana level's three games. Each round is the one the page itself makes with the
// fixed seed, so the test knows where the right cards, pieces and parts are.
// usage: bash run.sh games-test.js       (YK_APP=1: bash run-app.sh games-test.js for the app build)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, inspect, site, out } = require('./rt-check.js');

const SEED = 11;
const NOW = Date.UTC(2026, 10, 18, 15);
const PLAN = encodeURIComponent(JSON.stringify({ start: '2026-10-11', exam: '2026-12-06', pace: 'fit' }));
const DONE = (n) => { const d = {}; for (let i = 1; i <= n; i++) d['u03d' + i] = { g: 3, k: 1, r: 1, ks: 1, kw: 1 }; for (const u of ['u01', 'u02']) for (let i = 1; i <= 6; i++) d[u + 'd' + i] = { g: 3, k: 1, r: 1, ks: 1, kw: 1 }; return encodeURIComponent(JSON.stringify(d)); };
const TESTS = encodeURIComponent(JSON.stringify({ u01t: { id: 'u01t', score: 20, of: 24 }, u02t: { id: 'u02t', score: 19, of: 24 } }));

(async () => {
  const fontsCss = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8');
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  let fails = 0;
  const ok = (cond, msg) => { if (!cond) { fails += 1; console.log('  FAIL: ' + msg); } };
  let page;
  let logs;
  const body = async () => ((await page.locator('body').textContent()) || '').replace(/\s+/g, ' ');
  const has = async (text) => (await body()).includes(text);
  const until = (text, ms) => page.waitForFunction((t) => document.body.textContent.replace(/\s+/g, ' ').includes(t), text, { timeout: ms }).then(() => true, () => false);
  const at = async (name) => {
    const info = await inspect(page);
    await page.screenshot({ path: path.join(out, 'games-' + name + '.png') });
    const bad = info.errors.length || info.issues.length || info.unresolved;
    console.log(`${name}` + (bad ? ' PROBLEMS ' + JSON.stringify({ e: info.errors, i: info.issues.slice(0, 4), u: info.unresolved }) : ''));
    ok(!bad, name + ': layout or runtime problems');
  };
  /* a tap as a finger makes it, even on a card that is falling (Playwright would wait for it to stop) */
  const tap = async (sel, n = 0) => { const el = page.locator(sel).nth(n); await el.waitFor({ timeout: 5000 }); await el.evaluate((e) => e.click()); };
  const open = async (q) => {
    if (page) await page.close();
    ({ page, logs } = await openBoard(browser, 'TShell.dc.html?' + q, fontsCss, async (p) => { await p.addInitScript((s) => { window.__ykSeed = s; }, SEED); }));
    await page.waitForTimeout(400);
  };
  const round = (kind, src) => page.evaluate(([k, s, seed]) => window.ykGame.round(k, s, seed), [kind, src, SEED]);

  // ---------- today's game: N2 week 3, day 4, the three lessons done ----------
  await open(`screen=Today&level=N2&now=${NOW}&plan=${PLAN}&cur=u03d4&done=${DONE(4)}&tests=${TESTS}&seed=${SEED}`);
  await at('01-today-done');
  ok(await has('4日目 完了！') && await has("今日のゲーム"), 'today: the day stamped, and today\'s game');
  ok(await has('漢字パズル'), 'today: day 4\'s game is the kanji parts puzzle');
  await tap('a:has-text("あそぶ")');
  ok(await until('はじめる', 3000) && await has('漢字パズル'), 'today: Play opens the puzzle at its start');
  await page.waitForTimeout(500);
  await at('02-parts-intro');
  const parts = await round('parts', { level: 'N2', unit: 3, day: 4 });
  ok(parts && parts.puzzles.length >= 3, 'parts: a round of at least three kanji');
  await tap('button:has-text("Start")');
  await page.waitForTimeout(300);
  for (let i = 0; i < parts.puzzles.length; i++) {
    const p = parts.puzzles[i];
    ok(await has(p.word.gloss), `parts ${i + 1}: shows the word's meaning (${p.word.gloss})`);
    if (i === 0) {
      /* a part of another kanji first: a slip */
      await tap('button[aria-label^="Part"]', p.tray.findIndex((t) => !t.right));
      await page.waitForTimeout(250);
      ok(await has('それは ちがう部品'), 'parts: a wrong part is turned away');
      await at('03-parts-wrong');
    }
    const rights = p.tray.map((t, k) => (t.right ? k : -1)).filter((k) => k >= 0);
    for (const k of rights) { await tap('button[aria-label^="Part"]', k); await page.waitForTimeout(250); }
    ok(await until('読み方は', 3000), `parts ${i + 1}: built, and its reading is asked`);
    if (i === 0) { await page.waitForTimeout(450); await at('04-parts-read'); }
    await tap('button[lang="ja"]', p.answer);
    await page.waitForTimeout(350);
    ok(await has(p.word.word + '（' + p.word.reading + '）'), `parts ${i + 1}: the word with its reading once answered`);
    await tap(i + 1 < parts.puzzles.length ? 'button:has-text("つぎへ")' : 'button:has-text("おわり")');
    await page.waitForTimeout(400);
  }
  ok(await until('まる', 3000) && await has('1 slip'), 'parts: one slip, so a まる');
  await page.waitForTimeout(1500);
  await at('05-parts-end');
  await tap('button:has-text("もどる")');
  await page.waitForTimeout(500);
  ok(await has('4日目 完了！') && await has('もう一度') && (await page.locator('[aria-label="まる"]').count()) === 1, 'today: back from the game, its まる and Again');
  await at('06-today-played');

  // ---------- the Games tab ----------
  await tap('a:has-text("Back")');
  await page.waitForTimeout(500);
  await tap('nav[aria-label="Main"] a:has-text("Games")');
  await page.waitForTimeout(600);
  await at('07-hub');
  ok(await has('あそぶ') && await has('第1週') && await has('第3週') && !(await has('第4週')), 'hub: weeks 1 to 3, the ones reached');
  ok(await has('漢字マッチ') && await has('聞き取りキャッチ') && await has('文づくり') && await has('漢字パズル'), 'hub: the four games');
  ok(await has('Open Yaoki Speaking') && await has('Open Yaoki Reader'), 'hub: Speaking and Reader below the games');
  ok((await page.locator('nav[aria-label="Main"] a[aria-current="page"]:has-text("Games")').count()) === 1, 'hub: its tab is marked as the page you are on');
  await tap('button[aria-label^="Week 1"]');
  await page.waitForTimeout(300);

  // a clean Kanji match on week 1
  await tap('a[aria-label^="漢字マッチ"]');
  ok(await until('はじめる', 3000), 'match: opens at its start');
  const match = await round('match', { level: 'N2', unit: 1, day: 0 });
  await tap('button:has-text("Start")');
  await page.waitForTimeout(3400);
  ok((await page.locator('button[aria-label$="face down"]').count()) === match.cards.length, 'match: the cards turn over after the look');
  const done = new Set();
  for (let i = 0; i < match.cards.length; i++) {
    if (done.has(i)) continue;
    const j = match.cards.findIndex((c, k) => k !== i && c.pair === match.cards[i].pair);
    await tap('button[aria-label^="Card "]', i); await page.waitForTimeout(150);
    await tap('button[aria-label^="Card "]', j); await page.waitForTimeout(450);
    done.add(i); done.add(j);
    if (done.size === 4) await at('08-match-pairs');
  }
  ok(await until('はなまる！', 4000), 'match: every pair found, no slip: a はなまる');
  await page.waitForTimeout(1500);
  await at('09-match-end');
  await tap('button:has-text("もどる")');
  await page.waitForTimeout(600);
  ok((await page.locator('button[aria-label^="Week 1, 1 はなまる"]').count()) === 1, 'hub: week 1 shows its はなまる');
  ok((await page.locator('[aria-label="はなまる this week"]').count()) === 1, 'hub: back on week 1, the match tile has its はなまる');

  // Listening catch on week 3, every word caught at once
  await tap('button[aria-label^="Week 3"]');
  await page.waitForTimeout(300);
  await tap('a[aria-label^="聞き取りキャッチ"]');
  ok(await until('はじめる', 3000), 'catch: opens at its start');
  const cat = await round('catch', { level: 'N2', unit: 3, day: 0 });
  await tap('button:has-text("Start")');
  for (let i = 0; i < cat.drops.length; i++) {
    const d = cat.drops[i];
    ok(await until(`${i + 1} / ${cat.drops.length}`, 4000), `catch ${i + 1}: comes`);
    await page.waitForTimeout(500);
    if (i === 1) await at('10-catch-falling');
    await tap(`button[aria-label^="${d.target.word}"]`);
    await page.waitForTimeout(150);
    if (i === 1) await at('11-catch-caught');
  }
  ok(await until('はなまる！', 4000), 'catch: every word caught first time: a はなまる');
  await page.waitForTimeout(1200);
  await tap('button:has-text("Again")');
  await page.waitForTimeout(400);
  ok(await has('はじめる'), 'catch: Again starts a new round');
  await tap('a[aria-label="Close the game"]');
  await page.waitForTimeout(500);

  // the Sentence builder on week 3, every sentence right first time
  await tap('a[aria-label^="文づくり"]');
  ok(await until('はじめる', 3000), 'build: opens at its start');
  const build = await round('build', { level: 'N2', unit: 3, day: 0 });
  await tap('button:has-text("Start")');
  await page.waitForTimeout(300);
  for (let i = 0; i < build.lines.length; i++) {
    const line = build.lines[i];
    for (const t of line.tiles) {
      const label = 'Piece: ' + (await page.evaluate((x) => window.ykCourse.plain(x), t));
      await tap(`button[aria-label="${label}"]:not([disabled])`);
      await page.waitForTimeout(140);
    }
    ok(await until('わたれた', 3000), `build ${i + 1}: the sentence right, Yaoki crosses`);
    if (i === 0) { await page.waitForTimeout(900); await at('12-build-crossed'); }
    await tap(i + 1 < build.lines.length ? 'button:has-text("つぎへ")' : 'button:has-text("おわり")');
    await page.waitForTimeout(300);
  }
  ok(await until('はなまる！', 3000), 'build: no slip: a はなまる');
  await tap('button:has-text("もどる")');
  await page.waitForTimeout(500);
  ok((await page.locator('button[aria-label^="Week 3, 2 はなまる"]').count()) === 1, 'hub: week 3 shows two はなまる');

  // ---------- the kana level: three games, no puzzle ----------
  await open(`screen=Extras&level=KANA&now=${NOW}&plan=${encodeURIComponent(JSON.stringify({ start: '2026-11-10', exam: null, pace: 'steady' }))}&cur=kanau02d1&seed=${SEED}`);
  await at('13-hub-kana');
  ok(await has('かなマッチ') && await has('ことばづくり') && !(await has('漢字パズル')), 'hub (kana): kana match, word builder, no kanji puzzle');
  await tap('a[aria-label^="ことばづくり"]');
  ok(await until('はじめる', 3000), 'kana build: opens');
  const kb = await round('build', { level: 'KANA', unit: 2, day: 0 });
  await tap('button:has-text("Start")');
  await page.waitForTimeout(500);
  await at('14-kana-build');
  for (let i = 0; i < kb.lines.length; i++) {
    for (const t of kb.lines[i].tiles) { await tap(`button[aria-label="Piece: ${t}"]:not([disabled])`); await page.waitForTimeout(140); }
    ok(await until('わたれた', 3000), `kana build ${i + 1}: built`);
    await tap(i + 1 < kb.lines.length ? 'button:has-text("つぎへ")' : 'button:has-text("おわり")');
    await page.waitForTimeout(300);
  }
  ok(await until('はなまる！', 3000), 'kana build: a はなまる');
  await tap('button:has-text("もどる")');
  await page.waitForTimeout(400);
  await tap('a[aria-label^="かなマッチ"]');
  ok(await until('はじめる', 3000), 'kana match: opens');
  const km = await round('match', { level: 'KANA', unit: 2, day: 0 });
  ok(km.cards.some((c) => c.face === 'sound') && km.cards.some((c) => c.face === 'meaning'), 'kana match: kana with their sounds, words with their meanings');
  await tap('button:has-text("Start")');
  await page.waitForTimeout(3400);
  await at('15-kana-match');

  const errs = logs.filter((l) => !/Failed to load resource|favicon/.test(l));
  ok(!errs.length, 'no runtime errors: ' + errs.slice(0, 3).join(' | '));
  await browser.close();
  console.log(fails ? `GAMES TEST FAIL (${fails})` : 'GAMES TEST PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); console.log('GAMES TEST FAIL'); process.exit(1); });
