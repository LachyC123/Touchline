// Rasterises public/icons/icon.svg into the PNG sizes the PWA manifest and iOS need.
// Uses the Playwright Chromium already installed for E2E tests.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const svg = readFileSync(`${root}public/icons/icon.svg`, 'utf8');
const targets = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0 },
  { file: 'icon-maskable-512.png', size: 512, pad: 56 },
];

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size } });
  const inner = t.size - t.pad * 2;
  await page.setContent(
    `<html><body style="margin:0;background:#0B1526"><div style="padding:${t.pad}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
  );
  await page.screenshot({ path: `${root}public/icons/${t.file}`, omitBackground: false });
  await page.close();
  console.log('wrote', t.file);
}
await browser.close();
