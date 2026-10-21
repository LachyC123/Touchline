import { expect, type Page } from '@playwright/test';

/** New career, skipping the guided first run (the free pack stays unopened in the Scout room). */
export async function startCareerSkippingTutorial(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /start your club/i }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByRole('button', { name: /meet your first signing/i }).click();
  await page.getByRole('button', { name: /skip tutorial/i }).click();
  await expect(page.locator('.club__hud')).toBeVisible();
}

/** Bottom-nav tab by label; the label may carry a "(n new)" badge count. */
export function tab(page: Page, label: string) {
  return page.getByRole('button', { name: new RegExp(`^${label}( \\(\\d+ new\\))?$`) });
}

/** Big matches open with a walk-out held at minute 0; tap through it if it is showing. */
export async function kickOffIfWalkOut(page: Page): Promise<void> {
  const go = page.getByRole('button', { name: /^kick off$/i });
  if (await go.isVisible().catch(() => false)) await go.click();
}

/** Plays the next match from the lobby, first swapping in fit players for any injured starter. */
export async function clickPlayMatch(page: Page): Promise<void> {
  const cover = page.getByRole('button', { name: /^pick (a )?replacements?$/i });
  if (await cover.isVisible().catch(() => false)) {
    await cover.click();
    await expect(cover).toHaveCount(0);
  }
  await page.getByRole('button', { name: /play match/i }).click();
}
