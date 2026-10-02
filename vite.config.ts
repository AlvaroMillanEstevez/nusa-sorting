import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works from any static host path.
  base: './',
  server: {
    // Listen on all interfaces so a phone on the same LAN can open the dev server.
    host: true,
    port: 5173,
  },
  build: {
    // Phaser alone is ~1.3 MB minified; the default 500 kB warning is just noise.
    chunkSizeWarningLimit: 1600,
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
