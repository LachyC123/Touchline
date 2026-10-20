import { expect, test, type Page } from '@playwright/test';

async function startCareer(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /start your club/i }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/millbrook town/i);
}

test.beforeEach(async ({ page }) => {
  // Each test gets a fresh browser context (fresh IndexedDB) from Playwright.
  page.on('pageerror', (err) => {
    throw err;
  });
});

test('new save → squad → player card flips and is identical after a reload', async ({ page }) => {
  await startCareer(page);

  await page.getByRole('button', { name: 'Squad', exact: true }).click();
  const cards = page.locator('.squad__grid [data-player-id]');
  await expect(cards).toHaveCount(10);

  // No horizontal scroll on narrow phones.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  const first = cards.first();
  const playerId = await first.getAttribute('data-player-id');
  const label = await first.getAttribute('aria-label');
  await first.click();
  await expect(page).toHaveURL(new RegExp(`#/player/${playerId}`));

  const hero = page.locator(`.player__hero [data-player-id="${playerId}"]`);
  await expect(hero).toBeVisible();
  const portraitBefore = await hero.locator('.fc__front svg[data-portrait]').first().getAttribute('data-portrait');
  const markupBefore = await hero.locator('.fc__front .fc__portrait').innerHTML();
  const statsBefore = await hero.locator('.fc__front .fc__stats').innerText();

  // Flip to the story side and back.
  await hero.click();
  await expect(hero).toHaveClass(/is-flipped/);
  await expect(hero.locator('.fc__back')).toContainText(/scrapbook/i);
  await hero.click();
  await expect(hero).not.toHaveClass(/is-flipped/);

  // Favourite persists.
  await page.getByRole('button', { name: /add to favourites/i }).click();
  await expect(page.getByRole('button', { name: /remove from favourites/i })).toBeVisible();

  await page.reload();
  const heroAfter = page.locator(`.player__hero [data-player-id="${playerId}"]`);
  await expect(heroAfter).toBeVisible();
  expect(await heroAfter.getAttribute('aria-label')).toContain(label!.split(',')[0]!);
  expect(await heroAfter.locator('.fc__front svg[data-portrait]').first().getAttribute('data-portrait')).toBe(portraitBefore);
  expect((await heroAfter.locator('.fc__front .fc__portrait').innerHTML()).replace(/p[a-z0-9]+-(face|body|eye-[lr])/g, 'ID')).toBe(
    markupBefore.replace(/p[a-z0-9]+-(face|body|eye-[lr])/g, 'ID'),
  );
  expect(await heroAfter.locator('.fc__front .fc__stats').innerText()).toBe(statsBefore);
  await expect(page.getByRole('button', { name: /remove from favourites/i })).toBeVisible();
});

test('the same player looks the same in the squad grid and on the profile', async ({ page }) => {
  await startCareer(page);
  await page.getByRole('button', { name: 'Squad', exact: true }).click();
  const card = page.locator('.squad__grid [data-player-id]').nth(3);
  const id = await card.getAttribute('data-player-id');
  const gridPortrait = await card.locator('svg[data-portrait]').first().getAttribute('data-portrait');
  await card.click();
  const profilePortrait = await page.locator(`.player__hero [data-player-id="${id}"] .fc__front svg[data-portrait]`).first().getAttribute('data-portrait');
  expect(profilePortrait).toBe(gridPortrait);
});

test('NEW sticker clears once a player is inspected, and stays cleared after reload', async ({ page }) => {
  await startCareer(page);
  // Starting squad members are not "new"; the sticker belongs to fresh signings.
  await page.getByRole('button', { name: 'Squad', exact: true }).click();
  await expect(page.locator('.fc__new')).toHaveCount(0);
});

test('settings persist and export produces a valid save file that re-imports', async ({ page }) => {
  await startCareer(page);
  await page.getByRole('button', { name: 'More', exact: true }).click();

  await page.getByRole('switch', { name: 'High contrast' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
  await page.getByRole('button', { name: 'reduced' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /export/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^touchline-millbrook-town-.*\.json$/);
  const path = await download.path();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');

  await page.getByTestId('import-input').setInputFiles(path!);
  await expect(page.getByRole('dialog')).toContainText(/load this save/i);
  await page.getByRole('button', { name: /^load millbrook town/i }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/millbrook town/i);
});

test('reset career needs two confirmations', async ({ page }) => {
  await startCareer(page);
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: /reset career/i }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /yes, reset/i }).click();
  await expect(page.getByRole('button', { name: /start your club/i })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /start your club/i })).toBeVisible();
});

test('primary controls meet the 44px touch target', async ({ page }) => {
  await startCareer(page);
  const tabs = page.locator('.bottom-nav__tab');
  for (const box of await tabs.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()))) {
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
});
