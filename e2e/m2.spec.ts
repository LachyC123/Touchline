import { expect, test } from '@playwright/test';
import { startCareerSkippingTutorial, tab } from './helpers';

test.describe.configure({ timeout: 150_000 });

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

test('cold install → story → first pack → lineup → guided match → upgrade → club identity → hub → refresh', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /start your club/i }).click();

  // Opening story: tap through all four panels (it also advances on its own).
  const stage = page.locator('.intro__stage');
  for (let i = 0; i < 3; i++) {
    if (await page.getByRole('button', { name: /meet your first signing/i }).isVisible()) break;
    await stage.click();
  }
  // A reload mid-story comes back to the story, not past it.
  await page.reload();
  await expect(page.locator('.intro')).toBeVisible();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByRole('button', { name: /meet your first signing/i }).click();

  // Sealed pack: the rarity edge is visible before opening and survives a reload.
  await expect(page.locator('.pack__envelope')).toBeVisible();
  const edge = (await page.locator('.pack__edge').textContent()) ?? '';
  await page.reload();
  await expect(page.locator('.pack__edge')).toHaveText(edge);

  // One-tap open (the swipe is optional); skip the reveal.
  await page.getByRole('button', { name: /open pack/i }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click({ timeout: 5000 }).catch(() => undefined);
  await expect(page.locator('.reveal__stamp')).toContainText(/welcome to the club/i);
  const signing = ((await page.locator('.reveal__name').textContent()) ?? '').trim();
  const lastName = signing.split(/\s+/).at(-1)!;

  // Reloading the reveal shows the same signing; nothing is granted twice.
  await page.reload();
  await expect(page.locator('.reveal__name')).toHaveText(signing);

  await page.getByRole('button', { name: /in the team/i }).click();
  await expect(page.locator('.lineup__coach')).toBeVisible();
  await page.getByRole('button', { name: /put him there/i }).click();
  await expect(page.locator('.pitchboard__name', { hasText: new RegExp(lastName, 'i') })).toBeVisible();
  await page.getByRole('button', { name: /to the match/i }).click();

  await page.getByRole('button', { name: /play match/i }).click();
  await expect(page.locator('.live__pitch canvas')).toBeVisible({ timeout: 20_000 });
  await page.locator('.live__speed').click();
  // The guided tactic prompt appears once we have the ball (or is dismissible); tapping the chip uses it.
  const coach = page.locator('.live__coach');
  await expect(coach).toBeVisible({ timeout: 90_000 });
  const target = page.locator('.mcard.coach-target');
  const name = ((await target.locator('.mc__name').textContent()) ?? '').trim();
  await target.click();
  await expect(coach).toHaveCount(0);
  await expect(page.locator('.tray__active')).toContainText(new RegExp(name, 'i'));

  await page.getByRole('button', { name: /skip to ft/i }).click();
  await page.getByRole('button', { name: /simulate the rest/i }).click();
  await expect(page.locator('.result__hero')).toBeVisible({ timeout: 20_000 });

  // The new signing's debut always earns a training choice.
  await expect(page.locator('.result__lines')).toContainText(/debut/i);
  const picker = page.locator('.upgrade', { hasText: new RegExp(lastName, 'i') });
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: /^train /i }).first().click();
  await expect(picker).toContainText(/locked in/i);

  await page.getByRole('button', { name: /make it yours/i }).click();
  await page.locator('.setup__input').fill('x');
  await page.getByRole('button', { name: /that.s us/i }).click();
  await expect(page.getByRole('alert')).toContainText(/at least/i);
  await page.locator('.setup__input').fill('Harbour Lights');
  await page.locator('.setup__swatch').nth(1).click();
  await page.getByRole('button', { name: 'Hoops' }).click();
  await page.getByRole('button', { name: /that.s us/i }).click();

  await expect(page.locator('.club__hud h1')).toHaveText('Harbour Lights');
  await expect(page.locator('.club__next')).toHaveClass(/coach-target/);

  await page.reload();
  await expect(page.locator('.club__hud h1')).toHaveText('Harbour Lights');
  await expect(page.locator('.intro')).toHaveCount(0);
  await tab(page, 'Squad').click();
  await expect(page.locator('.squad__grid [data-player-id]')).toHaveCount(11);
  await tab(page, 'Scout').click();
  await expect(page.getByText(/no packs waiting/i)).toBeVisible();
  await expect(page.locator('.scout__recent [data-player-id]')).toHaveCount(1);
});

test('skipping the tutorial keeps the free pack; opening it later works once, with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startCareerSkippingTutorial(page);
  await expect(page.locator('.club__packs')).toBeVisible();
  await expect(tab(page, 'Scout')).toHaveAccessibleName(/1 new/);
  await tab(page, 'Scout').click();
  await page.locator('.scout__pack').first().click();
  await page.getByRole('button', { name: /open pack/i }).click();
  await expect(page.locator('.reveal__name')).toBeVisible({ timeout: 5000 });
  const name = await page.locator('.reveal__name').innerText();
  await page.getByRole('button', { name: /view player/i }).click();
  await expect(page.locator('.player__hero')).toBeVisible();
  await tab(page, 'Scout').click();
  await expect(page.getByText(/no packs waiting/i)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/no packs waiting/i)).toBeVisible();
  await tab(page, 'Squad').click();
  await expect(page.locator('.squad__grid [data-player-id]')).toHaveCount(11);
  expect(name.length).toBeGreaterThan(3);
});

test('tutorial can be replayed from More without re-granting rewards', async ({ page }) => {
  await startCareerSkippingTutorial(page);
  await tab(page, 'More').click();
  await page.getByRole('button', { name: /^replay$/i }).click();
  await expect(page.locator('.intro')).toBeVisible();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByRole('button', { name: /back to the club/i }).click();
  await expect(page.locator('.club__hud')).toBeVisible();
  await tab(page, 'Scout').click();
  await expect(page.locator('.scout__pack')).toHaveCount(1);
});

test('manager cards: deck screen edits persist, locked cards explain themselves, deck reaches the match', async ({ page }) => {
  await startCareerSkippingTutorial(page);
  await page.goto('/#/match');
  await page.getByRole('button', { name: /^deck/i }).click();
  await expect(page.locator('.deck__slots .mc')).toHaveCount(4);
  // Locked card: tells you the level, changes nothing.
  await page.getByRole('button', { name: /^man-mark/i }).click();
  await expect(page.locator('.toasts')).toContainText(/manager level 5/i);
  // Take Go Wide out (tap it in the deck), reload: still out.
  await page.locator('.deck__slots').getByRole('button', { name: /^go wide/i }).click();
  await expect(page.locator('.deck__slots .mc')).toHaveCount(3);
  await page.reload();
  await expect(page.locator('.deck__slots .mc')).toHaveCount(3);
  // Can't go below three.
  await page.locator('.deck__slots').getByRole('button', { name: /^press/i }).click();
  await expect(page.locator('.deck__slots .mc')).toHaveCount(3);
  // The match hand is the deck's first three.
  await page.goto('/#/match');
  await page.getByRole('button', { name: /play match/i }).click();
  await expect(page.locator('.tray__hand .mc__name')).toHaveText([/quick pass/i, /press/i, /park the bus/i]);
});
