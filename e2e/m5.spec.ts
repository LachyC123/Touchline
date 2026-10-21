import { expect, test, type Page } from '@playwright/test';
import { clickPlayMatch, kickOffIfWalkOut, startCareerSkippingTutorial } from './helpers';

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

async function readSave<T>(page: Page, pick: string): Promise<T> {
  return page.evaluate(
    (src) =>
      new Promise<T>((resolve) => {
        const req = indexedDB.open('touchline');
        req.onsuccess = () => {
          const get = req.result.transaction('saves').objectStore('saves').get('main');
          get.onsuccess = () => {
            resolve(new Function('s', `return ${src}`)(get.result.save) as T);
            req.result.close();
          };
        };
      }),
    pick,
  );
}

test('transfers: sign a player with a moment, haggle once, sell to a bid; all of it survives a reload', async ({ page }) => {
  await startCareerSkippingTutorial(page);
  await patchSave(page, 's.coins = 5000; s.club.reputation = 200;');
  await page.goto('/#/scout');
  await page.getByRole('button', { name: /transfer market/i }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/transfer market/i);
  const before = await readSave<number>(page, 's.squadIds.length');
  // Haggle over the second player: the button goes, the outcome stays after a reload.
  const second = page.locator('.listing').nth(1);
  const secondName = (await second.locator('.listing__name b').innerText()).trim();
  await second.getByRole('button', { name: /^haggle \d+%$/i }).click();
  await expect(second.getByRole('button', { name: /^haggle/i })).toHaveCount(0);
  await expect(second.locator('.listing__price small')).toContainText(/haggled down|after the haggle/);
  await page.reload();
  await expect(page.locator('.listing', { hasText: secondName }).getByRole('button', { name: /^haggle/i })).toHaveCount(0);
  // Sign the first one.
  const first = page.locator('.listing').first();
  const name = (await first.locator('.listing__name b').innerText()).trim();
  await first.getByRole('button', { name: 'Sign' }).click();
  await expect(page.getByRole('dialog')).toContainText(/signed!/i);
  await page.getByRole('button', { name: 'Meet him' }).click();
  await expect(page.locator('.player__title')).toContainText(new RegExp(name, 'i'));
  await page.reload();
  expect(await readSave<number>(page, 's.squadIds.length')).toBe(before + 1);
  await expect(page.locator('.player__title')).toContainText(new RegExp(name, 'i'));

  // Selling: list a bench player from his profile, then a club bids.
  const benchId = await readSave<string>(page, 's.squadIds.find((id) => !Object.values(s.lineup).includes(id) && s.footballers[id].primaryPosition !== "GK")');
  await page.goto(`/#/player/${benchId}`);
  await page.getByRole('button', { name: 'Transfer-list him' }).click();
  await expect(page.getByRole('button', { name: 'Take him off the list' })).toBeVisible();
  const clubId = await readSave<string>(page, 's.world.divisions[0].clubIds[0]');
  await patchSave(
    page,
    `s.transfers.offers = [{ id: '00000000-0000-4000-8000-0000000000dd', playerId: '${benchId}', clubId: '${clubId}', fee: 175, atMatch: 0, expiresAfter: 2, unsolicited: false, status: 'open' }];`,
  );
  const coins = await readSave<number>(page, 's.coins');
  await page.goto('/#/market');
  await expect(page.getByRole('tab', { name: /sell \(1\)/i })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Accept 175' }).click();
  await expect(page.locator('.market__log')).toContainText(/out/i);
  await page.reload();
  expect(await readSave<number>(page, 's.coins')).toBe(coins + 175);
  expect(await readSave<boolean>(page, `s.squadIds.includes('${benchId}')`)).toBe(false);
  await page.goto(`/#/player/${benchId}`);
  await expect(page.locator('.player__left')).toContainText(/left for .* for 175 coins/i);
});

test('arcade layer: objectives before kick-off and stars at full time; the Reputation Road opens once', async ({ page }) => {
  test.setTimeout(120_000);
  await startCareerSkippingTutorial(page);
  await page.goto('/#/match');
  const card = page.getByRole('region', { name: "Today's objectives" });
  await expect(card.locator('li')).toHaveCount(3);
  await clickPlayMatch(page);
  await expect(page.locator('.live__pitch canvas')).toBeVisible({ timeout: 20_000 });
  await kickOffIfWalkOut(page);
  await page.getByRole('button', { name: /skip to ft/i }).click();
  await page.getByRole('button', { name: /simulate the rest/i }).click();
  await expect(page.locator('.result__hero')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('region', { name: 'Objectives' }).locator('li')).toHaveCount(3);
  await expect(page.locator('.result__lines')).toContainText(/Objectives [★☆]{3}/);

  await patchSave(page, 's.club.reputation = 12;');
  await page.goto('/#/club');
  await expect(page.locator('.ground__road')).toContainText(/2 rewards to open/);
  await page.locator('.ground__road').click();
  const coins = await readSave<number>(page, 's.coins');
  await page.locator('.road__step.is-ready', { hasText: '100 coins' }).getByRole('button', { name: 'Open' }).click();
  // A chest wobbles open and shows the reward.
  await expect(page.locator('.chest__title')).toHaveText('+100 coins');
  await page.getByRole('button', { name: 'Nice!' }).click();
  await expect(page.locator('.road__burst')).toContainText('+100 coins');
  await page.locator('.road__step.is-ready', { hasText: 'Local Scout pack' }).getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('.chest__title')).toHaveText(/Local Scout pack!/);
  await expect(page.getByRole('button', { name: 'Open the pack' })).toBeVisible();
  await page.getByRole('button', { name: 'Later' }).click();
  await page.reload();
  await expect(page.locator('.road__step.is-ready')).toHaveCount(0);
  expect(await readSave<number>(page, 's.coins')).toBe(coins + 100);
});
