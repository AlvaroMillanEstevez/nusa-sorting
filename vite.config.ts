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
    // Phaser alone is ~1.3 MB minified and the levels with their arrangements ~0.1 MB; the default 500 kB
    // warning is just noise.
    chunkSizeWarningLimit: 1800,
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
