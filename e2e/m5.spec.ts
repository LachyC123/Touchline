import { expect, test, type Page } from '@playwright/test';
import { startCareerSkippingTutorial } from './helpers';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

/** Edits the stored save directly (test setup only), then reloads so the app reads it. */
async function patchSave(page: Page, body: string): Promise<void> {
  await page.evaluate(
    (src) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('touchline');
        req.onsuccess = () => {
          const tx = req.result.transaction('saves', 'readwrite');
          const store = tx.objectStore('saves');
          const get = store.get('main');
          get.onsuccess = () => {
            const row = get.result;
            new Function('s', src)(row.save);
            store.put(row);
          };
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    body,
  );
  await page.reload();
}

test('an injured starter: the lobby says who and why, one tap covers it, the physio call sticks', async ({ page }) => {
  await startCareerSkippingTutorial(page);
  await patchSave(
    page,
    `const id = s.lineup.MID_L; s.coins = 500;
     s.injuries = [{ id: '00000000-0000-4000-8000-0000000000cc', playerId: id, kind: 'ankle', matchId: 'm0', atMatch: 0, minute: 23, byName: 'A Hard Man', outFor: 2, untilMatch: 2, treatment: null }];`,
  );
  await page.goto('/#/match');
  await expect(page.locator('.lineup__problem')).toContainText(/is injured \(twisted ankle, out 2 more matches\)/);
  await expect(page.getByRole('button', { name: /play match/i })).toBeDisabled();
  await page.getByRole('button', { name: 'Pick a replacement' }).click();
  await expect(page.locator('.lineup__problem')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /play match/i })).toBeEnabled();
  // The lineup shows him injured, and his profile carries the physio's report.
  await page.goto('/#/lineup');
  await expect(page.locator('.pitchboard__tag.is-injured').first()).toBeVisible();
  await page.goto('/#/squad');
  await expect(page.locator('.squad__injury')).toHaveText(/2/);
  const injuredId = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const req = indexedDB.open('touchline');
        req.onsuccess = () => {
          const get = req.result.transaction('saves').objectStore('saves').get('main');
          get.onsuccess = () => {
            resolve(get.result.save.injuries[0].playerId);
            req.result.close();
          };
        };
      }),
  );
  await page.goto(`/#/player/${injuredId}`);
  const physio = page.locator('.physio');
  await expect(physio).toContainText(/23' after a challenge from A Hard Man/);
  await physio.getByRole('button', { name: /see a specialist/i }).click();
  await expect(physio.getByRole('group')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.physio')).toContainText(/seen by the specialist/i);
  await expect(page.locator('.physio').getByRole('group')).toHaveCount(0);
});

test('two careers, two worlds: different home towns, clubs and opponents', async ({ browser }) => {
  const seen: string[] = [];
  for (let i = 0; i < 2; i++) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await startCareerSkippingTutorial(page);
    const town = (await page.locator('.ground__town b').innerText()).trim();
    await page.goto('/#/match');
    const opp = (await page.locator('.fixture__name').innerText()).trim();
    await expect(page.locator('.fixture__quirk')).toBeVisible();
    seen.push(`${town}|${opp}`);
    await ctx.close();
  }
  expect(seen[0]).not.toBe(seen[1]);
});
