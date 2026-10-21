// DEV build only (needs the Lab). Usage: node scripts/capture-moment.mjs <url> <outDir> "<scenario button>" "<ticker regex>" [seconds]
import { chromium } from '@playwright/test';
const [url, out, label, re, seconds = '40'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url);
await page.getByRole('button', { name: /start your club/i }).click();
await page.getByRole('button', { name: 'Skip', exact: true }).click();
await page.getByRole('button', { name: /meet your first signing/i }).click();
await page.getByRole('button', { name: /skip tutorial/i }).click();
await page.waitForSelector('.club__hud');
await page.goto(url + '#/lab');
await page.getByRole('button', { name: label, exact: true }).click();
await page.waitForSelector('.live__pitch canvas', { timeout: 60000 });
await page.locator('.live__speed').click();
const rx = new RegExp(re, 'i');
const end = Date.now() + Number(seconds) * 1000;
let n = 0;
while (Date.now() < end && n < 6) {
  const t = (await page.locator('.ticker').textContent().catch(() => '')) ?? '';
  if (rx.test(t)) {
    for (const d of [0, 120, 240, 400, 700, 1100]) { await page.waitForTimeout(d ? 110 : 0); await page.screenshot({ path: `${out}/${label.replace(/\s/g, '')}-${n++}.png` }); }
    console.log('captured', t);
    break;
  }
  await page.waitForTimeout(60);
}
console.log('ERRORS', JSON.stringify(errors));
await browser.close();
