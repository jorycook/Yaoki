const { chromium } = require('playwright');
(async () => {
  const B = 'http://localhost:8766/';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 500 } });
  const logs = [];
  page.on('console', (m) => { if (m.type() !== 'info' && m.type() !== 'log') logs.push(m.type() + ': ' + m.text().slice(0, 200)); });
  page.on('pageerror', (e) => logs.push('pageerror: ' + String(e).slice(0, 200)));
  const T = async (sel) => (await page.locator(sel).first().textContent()).trim();
  // 1. child alone
  await page.goto(B + 'Child.dc.html'); await page.waitForSelector('#mode');
  console.log('alone: mode=' + await T('#mode'), 'count=' + await T('#count'));
  console.log('  inc style before:', await page.locator('#inc').getAttribute('style'));
  await page.click('#inc');
  console.log('  after inc: count=' + await T('#count'), 'style:', await page.locator('#inc').getAttribute('style'));
  console.log('  opts pressed:', await page.locator('.opt').evaluateAll((els) => els.map((e) => e.getAttribute('aria-pressed') + (e.disabled ? ':disabled' : '') + ':' + e.querySelectorAll('svg').length)));
  await page.locator('.opt').nth(0).click();
  console.log('  after pick a:', await page.locator('.opt').evaluateAll((els) => els.map((e) => e.getAttribute('aria-pressed') + ':' + e.querySelectorAll('svg').length + ':' + e.style.background)));
  console.log('  ruby html:', await page.locator('#ruby').innerHTML());
  console.log('  pupil style:', await page.locator('#pupil').getAttribute('style'), 'viewBox:', await page.locator('#eye').getAttribute('viewBox'));
  await page.click('#link'); await page.waitForTimeout(600);
  console.log('  after link click, url:', page.url(), 'has #other:', await page.locator('#other').count());
  // 2. shell
  await page.goto(B + 'Shell.dc.html'); await page.waitForSelector('#mode');
  console.log('shell:', await T('#shellstate'), '| mode=' + await T('#mode'), 'count=' + await T('#count'));
  await page.click('#inc'); await page.click('#inc');
  console.log('  after 2 inc:', await T('#shellstate'), '| mode=' + await T('#mode'), 'count=' + await T('#count'));
  await page.click('#link'); await page.waitForTimeout(500);
  console.log('  after link:', page.url(), await T('#shellstate'), 'other:', await page.locator('#other').count(), 'child:', await page.locator('#mode').count());
  await page.click('#back'); await page.waitForTimeout(500);
  console.log('  after back:', page.url(), await T('#shellstate'), '| mode=' + await T('#mode'), 'count=' + await T('#count'));
  console.log('  head styles:', await page.evaluate(() => document.head.querySelectorAll('style').length), 'hosts:', await page.evaluate(() => [...document.querySelectorAll('.sc-host')].map((h) => h.getAttribute('data-sc-name'))));
  console.log('logs:', logs);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
