import { expect, test, type Page } from '@playwright/test';
import { startCareerSkippingTutorial, tab } from './helpers';

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

async function newClub(page: Page) {
  await startCareerSkippingTutorial(page);
}

async function coins(page: Page): Promise<number> {
  await page.goto('/#/club');
  const label = await page.locator('.club__coins').getAttribute('aria-label');
  return Number(label?.match(/\d+/)?.[0]);
}

async function playAndSkip(page: Page) {
  await page.goto('/#/match');
  await page.getByRole('button', { name: /play match/i }).click();
  await expect(page.locator('.live__pitch canvas')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /skip to ft/i }).click();
  await page.getByRole('button', { name: /simulate the rest/i }).click();
  await expect(page.locator('.result__hero')).toBeVisible({ timeout: 20_000 });
}

test('lineup: tap-to-swap and formation changes persist after reload', async ({ page }) => {
  await newClub(page);
  await page.goto('/#/lineup');
  const benchPlayer = page.locator('.lineup__bench-player').first();
  const benchName = ((await benchPlayer.locator('.pitchboard__name').textContent()) ?? '').trim();
  await page.locator('[data-slot="MID_L"]').click();
  await benchPlayer.click();
  await expect(page.locator('[data-slot="MID_L"] .pitchboard__name')).toHaveText(benchName);

  await page.getByRole('button', { name: /3-2-1/ }).click();
  await expect(page.locator('[data-slot="DEF_C"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-slot="DEF_C"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /3-2-1/ })).toHaveAttribute('aria-pressed', 'true');
  // Goalkeeper slot is enforced.
  await page.locator('[data-slot="GK"]').click();
  await page.locator('[data-slot="FWD_C"]').click();
  await expect(page.getByRole('status')).toContainText(/goalkeeper/i);
});

test('match: tactic chip, skip to full time, rewards paid exactly once across reloads', async ({ page }) => {
  await newClub(page);
  const before = await coins(page);
  await page.goto('/#/match');
  await page.getByRole('button', { name: /play match/i }).click();
  await expect(page.locator('.live__pitch canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  await page.locator('.tchip').first().click();
  await expect(page.locator('.tchip').first()).toHaveClass(/is-active/);
  await page.getByRole('button', { name: /skip to ft/i }).click();
  await page.getByRole('button', { name: /simulate the rest/i }).click();
  await expect(page.locator('.result__hero')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.result__ft')).toContainText(/full time/i);

  const reward = Number((await page.locator('.result__coins b').innerText()).replace(/\D/g, '')) || 0;
  const url = page.url();
  const after = await coins(page);
  expect(after).toBeGreaterThan(before);
  // The count-up may still be animating when read; trust the stored total instead.
  expect(after - before).toBeGreaterThanOrEqual(reward);

  // Reloading the result page (or the app) never pays again.
  await page.goto(url);
  await page.reload();
  await expect(page.locator('.result__hero')).toBeVisible();
  expect(await coins(page)).toBe(after);

  // Goal replays re-run the stored seed + commands through the same renderer.
  const replays = page.locator('.result__replay');
  if ((await replays.count()) > 0) {
    await replays.first().click();
    await expect(page.locator('.replay__tag')).toBeVisible();
    await expect(page.locator('.live__pitch canvas')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/does not match/i)).toHaveCount(0);
    await page.getByRole('button', { name: /close replay/i }).click();
    await expect(page.locator('.result__hero')).toBeVisible();
  }

  await tab(page, 'Match').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/match 2/i);
});

test('a reload mid-match resumes the same match at the same minute', async ({ page }) => {
  await newClub(page);
  await page.goto('/#/match');
  await page.getByRole('button', { name: /play match/i }).click();
  await expect(page.locator('.live__pitch canvas')).toBeVisible({ timeout: 20_000 });
  // Wait for real match progress (rendering speed varies by device): checkpoints every 3 s of play.
  const clock = page.locator('.scoreboard__clock');
  await expect.poll(async () => Number((await clock.innerText()).replace(/\D/g, '')), { timeout: 60_000 }).toBeGreaterThanOrEqual(5);
  const minuteBefore = Number((await clock.innerText()).replace(/\D/g, ''));
  await page.reload();
  await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 20_000 });
  const minuteAfter = Number((await page.locator('.scoreboard__clock').innerText()).replace(/\D/g, ''));
  expect(minuteAfter).toBeGreaterThanOrEqual(Math.max(0, minuteBefore - 2));
  expect(minuteAfter).toBeLessThanOrEqual(minuteBefore);
  await page.getByRole('button', { name: /^resume$/i }).click();
  await expect.poll(async () => Number((await clock.innerText()).replace(/\D/g, '')), { timeout: 30_000 }).toBeGreaterThan(minuteAfter);
});

test('after two matches players level up and a training focus applies once', async ({ page }) => {
  await newClub(page);
  await playAndSkip(page);
  await page.getByRole('button', { name: /next match/i }).click();
  await playAndSkip(page);
  const picker = page.locator('.upgrade').first();
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: /^train /i }).first().click();
  await expect(picker).toContainText(/locked in/i);
  await page.reload();
  await expect(page.locator('.result__hero')).toBeVisible();
  // That level-up is consumed; any remaining pickers are for other players.
  const remaining = await page.locator('.upgrade').count();
  await page.goto('/#/match');
  await expect(page.locator('.upgrade')).toHaveCount(Math.min(2, remaining));
});
