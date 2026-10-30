/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Resolve @m3/shared to its TypeScript source so Vite/Rollup can statically
// read its named exports (the compiled CJS dist uses __exportStar, which the
// bundler cannot analyse).
const sharedSrc = fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@m3/shared': sharedSrc },
  },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 5173 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
