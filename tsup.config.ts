import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  // dts disabled: the bundled CLI entry exposes no public types, and rolling up
  // .d.ts for the full graph (incl. patchright) took ~10 min. Not worth it.
  dts: false,
  clean: true,
  sourcemap: true,
  target: 'node20',
  outDir: 'dist',
  splitting: false,
  shims: false,
});
