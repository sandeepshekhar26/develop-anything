import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/lib.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: true,
  splitting: false,
  // web-tree-sitter stays external so it resolves its own runtime wasm
  // from node_modules; grammar wasms are copied to dist/wasm below.
  external: ['web-tree-sitter'],
  banner: {
    js: '#!/usr/bin/env node',
  },
  onSuccess: 'node scripts/copy-assets.mjs',
});
