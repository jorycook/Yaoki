// The kana course's sound, as a learner meets it: every kana and word tapped on every card, every question heard
// and answered, every speaker button of the writing, every word read and every quiz question, on all 24 days, in
// the app build with real decoding. Reports a sound asked for that is not there (has() false), a play that is
// refused, and a clip that never starts (decoding failed), with where it happened.
// usage: bash run-app.sh kana-sound.js     (DAYS=kanau01d1,kanau02d5 to limit it)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, site } = require('./rt-check.js');

const NOW = Date.UTC(2026, 10, 11, 15);
const PLAN = encodeURIComponent(JSON.stringify({ start: '2026-11-11', exam: null, pace: 'steady' }));

/* watch the sound player: what the screens ask for, what it says, and whether the clip really starts */
const SPY = () => {
  window.__snd = [];
  const hook = () => {
    const s = window.ykSound;
    if (!s || s.__spied) return !!(s && s.__spied);
    const has = s.has.bind(s);
    const play = s.play.bind(s);
    s.has = (k) => { const r = has(k); if (!r) window.__snd.push({ f: 'has', k, r }); return r; };
    s.play = (k, from) => { const r = play(k, from); window.__snd.push({ f: 'play', k, r, t: Date.now() }); return r; };
    s.__spied = true;
    return true;
  };
  const t = setInterval(() => { if (hook()) clearInterval(t); }, 5);
};

