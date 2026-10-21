import { expect, test, type BrowserContext } from '@playwright/test';
import { startCareerSkippingTutorial } from './helpers';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

async function clubName(page: import('@playwright/test').Page): Promise<string> {
  const h = page.getByRole('heading', { level: 1 });
  await expect(h).not.toBeEmpty();
  return ((await h.textContent()) ?? '').trim();
}

test('a browser that blocks IndexedDB still keeps the club across a reload (backup copy)', async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
  });
  const page = await ctx.newPage();
  await startCareerSkippingTutorial(page);
  const name = await clubName(page);
  await page.goto('/#/more');
  await expect(page.locator('.more__copies')).toContainText(/backup copy on this page/i);
  await page.reload();
  await page.goto('/#/club');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  await expect(page.locator('.memory-banner')).toContainText(/backup copy/i);
  await ctx.close();
});

/** A stand-in for claude.ai's per-viewer storage, shared between "devices" (contexts). */
async function withFakeClaude(ctx: BrowserContext, store: Map<string, unknown>): Promise<void> {
  await ctx.exposeBinding('__cloudGet', (_src, path: string) => store.get(path) ?? null);
  await ctx.exposeBinding('__cloudSet', (_src, path: string, data: unknown) => {
    store.set(path, data);
  });
  await ctx.addInitScript(() => {
    const w = window as unknown as { __cloudGet(p: string): Promise<unknown>; __cloudSet(p: string, d: unknown): Promise<void>; claude: unknown };
    const db = {
      doc: (path: string) => ({
        get: async () => {
          const v = await w.__cloudGet(path);
          return { exists: v !== null, data: () => (v === null ? undefined : v) };
        },
        set: (d: unknown) => w.__cloudSet(path, d),
      }),
    };
    w.claude = { use: async (name: string) => (name === 'db' ? db : name === 'user' ? { id: async () => 'viewer-1' } : null) };
  });
}

test('inside claude.ai the club is backed up to the account and comes back on a fresh device', async ({ browser }) => {
  const store = new Map<string, unknown>();
  const phone = await browser.newContext();
  await withFakeClaude(phone, store);
  const p1 = await phone.newPage();
  await startCareerSkippingTutorial(p1);
  const name = await clubName(p1);
  await p1.goto('/#/more');
  await expect(p1.locator('.more__copies li').nth(2)).toHaveClass(/is-on/, { timeout: 15_000 });
  expect(store.has('data/users/viewer-1/touchline')).toBe(true);
  await phone.close();

  // A different device: empty browser storage, same account.
  const tablet = await browser.newContext();
  await withFakeClaude(tablet, store);
  const p2 = await tablet.newPage();
  await p2.goto('/#/club');
  await expect(p2.getByRole('heading', { level: 1 })).toHaveText(name, { timeout: 15_000 });
  await tablet.close();
});
