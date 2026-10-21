import { expect, test, type Page } from '@playwright/test';
import { kickOffIfWalkOut, startCareerSkippingTutorial, clickPlayMatch } from './helpers';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

async function playAndSkip(page: Page) {
  await page.goto('/#/match');
  await clickPlayMatch(page);
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
  // Two games in: the dressing room wants something (with no captain yet, it's the armband).
  await expect(page.locator('.result__room-news.is-open')).toBeVisible();
  await page.goto('/#/club');
  const request = page.locator('.room__request');
  await expect(request).toBeVisible();
  // The badge counts the request (and any Reputation Road reward the wins have unlocked).
  await expect(page.getByRole('button', { name: /^Club \([12] new\)$/ })).toBeVisible();
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

test('captain and penalty taker: chosen from the lineup by tapping, shown on cards, kept after reload', async ({ page }) => {
  await startCareerSkippingTutorial(page);
  await page.goto('/#/lineup');
  const captain = page.getByRole('radiogroup', { name: 'Captain' }).getByRole('radio').nth(2);
  const name = (await captain.innerText()).trim();
  await captain.click();
  await expect(captain).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.pitchboard__roles .role-badge.is-captain')).toHaveCount(1);
  const pens = page.getByRole('radiogroup', { name: 'Penalty taker' }).getByRole('radio').nth(1);
  await pens.click();
  await expect(pens).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(page.getByRole('radiogroup', { name: 'Captain' }).getByRole('radio', { name: new RegExp(name, 'i') })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.pitchboard__roles .role-badge.is-pens')).toHaveCount(1);
  await page.goto('/#/squad');
  await expect(page.locator('.squad__mood .role-badge.is-captain')).toHaveCount(1);
});

test('reputation and the ground: hub panel explains what an upgrade needs, scout odds follow reputation', async ({ page }) => {
  test.setTimeout(120_000);
  await startCareerSkippingTutorial(page);
  await page.goto('/#/club');
  const panel = page.getByRole('region', { name: 'Reputation and ground' });
  await expect(panel).toBeVisible();
  await expect(panel.locator('.ground__tier')).toHaveText('Local');
  await expect(panel.getByRole('meter', { name: 'Reputation' })).toBeVisible();
  // A new club can't afford the next level yet: the button says so instead of pretending.
  const upgrade = panel.getByRole('button', { name: /A lick of paint: 600 coins/ });
  await expect(upgrade).toBeDisabled();
  await expect(panel).toContainText(/Needs Rising reputation \(15\)/);
  await page.goto('/#/scout');
  await expect(page.locator('.scout__rep')).toContainText('Local');
  await playAndSkip(page);
  // Rewards tell you who came and what the club's name is worth now (only home games have a gate).
  const lines = await page.locator('.result__lines').innerText();
  if (/Gate receipts/.test(lines)) await expect(page.locator('.result__rep')).toContainText(/at /);
});
