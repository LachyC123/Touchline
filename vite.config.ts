/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// ARTIFACT=1 builds a variant for the claude.ai Artifact viewer: relative paths, no service
// worker (the viewer has none), and fonts inlined because the frame only loads fonts it embeds.
const artifact = process.env.ARTIFACT === '1';

export default defineConfig({
  base: artifact ? './' : '/',
  define: artifact ? { 'import.meta.env.VITE_ARTIFACT': JSON.stringify('1') } : {},
  build: artifact ? { outDir: 'dist-artifact', assetsInlineLimit: 200_000, chunkSizeWarningLimit: 2000 } : {},
  plugins: [
    react(),
    VitePWA({
      disable: artifact,
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'TOUCHLINE! — The club is yours',
        short_name: 'TOUCHLINE!',
        description: 'Build a club full of footballers you remember, then watch them become heroes.',
        theme_color: '#101C32',
        background_color: '#101C32',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 60_000,
  },
});
