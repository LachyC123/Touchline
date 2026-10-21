import { expect, test, type Page } from '@playwright/test';
import { kickOffIfWalkOut, startCareerSkippingTutorial } from './helpers';

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

test('dressing room: morale moves after a match, a player knocks, the answer sticks', async ({ page }) => {
  test.setTimeout(150_000);
  await startCareerSkippingTutorial(page);
  // Mood shows in the lineup and on the profile from the start.
  await page.goto('/#/lineup');
  await expect(page.locator('.pitchboard__mood').first()).toBeVisible();
  await playAndSkip(page);
  // Who is happier and who is sulking, and why.
  await expect(page.locator('.result__room-list li').first()).toBeVisible();
  await expect(page.locator('.result__room-list')).toContainText(/started|unused/);
  await playAndSkip(page);
  await playAndSkip(page);
  // Three games in: someone wants a word (an unused player, or the whole squad after three defeats).
  await expect(page.locator('.result__room-news.is-open')).toBeVisible();
  await page.goto('/#/club');
  const request = page.locator('.room__request');
  await expect(request).toBeVisible();
  await expect(page.getByRole('button', { name: /^Club \(1 new\)$/ })).toBeVisible();
  await request.click();
  await expect(page.locator('.dressing__quote')).toBeVisible();
  const choices = page.locator('.dressing__choice:not([disabled])');
  expect(await choices.count()).toBeGreaterThanOrEqual(2);
  const picked = (await choices.last().locator('b').innerText()).trim();
  await choices.last().click();
  const outcome = page.locator('.dressing__outcome-text');
  await expect(outcome).not.toBeEmpty();
  const said = await outcome.innerText();
  expect(picked.length).toBeGreaterThan(0);
  await page.reload();
  await expect(page.locator('.dressing__outcome-text')).toHaveText(said);
  await expect(page.locator('.dressing__choice')).toHaveCount(0);
  await page.goto('/#/club');
  await expect(page.locator('.room__request')).toHaveCount(0);
  await expect(page.locator('.room__news')).toContainText(said.slice(0, 20));
});
