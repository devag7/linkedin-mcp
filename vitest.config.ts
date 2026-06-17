import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
    // Some legacy suites use per-test `await import(...)`; the FIRST one pays the
    // cold esbuild-transform cost (can exceed 30s on a heavily loaded machine /
    // slow CI runner) and would otherwise flake-timeout. Generous ceiling so cold
    // imports never trip it; logic is unaffected.
    testTimeout: 60000,
  },
});
