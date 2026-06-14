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
    // cold esbuild-transform cost (10–16s on a loaded machine) and tripped the
    // old 10s ceiling. Raised so cold imports don't flake. Logic is unaffected.
    testTimeout: 30000,
  },
});
