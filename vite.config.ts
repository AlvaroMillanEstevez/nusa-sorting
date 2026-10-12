import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works from any static host path.
  base: './',
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
  },
  preview: {
    host: true,
    port: 4173,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
