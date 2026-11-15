import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'apps/api/src/**/*.test.ts', 'apps/web/src/**/*.test.{ts,tsx}'],
    setupFiles: ['./apps/web/src/test/setup.ts'],
    testTimeout: 15000,
  },
});
