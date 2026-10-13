// Several levels in one app: picking N5 on the goal screen, the week path and the teach page at N5,
// switching level from the menu (each level keeps its own plan and notebook), and coming back after a restart.
// usage: bash run-app.sh level-test.js      (expects the test build of the app served on localhost:8765)
const { chromium } = require('playwright');

const BASE = 'http://localhost:8765/';
const KEY = 'yaoki.v1:/';
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails += 1; console.log('  FAIL: ' + msg); } };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => logs.push('pageerror: ' + String(e).slice(0, 200)));
  const ready = async () => { await page.waitForSelector('#yk-stage > .sc-host', { timeout: 10000 }); await page.waitForTimeout(400); };
  const text = async () => ((await page.locator('#yk-stage').textContent()) || '').replace(/\s+/g, ' ');
  const click = async (sel, wait = 500) => { await page.locator(sel).first().click({ timeout: 5000 }); await page.waitForTimeout(wait); };
  const saved = async () => JSON.parse((await page.evaluate((k) => localStorage.getItem(k), KEY)) || 'null');

  await page.goto(BASE);
  await ready();
  if ((await text()).includes('Continue in the browser')) { await click('a:has-text("Continue in the browser"), button:has-text("Continue in the browser")'); }
  ok((await text()).includes('目標を決めよう'), 'a first start opens on the goal screen');
  ok(await page.locator('button[aria-label="N3, not written yet"]').isDisabled(), 'N3 has nothing written yet and cannot be picked');
  ok(!(await page.locator('button[aria-label="N4, not written yet"]').count()), 'N4 is written now and can be picked');
  await click('button[aria-pressed]:has-text("N5")');
  ok((await text()).includes('8ユニット'), 'the plan on the goal screen is worked out for N5 (8 units), got: ' + (await text()).slice(0, 300));
  await click('button:has-text("Paint the first eye")');
  await click('a:has-text("Start")', 800);
  let t = await text();
  ok(t.includes('名詞の文') && t.includes('N5'), 'the week path shows N5 unit 1');
  ok(t.includes('判定 準備中') && t.includes('Mock exam'), 'at N5 the mini mock is open and the readiness check is marked as not ready');
  let s = await saved();
  ok(s && s.level === 'N5' && s.plan && s.plan.exam === '2026-12-06', 'the save holds level N5 and its plan, got ' + JSON.stringify(s).slice(0, 160));

  // a lesson at N5 and a mistake in its drill
  await click('a:has-text("はじめる")', 700);
  await click('a:has-text("Start with the teach page")', 700);
  t = await text();
  ok(t.includes('〜は〜です') && t.includes('N5'), 'the teach page shows the N5 point and the N5 badge');
  await click('a[aria-label="Close lesson"]', 600);
  await click('a[aria-label="Back to the week path"]', 600);

  // switch to N2 from the menu: no plan there yet, so its goal screen
  await click('button[aria-label^="Level N5"]', 500);
  ok((await text()).includes('メニュー'), 'the level chip opens the menu');
  await click('button[aria-label="N2"]', 700);
  t = await text();
  ok(t.includes('目標を決めよう'), 'N2 the first time opens its goal screen, got: ' + t.slice(0, 120));
  ok(await page.locator('button[aria-pressed="true"]:has-text("N2")').count() === 1, 'the goal screen has N2 picked');
  await click('button:has-text("Paint the first eye")');
  await click('a:has-text("Start")', 800);
  t = await text();
  ok(t.includes('原因・理由') || t.includes('時・時点'), 'N2 shows its own week path');
  s = await saved();
  ok(s.level === 'N2' && s.plans && s.plans.N5 && s.plans.N5.exam === '2026-12-06', 'the N5 plan is kept aside while on N2, got ' + JSON.stringify(s).slice(0, 200));

  // back to N5: straight to its week path
  await click('button[aria-label^="Level N2"]', 500);
  await click('button[aria-label="N5"]', 700);
  t = await text();
  ok(t.includes('名詞の文') && !t.includes('目標を決めよう'), 'returning to N5 opens its week path, not the goal screen');

  // after a restart the app is still on N5
  await page.reload();
  await ready();
  t = await text();
  ok(t.includes('名詞の文'), 'after a restart the app opens on the N5 week path');
  s = await saved();
  ok(s.level === 'N5' && s.plans && s.plans.N2, 'both plans survive a restart');

  ok(logs.length === 0, 'console errors: ' + JSON.stringify(logs.slice(0, 5)));
  await browser.close();
  console.log(fails ? `LEVEL TEST FAIL (${fails} failed checks)` : 'LEVEL TEST PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('LEVEL TEST CRASH', e); process.exit(1); });
