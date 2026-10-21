import { expect, test, type Page } from '@playwright/test';
import { startCareerSkippingTutorial, kickOffIfWalkOut } from './helpers';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

async function playAndSkip(page: Page) {
  await page.goto('/#/match');
  await page.getByRole('button', { name: /play match/i }).click();
  await expect(page.locator('.live__pitch canvas')).toBeVisible({ timeout: 20_000 });
  await kickOffIfWalkOut(page);
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
  // 14 league rounds plus however many County Cup ties we survive.
  for (let match = 0; match < 18; match++) {
    await playAndSkip(page);
    if (await page.getByRole('button', { name: /final day/i }).count()) break;
  }
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

test('cup: after three league rounds the County Cup tie comes first, then shows in the bracket', async ({ page }) => {
  test.setTimeout(180_000);
  await startCareerSkippingTutorial(page);
  for (let round = 0; round < 3; round++) await playAndSkip(page);
  await page.goto('/#/club');
  await expect(page.locator('.club__next')).toContainText(/county cup · first round/i);
  await page.goto('/#/match');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/county cup · first round/i);
  await expect(page.locator('.fixture--cup')).toBeVisible();
  await expect(page.locator('.lobby__buildup .storyline').first()).toBeVisible();
  // A cup tie opens with a walk-out, held at minute 0 until kick-off.
  await page.getByRole('button', { name: /play match/i }).click();
  await expect(page.locator('.walkout')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.walkout__title')).toContainText(/county cup/i);
  await expect(page.locator('.walkout__seven li')).toHaveCount(7);
  await expect(page.locator('.scoreboard__clock')).toHaveText("0'");
  await page.getByRole('button', { name: /^kick off$/i }).click();
  await expect(page.locator('.walkout')).toHaveCount(0);
  await expect.poll(async () => Number((await page.locator('.scoreboard__clock').innerText()).replace(/\D/g, '')), { timeout: 20_000 }).toBeGreaterThan(0);
  await page.getByRole('button', { name: /skip to ft/i }).click();
  await page.getByRole('button', { name: /simulate the rest/i }).click();
  await expect(page.locator('.result__hero')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.result__comp')).toContainText(/county cup · first round/i);
  // Through or out, the banner says which; a level tie was settled on penalties.
  await expect(page.locator('.result__sealed')).toContainText(/into the quarter-final|out of the cup/i);
  const verdict = await page.locator('.result__ft').innerText();
  if (/penalties/i.test(verdict)) await expect(page.locator('.shootout')).toBeVisible();
  await expect(page.locator('.result__league')).toHaveCount(0);
  await page.reload();
  await page.goto('/#/league');
  await page.getByRole('tab', { name: 'Cup' }).click();
  const first = page.locator('.league__cup .league__round').first();
  await expect(first.locator('li')).toHaveCount(8);
  const scores = await first.locator('.lf__score').allInnerTexts();
  expect(scores.every((x) => /\d–\d/.test(x))).toBe(true);
  await expect(page.locator('.league__cup .league__round').nth(1).locator('li')).toHaveCount(4);
  // Back to the league: round 4 is next.
  await page.goto('/#/match');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/round 4 of 14/i);
});
