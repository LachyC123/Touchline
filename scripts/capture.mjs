// Captures reference screenshots of the M0 screens at phone size (visual review storyboard).
// Usage: node scripts/capture.mjs <baseUrl> <outDir> [width] [height]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [, , base = 'http://localhost:4174', out = 'shots', w = '390', h = '844'] = process.argv;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const shot = async (name, full = false) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${w}-${name}.png`, fullPage: full });
  console.log('captured', name);
};

await page.goto(base + '/');
await shot('01-title');
await page.getByRole('button', { name: /start your club/i }).click();
await page.waitForSelector('.club__hud');
await shot('02-club', true);
await page.getByRole('button', { name: 'Squad', exact: true }).click();
await shot('03-squad', true);
await page.locator('.squad__grid [data-player-id]').first().click();
await shot('04-player-front');
await page.locator('.player__hero .fc').click();
await page.waitForTimeout(600);
await shot('05-player-back');
await page.locator('.player__hero .fc').click();
await page.getByRole('tab', { name: 'stats' }).click();
await shot('06-player-stats', true);
await page.getByRole('button', { name: 'More', exact: true }).click();
await shot('07-more', true);
if (process.env.LAB) {
  for (const seed of (process.env.LAB_SEEDS ?? 'lab-0001').split(',')) {
    await page.goto(`${base}/#/lab`);
    await page.locator('.lab__controls input').fill(seed);
    await shot(`08-lab-${seed}`, true);
  }
}
await browser.close();
