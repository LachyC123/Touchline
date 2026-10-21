import { expect, test, type Page } from '@playwright/test';
import { startCareerSkippingTutorial } from './helpers';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

async function playAndSkip(page: Page) {
  await page.goto('/#/match');
  await page.getByRole('button', { name: /play match/i }).click();
  await expect(page.locator('.live__pitch canvas')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /skip to ft/i }).click();
  await page.getByRole('button', { name: /simulate the rest/i }).click();
  await expect(page.locator('.result__hero')).toBeVisible({ timeout: 20_000 });
}

test('league: a round is played across the division and the table adds up after a reload', async ({ page }) => {
  await startCareerSkippingTutorial(page);
  await expect(page.locator('.club__league')).toContainText(/division two/i);
  await expect(page.locator('.cabinet__shelf.is-empty')).toContainText(/top 2/i);
  await playAndSkip(page);
  const around = page.locator('.result__league');
  await expect(around).toBeVisible();
  await expect(around.locator('li')).toHaveCount(4);
  // The next fixture has a build-up drawn from the results, and both sides show their form.
  await page.goto('/#/match');
  await expect(page.locator('.lobby__buildup .storyline').first()).toBeVisible();
  await expect(page.locator('.fixture__team .form-dots')).toHaveCount(2);
  await expect(page.locator('.fixture__team').first().locator('.form-dot')).toHaveCount(1);
  await page.reload();
  await page.goto('/#/league');
  const rows = page.locator('.league__table tbody tr');
  await expect(rows).toHaveCount(8);
  // Everyone has played one match; points across the table equal 3 per win + 2 per draw.
  const played = await rows.locator('td:nth-child(3)').allTextContents();
  expect(played.every((p) => p.trim() === '1')).toBe(true);
  const points = (await rows.locator('.lt__pts').allTextContents()).map(Number);
  const total = points.reduce((a, b) => a + b, 0);
  expect([8, 9, 10, 11, 12]).toContain(total);
  await expect(page.locator('.league__table tr.is-us')).toHaveCount(1);
  await page.getByRole('tab', { name: 'Fixtures' }).click();
  await expect(page.locator('.league__round')).toHaveCount(14);
  await page.getByRole('tab', { name: 'Scorers' }).click();
  await expect(page.locator('.league__scorers')).toBeVisible();
});

test('league: a whole season ends on the final day and season 2 starts once', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone-390', 'one viewport is enough for the long season run');
  test.setTimeout(420_000);
  await startCareerSkippingTutorial(page);
  for (let round = 0; round < 14; round++) await playAndSkip(page);
  await page.getByRole('button', { name: /final day/i }).click();
  await expect(page.locator('.season__title')).toBeVisible();
  await expect(page.locator('.season__table li')).toHaveCount(4);
  await expect(page.locator('.season__story li').first()).toBeVisible();
  const promoted = /promoted|champions/i.test(await page.locator('.season__title').innerText());
  await page.getByRole('button', { name: /start season 2/i }).click();
  await expect(page.locator('.club__league')).toContainText(/season 2/i);
  await expect(page.locator('.cabinet__item')).toHaveCount(promoted ? 1 : 0);
  await page.reload();
  await expect(page.locator('.club__league')).toContainText(/season 2/i);
  await page.goto('/#/league');
  await expect(page.locator('.league__history li')).toHaveCount(1);
});
