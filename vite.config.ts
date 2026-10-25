import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build can be hosted from any path or wrapped as a native app later.
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
