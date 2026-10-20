// M1 storyboard: lobby, lineup, live match moments, half-time, result. Usage: node scripts/capture-m1.mjs <url> <dir>
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [, , base = 'http://localhost:4174', out = 'shots', w = '390', h = '844'] = process.argv;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] } : {});
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const shot = async (name, full = false, wait = 600) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${w}-${name}.png`, fullPage: full });
  console.log('captured', name);
};

await page.goto(base + '/');
await page.getByRole('button', { name: /start your club/i }).click();
await page.waitForSelector('.club__hud');
await shot('m1-01-club', true);
await page.getByRole('button', { name: 'Match', exact: true }).click();
await shot('m1-02-lobby', true);
await page.getByRole('button', { name: /lineup/i }).first().click();
await shot('m1-03-lineup', true);
await page.locator('[data-slot="MID_L"]').click();
await shot('m1-04-lineup-selected', false, 300);
await page.locator('.lineup__bench-player').nth(1).click();
await shot('m1-05-lineup-swapped', false, 500);
await page.getByRole('button', { name: 'Done' }).click();
await page.getByRole('button', { name: /play match/i }).click();
await page.waitForSelector('.live__pitch canvas', { timeout: 15000 });
await shot('m1-06-kickoff', false, 2500);
await page.locator('.tchip').first().click();
await shot('m1-07-press', false, 500);
await shot('m1-08-midplay', false, 6000);
// Run at 2x until half-time
await page.locator('.live__speed').click();
await page.waitForSelector('text=Second half', { timeout: 120000 });
await shot('m1-09-halftime', false, 300);
await page.getByRole('button', { name: /second half/i }).click();
await shot('m1-10-second-half', false, 3000);
await page.getByRole('button', { name: /skip to ft/i }).click();
await page.getByRole('button', { name: /simulate the rest/i }).click();
await page.waitForSelector('.result__hero', { timeout: 20000 });
await shot('m1-11-result', true, 1500);
if (await page.locator('.result__replay').count()) {
  await page.locator('.result__replay').first().click();
  await page.waitForSelector('.live__pitch canvas', { timeout: 15000 });
  await shot('m1-12-replay', false, 6500);
}
console.log('ERRORS', JSON.stringify(errors));
await browser.close();
