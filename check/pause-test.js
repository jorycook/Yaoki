// The mini mock when the phone interrupts it: clocks that follow real time, taps that cannot fall through to
// the next screen, and a listening section that stops and waits when the app is put aside, the sound dies or
// the page is frozen, then picks up just before the cut. It never runs on in silence where sound has worked.
// usage: bash run.sh pause-test.js   or   bash run-app.sh pause-test.js   (NOSOUND=1 / HELDBACK=1 for the silent run)
// FULL=1 lets the section play to the end after the interruptions (about two and a half minutes more)
// instead of trying the "sound will not start" sheet and quitting.
// The N1 app also has longer listening items in its lessons (the bank's task, point and gist items, a clip for each
// part of the audio): one is put aside while it plays, and must stop, give the answers and play again from the start.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openBoard, inspect, site, out } = require('./rt-check.js');
// the level's own clip lengths and mock tab text (YK_LEVEL=N1 for the N1 app)
const LV = require('./level.js');

(async () => {
  const fontsCss = fs.readFileSync(path.join(site, 'fonts.css'), 'utf8');
  const browser = await chromium.launch();
  // every audio output the page makes is kept, so the test can count them and switch one off;
  // while window.__stuck is set, a new output never starts (as when a call holds the phone's audio)
  const prep = (page) => page.addInitScript(() => {
    const Real = window.AudioContext || window.webkitAudioContext;
    window.__ctxs = [];
    if (!Real) return;
    class Seen extends Real {
      constructor(...a) {
        super(...a);
        window.__ctxs.push(this);
        if (window.__stuck) {
          try { this.suspend(); } catch (e) { /* stays as it is */ }
          Object.defineProperty(this, 'state', { get: () => 'suspended' });
          this.resume = () => Promise.resolve();
        }
      }
    }
    window.AudioContext = Seen;
    window.webkitAudioContext = Seen;
  });
  const { page, logs } = await openBoard(browser, 'TShell.dc.html?screen=MockRun', fontsCss, prep);
  let fails = 0;
  const ok = (cond, msg) => { if (!cond) { fails += 1; console.log('  FAIL: ' + msg); } };
  const click = async (sel, wait = 400) => { await page.locator(sel).first().click({ timeout: 5000 }); await page.waitForTimeout(wait); };
  const body = async () => ((await page.locator('body').textContent()) || '').replace(/\s+/g, ' ');
  const has = async (text) => (await body()).includes(text);
  const SOUND = !process.env.NOSOUND && !process.env.HELDBACK && !process.env.BADCLIPS;
  const audio = () => page.evaluate(() => window.__audio);
  const starts = async () => (await audio()).filter((a) => a.ev === 'start');
  const stops = async () => (await audio()).filter((a) => a.ev === 'stop');
  const on = () => page.evaluate(() => !!(window.ykSound && window.ykSound.on()));
  const at = () => page.evaluate(() => (window.ykSound ? window.ykSound.at() : -1));
  const ctxs = () => page.evaluate(() => window.__ctxs.map((c) => c.state));
  const stuck = (yes) => page.evaluate((y) => { window.__stuck = y; }, yes);
  // the page as the phone leaves it when the app goes to the background, and as it comes back
  const hide = (hidden) => page.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
  // the page frozen for a while: nothing runs, the wall clock goes on
  const freeze = (ms) => page.evaluate((n) => { const end = Date.now() + n; while (Date.now() < end) { /* held */ } }, ms);
  const seconds = (clock) => { const m = /(\d+):(\d\d)/.exec(clock || ''); return m ? +m[1] * 60 + +m[2] : NaN; };
  const sheetUp = async () => (await page.locator('[role=dialog][aria-label="Listening paused"]').count()) === 1;
  const centre = async (sel) => { const b = await page.locator(sel).first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  // two taps on one spot, the second 60 ms after the first
  const doubleTap = async (sel) => { const [x, y] = await centre(sel); await page.mouse.click(x, y); await page.waitForTimeout(60); await page.mouse.click(x, y); await page.waitForTimeout(500); };
  const shot = async (name) => {
    const info = await inspect(page);
    await page.screenshot({ path: path.join(out, 'ps-' + name + '.png') });
    const bad = info.errors.length || info.issues.length || info.unresolved;
    console.log(`${name}: root=${info.rootH}` + (bad ? ' PROBLEMS ' + JSON.stringify({ e: info.errors, i: info.issues, u: info.unresolved }) : '') + (info.pad.length ? ' PAD WARNING ' + JSON.stringify(info.pad) : ''));
    ok(!bad, name + ': layout or runtime problems');
  };
  // the last clip that started: the first listening clip, picked up "into" milliseconds from its start
  const pickedUp = async (label, before, lo, hi) => {
    const st = await starts();
    const last = st[st.length - 1];
    ok(st.length === before + 1 && Math.abs(last.d - LV.clips.m10_q) < 120, `${label}: the clip that was cut should start once more, got ${JSON.stringify(st.slice(-2))}`);
    ok(last.o >= lo && last.o <= hi, `${label}: it should pick up between ${lo} and ${hi} ms into the clip, got ${last.o}`);
    return last.o;
  };

  // ---------- the section clock and the break follow real time ----------
  await doubleTap('button:has-text("Start section 1")');
  ok(await has('漢字読み'), 'a double tap on Start section 1 should not skip the first question');
  const c0 = seconds(await page.locator('[role=timer]').first().textContent());
  await freeze(3300);
  await page.waitForTimeout(400);
  const c1 = seconds(await page.locator('[role=timer]').first().textContent());
  ok(c0 - c1 >= 3 && c0 - c1 <= 5, `section clock: 3.3 s with the page frozen should take 3 to 5 s off the clock, took ${c0 - c1} (${c0} -> ${c1})`);
  // the phone's clock set back two minutes: the countdown goes on from what it shows
  await page.evaluate(() => { const real = Date.now; window.__realNow = real; Date.now = () => real() - 120000; });
  await page.waitForTimeout(1300);
  const c2 = seconds(await page.locator('[role=timer]').first().textContent());
  ok(c1 - c2 >= 1 && c1 - c2 <= 3, `clock set back: the countdown should carry on, went ${c1} -> ${c2}`);
  await page.evaluate(() => { Date.now = window.__realNow; });
  await page.waitForTimeout(600);

  // ---------- a second tap must not fall through to the button that appears under it ----------
  await click('button[aria-label="Open the answer sheet"]', 500);
  await doubleTap('button[aria-label^="Question 1,"]');
  ok((await has('漢字読み')) && (await page.locator('button[aria-pressed="true"]').count()) === 0, 'a double tap on a row of the answer sheet should open that question without marking an answer');
  await click('button[aria-label="Open the answer sheet"]', 500);
  await click('button[aria-label^="Question 9,"]', 500);
  ok(await has('統合理解'), 'the last question of the section should be up');
  await doubleTap('button:has-text("Answer sheet")');
  ok((await has('answered')) && !(await has('Start section 2')), 'a double tap on Answer sheet should open the sheet, not hand the section in');
  await doubleTap('button:has-text("Submit")');
  ok((await has('Start section 2')) && !(await has('課題理解')), 'a double tap on Submit should stop at the break, not start the listening section');
  await freeze(3300);
  await page.waitForTimeout(400);
  const b1 = seconds(await page.locator('[role=timer]').first().textContent());
  ok(b1 <= 57 && b1 >= 53, `break clock: should have dropped from 1:00 to about 0:56 with the page frozen, shows ${b1}`);
  ok(!(await sheetUp()), 'the pause sheet belongs to listening only');

  // ---------- listening: the app is put aside ----------
  await click('button:has-text("Start section 2")', 300);
  ok(await has('課題理解'), 'listening not reached');
  await page.waitForTimeout(2200);
  if (SOUND) {
    ok(await on(), 'sound should be playing two seconds into listening');
    ok((await starts()).some((a) => Math.abs(a.d - LV.clips.m10_q) < 120 && a.o === 0), 'the first listening clip should have started from its beginning');
    const pos = await at();
    ok(pos > 1500 && pos < 3200, 'the part should keep time with the clip, which is about 2.4 s in, got ' + pos);
  }
  const stopsBefore = (await stops()).length;
  let n = (await starts()).length;
  await hide(true);
  await page.waitForTimeout(300);
  ok(await sheetUp(), 'hidden: the listening section should stop and show the sheet');
  if (SOUND) ok((await stops()).length === stopsBefore + 1, 'hidden: the clip should be cut off');
  await hide(false);
  await page.waitForTimeout(2500);
  ok(await sheetUp(), 'back in front: the section should wait for a tap, not start by itself');
  ok((await starts()).length === n, 'back in front: nothing should play before the tap');
  ok(await has(SOUND ? '音声が止まりました' : '一時停止しました'), 'the sheet should say what stopped');
  ok(!(await has('Continue without sound')), 'an interruption alone should not offer to go on without sound');
  await shot('01-paused');
  await click('button:has-text("Continue")', 1500);
  ok(!(await sheetUp()), 'Continue should close the sheet');
  if (SOUND) {
    // cut about 2.5 s in: it picks up two seconds earlier
    await pickedUp('Continue', n, 100, 1300);
    ok(await on(), 'Continue: sound should be playing again');
    const c = await ctxs();
    ok(c.length === 2 && c[0] === 'closed' && c[1] === 'running', 'after a spell in the background the audio output should be replaced, got ' + JSON.stringify(c));
  } else {
    ok(await has('no sound here'), 'silent run: the band should say there is no sound');
  }
  await shot('02-resumed');

  if (SOUND) {
    // ---------- listening: the sound dies while the page stays in front (a call, another app taking the audio) ----------
    n = (await starts()).length;
    await page.evaluate(() => window.__ctxs[window.__ctxs.length - 1].suspend());
    await page.waitForTimeout(900);
    ok(await sheetUp(), 'sound lost: the section should stop and show the sheet');
    await click('button:has-text("Continue")', 1500);
    await pickedUp('sound lost', n, 0, 1500);
    const c = await ctxs();
    ok(c.length === 3 && c[2] === 'running' && c[1] === 'closed', 'sound lost: Continue should make a new audio output, got ' + JSON.stringify(c));
    ok(await on(), 'sound lost: sound should be playing again');
    ok(!(await sheetUp()), 'sound lost: the sheet should be closed');
  }

  // ---------- listening: the page is frozen for seconds (the phone suspended it) ----------
  // the furthest point of the clip that has been heard so far: picking up never starts more than two seconds before it
  let furthest = 0;
  {
    n = (await starts()).length;
    const before = SOUND ? await at() : 0;
    await freeze(3400);
    await page.waitForTimeout(800);
    ok(await sheetUp(), 'frozen: the section should stop and show the sheet');
    await click('button:has-text("Continue")', 1500);
    ok(!(await sheetUp()), 'frozen: Continue should close the sheet');
    if (SOUND) {
      // the clip went on playing while the page was frozen, so the pick-up point moved with it
      const into = await pickedUp('frozen', n, before + 1000, before + 3400 + 600);
      furthest = into + 2000;
      ok((await ctxs()).length === 4, 'frozen: Continue should make a new audio output as after every pause, got ' + JSON.stringify(await ctxs()));
      ok(await on(), 'frozen: sound should be playing again');
      const pos = await at();
      ok(pos > into + 800 && pos < into + 2600, `frozen: the part should keep time from the pick-up point (${into}), got ${pos}`);
    }
  }

  if (process.env.FULL || !SOUND) {
    // ---------- after the interruptions the section still runs to its end ----------
    const from = (await starts()).length - 1;
    const t0 = Date.now();
    await page.locator('button[aria-pressed] >> nth=2').first().click();
    await page.waitForFunction(() => document.body.textContent.includes('Correct answers'), null, { timeout: 200000 });
    const took = Date.now() - t0;
    console.log('   rest of the listening section took ' + Math.round(took / 1000) + ' s');
    if (SOUND) {
      const st = (await starts()).slice(from);
      const want = LV.mockClips;
      ok(st.length === 7 && st.every((a, k) => Math.abs(a.d - want[k]) < 120), 'after resuming: wrong clips or order: ' + JSON.stringify(st.map((a) => a.d)));
      ok(st.every((a, k) => k === 0 || (a.o === 0 && a.t >= st[k - 1].t + st[k - 1].d - st[k - 1].o)), 'after resuming: a clip started before the one before it had ended: ' + JSON.stringify(st));
      // the first clip had already played a few seconds
      ok(took > LV.listeningMs - 18500 && took < LV.listeningMs + 3600, 'after resuming: expected about ' + Math.round(LV.listeningMs / 1000) + ' s less the part already heard, took ' + took);
    }
    ok(!(await sheetUp()), 'the sheet should not come back in a clean stretch');
    await shot('03-result');
  } else {
    // ---------- the sound will not start again (a call still holds it): the section must not run on in silence ----------
    // the clip is cut again before it is back at the furthest point heard: it still picks up two seconds before that point
    const cut = Math.max(await at(), furthest);
    await stuck(true);
    await hide(true);
    await page.waitForTimeout(200);
    await hide(false);
    await page.waitForTimeout(500);
    ok(await sheetUp(), 'second interruption: sheet expected');
    n = (await starts()).length;
    await click('button:has-text("Continue")', 1500);
    ok(!(await sheetUp()) && !(await has('no sound here')), 'while the sound is being waited for, the section should neither ask nor go silent yet');
    await pickedUp('Continue with the audio held', n, cut - 2300, cut - 1700);
    await page.waitForTimeout(2200);
    ok(await sheetUp(), 'no sound after three seconds: the section should stop and ask');
    ok((await has('音声を再生できません')) && (await has('Try again')) && (await has('Continue without sound')), 'that sheet should offer to try again or to go on without sound');
    ok(await has('課題理解'), 'the section should still be on its first question');
    await shot('03-no-start');
    // trying again while the audio is still held must not creep further back each time
    n = (await starts()).length;
    await click('button:has-text("Try again")', 3800);
    ok((await sheetUp()) && (await has('Try again')), 'still no sound: the sheet should ask again');
    await pickedUp('Try again with the audio held', n, cut - 2300, cut - 1700);
    // the call is over: Try again brings the sound back, two seconds before the furthest point heard
    await stuck(false);
    n = (await starts()).length;
    await click('button:has-text("Try again")', 1500);
    ok(!(await sheetUp()) && (await on()), 'Try again with the audio free: sound should play and the sheet close');
    await pickedUp('Try again', n, cut - 2300, cut - 1700);
    // and once more, this time going on without sound
    await stuck(true);
    await hide(true);
    await page.waitForTimeout(200);
    await hide(false);
    await page.waitForTimeout(500);
    await click('button:has-text("Continue")', 3800);
    ok((await sheetUp()) && (await has('Continue without sound')), 'no sound again: the sheet should ask again');
    const made = (await ctxs()).length;
    await click('button:has-text("Continue without sound")', 800);
    ok(!(await sheetUp()) && (await has('no sound here')), 'Continue without sound should go on by timing alone and say so');
    ok((await ctxs()).length === made, 'going on without sound should not ask for the audio again');
    await stuck(false);
    await hide(true);
    await page.waitForTimeout(200);
    await hide(false);
    await page.waitForTimeout(500);
    ok((await sheetUp()) && (await has('一時停止しました')), 'a silent run that is interrupted should say it paused');
    await click('button:has-text("Continue")', 1500);
    ok((await has('no sound here')) && (await ctxs()).length === made, 'after choosing to go on without sound, Continue should stay silent');
    await shot('04-silent');
    // ---------- quitting from the sheet ----------
    await hide(true);
    await page.waitForTimeout(200);
    await hide(false);
    await page.waitForTimeout(500);
    ok(await sheetUp(), 'last interruption: sheet expected');
    n = (await starts()).length;
    await click('[role=dialog][aria-label="Listening paused"] a:has-text("Quit")', 700);
    ok(await has(LV.tabCount), 'Quit on the sheet should lead back to the mock tab');
    await page.waitForTimeout(1500);
    ok((await starts()).length === n, 'after quitting nothing should play');
    await shot('05-quit');
  }

  // ---------- N1: a lesson's longer listening item put aside while it plays ----------
  const more = [];
  if (LV.LEVEL === 'N1') {
    const TODAY = '2026-10-14';
    const N = LV.course(TODAY);
    const plan = N.make({ start: TODAY, exam: N.sessions(TODAY)[1].date, pace: 60 });
    const di = plan.days.findIndex((x, i) => { const v = N.view(plan, i); return v.listening && v.listening.kind !== 'quick'; });
    const e = N.view(plan, di).listening;
    plan.open = di;
    const { page: lp, logs: llogs } = await openBoard(browser, 'TShell.dc.html?screen=Listening&ykdate=' + TODAY + '&plan=' + encodeURIComponent(JSON.stringify(plan)), fontsCss, prep);
    const lst = async () => (await lp.evaluate(() => window.__audio)).filter((a) => a.ev === 'start');
    const lstops = async () => (await lp.evaluate(() => window.__audio)).filter((a) => a.ev === 'stop').length;
    const lon = () => lp.evaluate(() => !!(window.ykSound && window.ykSound.on()));
    const open4 = () => lp.evaluate(() => [...document.querySelectorAll('button[aria-label^="Option "]')].filter((b) => b.getAttribute('aria-disabled') !== 'true').length);
    const lhide = (h) => lp.evaluate((hh) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hh ? 'hidden' : 'visible') });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hh });
      document.dispatchEvent(new Event('visibilitychange'));
    }, h);
    const lshot = async (name) => {
      const info = await inspect(lp);
      await lp.screenshot({ path: path.join(out, 'ps-n1-' + name + '.png') });
      const bad = info.errors.length || info.issues.length || info.unresolved;
      console.log(`n1-${name}: root=${info.rootH}` + (bad ? ' PROBLEMS ' + JSON.stringify({ e: info.errors, i: info.issues, u: info.unresolved }) : '') + (info.pad.length ? ' PAD WARNING ' + JSON.stringify(info.pad) : ''));
      ok(!bad, 'n1-' + name + ': layout or runtime problems');
    };
    ok(e.clips.length >= 2 && (await open4()) === 0, `N1 ${e.src} (${e.kind}): the options should wait for the audio`);
    await lp.locator('button[aria-label^="Play the audio"]').first().click({ timeout: 5000 });
    await lp.waitForTimeout(2500);
    if (SOUND) {
      ok(await lon(), `N1 ${e.src}: sound should be playing two seconds in`);
      const st = await lst();
      ok(st.length === 1 && Math.abs(st[0].d - LV.clips[e.clips[0]]) < 120, `N1 ${e.src}: its first part (${e.clips[0]}) should be playing, got ` + JSON.stringify(st));
    }
    await lshot('playing');
    const s0 = await lstops();
    const n0 = (await lst()).length;
    await lhide(true);
    await lp.waitForTimeout(400);
    if (SOUND) ok((await lstops()) > s0 && !(await lon()), `N1 ${e.src}: put aside, the clip should be cut off`);
    await lhide(false);
    await lp.waitForTimeout(2500);
    ok((await lst()).length === n0, `N1 ${e.src}: back in front, nothing should play before a tap`);
    if (SOUND) ok((await open4()) === 4, `N1 ${e.src}: once the sound has stopped, the answers should be open (the item can be played again)`);
    await lshot('put-aside');
    if (SOUND) {
      /* Replay starts the item again from its first part, from the beginning */
      await lp.locator('button:has-text("Replay")').first().click({ timeout: 5000 });
      await lp.waitForTimeout(1500);
      const st = await lst();
      const last = st[st.length - 1];
      ok(st.length === n0 + 1 && Math.abs(last.d - LV.clips[e.clips[0]]) < 120 && last.o === 0 && (await lon()), `N1 ${e.src}: Replay should play the first part again from its start, got ` + JSON.stringify(st.slice(-2)));
      await lshot('replayed');
    }
    more.push(...llogs);
    await lp.close();
  }

  const noisy = logs.concat(more).filter((l) => !/Download the React DevTools/.test(l));
  console.log('console problems: ' + JSON.stringify(noisy.slice(0, 10)));
  console.log((SOUND ? 'with sound: ' : 'silent: ') + (fails === 0 && noisy.length === 0 ? 'PAUSE TEST PASS' : `PAUSE TEST FAIL (${fails} failed checks, ${noisy.length} console problems)`));
  await browser.close();
})().catch((e) => { console.error('PAUSE TEST CRASH', e); process.exit(1); });
