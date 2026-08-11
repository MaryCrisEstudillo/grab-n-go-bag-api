import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only pure logic is unit-tested, so no DOM environment is needed.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
});
