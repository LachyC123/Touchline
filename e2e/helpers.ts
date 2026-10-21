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