(async () => {
  const fontsCss = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8');
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const problems = [];
  let plays = 0;
  const open = async (screen, extra) => {
    const r = await openBoard(browser, 'TShell.dc.html?screen=' + screen + '&now=' + NOW + '&level=KANA&plan=' + PLAN + (extra || ''), fontsCss,
      (p) => p.addInitScript(() => { window.__ykWriteAuto = true; window.__ykWriteFast = true; }));
    await r.page.evaluate(SPY);
    /* the unit's clips arrive with its sound file, fetched when the level's view is made */
    await r.page.waitForFunction(() => window.__ykClips && Object.keys(window.__ykClips).some((k) => /^k_/.test(k)), null, { timeout: 15000 }).catch(() => {});
    return r;
  };
  /* after a tap that should sound: the play call, its answer, and the clip started by the audio clock */
  const heard = async (page, where, want) => {
    await page.waitForTimeout(60);
    const log = await page.evaluate(() => { const l = window.__snd.slice(); window.__snd.length = 0; return l; });
    const missing = log.filter((e) => e.f === 'has' && e.k);
    const asked = log.filter((e) => e.f === 'play');
    for (const m of missing) problems.push(`${where}: no clip ${m.k}`);
    const refused = asked.filter((e) => !e.r);
    for (const r of refused) problems.push(`${where}: play(${r.k}) refused`);
    if (want && !asked.length && !missing.length) problems.push(`${where}: nothing played (expected ${want})`);
    if (want && asked.length && want !== true && !asked.some((e) => e.k === want)) problems.push(`${where}: played ${asked.map((e) => e.k).join(',')} instead of ${want}`);
    if (asked.some((e) => e.r)) {
      plays += 1;
      const started = await page.waitForFunction(() => window.ykSound.at() >= 0, null, { timeout: 2500 }).then(() => true, () => false);
      if (!started) problems.push(`${where}: ${asked.map((e) => e.k).join(',')} accepted but never started (decoding?)`);
    }
  };
  const tap = (page, sel) => page.locator(sel).first().click({ timeout: 4000 });

  const probe = await open('Main');
  const course = await probe.page.evaluate(() => {
    const C = window.ykCourse;
    C.setLevel('KANA');
    return C.sessions().filter((s) => s.ready && s.kind !== 'test').map((s) => ({ id: s.id, day: C.day(s.id) }));
  });
  await probe.page.close();
  const only = (process.env.DAYS || '').split(',').filter(Boolean);
  const days = course.filter((d) => !only.length || only.includes(d.id));
  console.log(`kana days: checking ${days.length}`);

  /* a clip that cannot be decoded silences only itself: the first decode fails, and the next tap still sounds */
  if (!only.length || only.includes('kanau01d1')) {
    const { page } = await open('Kana', '&cur=kanau01d1');
    await page.evaluate(() => {
      const P = (window.BaseAudioContext || window.AudioContext).prototype;
      const real = P.decodeAudioData;
      let left = 1;
      P.decodeAudioData = function (data, ok, fail) {
        if (left > 0) { left -= 1; const e = new DOMException('test: cannot decode', 'EncodingError'); if (fail) setTimeout(() => fail(e), 0); return Promise.reject(e); }
        return real.call(this, data, ok, fail);
      };
    });
    await page.locator('button[aria-label="あ, a. Play it"]').first().click({ timeout: 4000 });
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.__snd.length = 0; });
    await page.locator('button[aria-label="あ, a. Play it"]').first().click({ timeout: 4000 });
    await heard(page, 'after a clip that could not be decoded, the next tap', 'k_a');
    await page.close();
  }

  for (const { id, day } of days) {
    const cur = '&cur=' + id;
    // learn: each card as it opens, then every kana and word on it
    {
      const { page } = await open('Kana', cur);
      const cards = day.kana.cards;
      for (let k = 0; k < cards.length; k++) {
        if (k > 0) {
          await tap(page, 'button:has-text("Next:")');
          const first = cards[k].kana.find((x) => x[2]);
          await heard(page, `${id} card ${k + 1} opens`, first ? first[2] : (cards[k].words[0] || {}).clip);
        } else {
          await page.evaluate(() => { window.__snd.length = 0; });
        }
        const tiles = cards[k].kana;
        for (let j = 0; j < tiles.length; j++) {
          const [kana, r, clip] = tiles[j];
          /* a kana with no sound of its own plays the card's first word */
          const first = cards[k].words[0];
          const label = kana + (r ? ', ' + r : '') + (clip ? '. Play it' : first ? '. Play a word with it' : '');
          const el = page.locator(`button[aria-label="${label}"]`).first();
          if (!(await el.count())) { problems.push(`${id} card ${k + 1}: no button for ${kana}`); continue; }
          await el.click({ timeout: 4000 });
          await heard(page, `${id} card ${k + 1} tap ${kana}`, clip || (first ? first.clip : null));
        }
        for (const w of cards[k].words) {
          const el = page.locator(`button[aria-label="${w.w}, ${w.r}, ${w.gloss}. Play it"]`).first();
          if (!(await el.count())) { problems.push(`${id} card ${k + 1}: no button for the word ${w.w}`); continue; }
          await el.click({ timeout: 4000 });
          await heard(page, `${id} card ${k + 1} word ${w.w}`, w.clip);
        }
      }
      // practice: a heard question sounds as it comes; every question sounds once answered
      await tap(page, 'button:has-text("Next: practice")');
      const drill = day.kana.drill;
      for (let i = 0; i < drill.length; i++) {
        const it = drill[i];
        if (i === 0) await heard(page, `${id} practice 1 comes`, it.mode === 'hear' ? it.clip : null);
        if (it.mode === 'hear') {
          await tap(page, 'button[aria-label="Play the sound again"]');
          await heard(page, `${id} practice ${i + 1} replay`, it.clip);
        }
        await page.locator('button[aria-pressed]').nth(it.answer - 1).click({ timeout: 4000 });
        await heard(page, `${id} practice ${i + 1} answered`, it.clip || null);
        await tap(page, i === drill.length - 1 ? 'button:has-text("Next")' : 'button:has-text("Next")');
        const nx = drill[i + 1];
        if (nx) await heard(page, `${id} practice ${i + 2} comes`, nx.mode === 'hear' ? nx.clip : null);
      }
      // the check: heard questions sound as they come
      const check = day.kana.check;
      await heard(page, `${id} check 1 comes`, check[0] && check[0].mode === 'hear' ? check[0].clip : null);
      for (let i = 0; i < check.length; i++) {
        await page.locator('button[aria-pressed]').nth(check[i].answer - 1).click({ timeout: 4000 });
        await heard(page, `${id} check ${i + 1} answered`, null);
        await tap(page, i === check.length - 1 ? 'button:has-text("See the results")' : 'button:has-text("Next")');
        const nx = check[i + 1];
        if (nx) await heard(page, `${id} check ${i + 2} comes`, nx.mode === 'hear' ? nx.clip : null);
      }
      await page.close();
    }
    // writing: the speaker of each kana, each word said as it comes and again on its speaker
    {
      const { page } = await open('KanaWrite', cur);
      const kana = Array.from(day.write.kana);
      const total = kana.length + day.write.words.length;
      for (let k = 0; k < total; k++) {
        const isWord = k >= kana.length;
        const w = isWord ? day.write.words[k - kana.length] : null;
        if (k > 0 && isWord) await heard(page, `${id} write ${k + 1} (${w.w}) comes`, w.clip);
        const speaker = page.locator('button[aria-label^="Hear"]').first();
        if (await speaker.count()) {
          await speaker.click({ timeout: 4000 });
          let want = true;
          if (isWord) want = w.clip;
          await heard(page, `${id} write ${k + 1} (${isWord ? w.w : kana[k]}) speaker`, want);
        } else if (isWord) {
          problems.push(`${id} write ${k + 1} (${w.w}): no speaker`);
        }
        await page.waitForFunction(() => !Array.from(document.querySelectorAll('button[aria-disabled="true"]')).some((b) => /書いてから/.test(b.textContent)), null, { timeout: 15000 }).catch(() => {});
        await page.evaluate(() => { window.__snd.length = 0; });
        if (k < total - 1) await tap(page, 'button:has-text("Next")');
      }
      await page.close();
    }
    // words: each row read and tapped, then the quiz
    {
      const { page } = await open('KanaWords', cur);
      const list = day.words.list;
      for (let k = 0; k < list.length; k++) {
        await page.locator('[role="listitem"]').nth(k).click({ timeout: 4000 });
        await heard(page, `${id} words ${list[k].w}`, list[k].clip);
      }
      await tap(page, 'button:has-text("Next: practice")');
      const quiz = day.words.quiz;
      for (let i = 0; i < quiz.length; i++) {
        const it = quiz[i];
        if (i === 0) await heard(page, `${id} quiz 1 comes`, it.mode === 'hear' ? it.clip : null);
        if (it.mode === 'hear') {
          await tap(page, 'button[aria-label="Play the word again"]');
          await heard(page, `${id} quiz ${i + 1} replay`, it.clip);
        }
        await page.locator('button[aria-pressed]').nth(it.answer - 1).click({ timeout: 4000 });
        await heard(page, `${id} quiz ${i + 1} answered`, it.clip || null);
        if (i < quiz.length - 1) {
          await tap(page, 'button:has-text("Next")');
          const nx = quiz[i + 1];
          await heard(page, `${id} quiz ${i + 2} comes`, nx.mode === 'hear' ? nx.clip : null);
        }
      }
      await page.close();
    }
    console.log(`  ${id}: ${problems.length} problem(s) so far, ${plays} sounds started`);
  }
  await browser.close();
  for (const p of problems.slice(0, 80)) console.log('  ' + p);
  console.log(problems.length ? `KANA SOUND FAIL (${problems.length})` : `KANA SOUND PASS (${plays} sounds started)`);
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error(e); console.log('KANA SOUND FAIL'); process.exit(1); });
