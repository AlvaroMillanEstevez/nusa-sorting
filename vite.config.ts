import { defineConfig } from 'vitest/config';

/** Poki's SDK, from Poki's own CDN (the one outside request Poki allows): only in the Poki build. */
const POKI_SDK = 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js';

// `--mode poki` (npm run build:poki, see .env.poki) builds for Poki into dist-poki, with its SDK in the page;
// every other mode is the game's own build, as before.
export default defineConfig(({ mode }) => ({
  // Relative base so the build works from any static host path.
  base: './',
  plugins: [
    {
      name: 'poki-sdk',
      transformIndexHtml: (html: string) => (mode === 'poki' ? html.replace('<head>', `<head>\n    <script src="${POKI_SDK}"></script>`) : html),
    },
  ],
  server: {
    // Listen on all interfaces so a phone on the same LAN can open the dev server.
    host: true,
    // Fixed port so it never collides with other Vite projects; fail instead of picking another.
    port: 5180,
    strictPort: true,
  },
  build: {
    // Phaser alone is ~1.3 MB minified and the 50 levels with their arrangements ~0.2 MB; the default 500 kB
    // warning is just noise (the whole build stays far below the portals' limits: see npm run package).
    chunkSizeWarningLimit: 2200,
    outDir: mode === 'poki' ? 'dist-poki' : 'dist',
  },
  preview: {
    host: true,
    port: 4173,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
