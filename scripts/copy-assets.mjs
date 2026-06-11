// ============================================================
// auk — copy bundled assets into dist after tsup build
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'assets', 'wasm');
const outDir = path.join(root, 'dist', 'wasm');

fs.mkdirSync(outDir, { recursive: true });
for (const file of fs.readdirSync(srcDir)) {
  if (file.endsWith('.wasm')) fs.copyFileSync(path.join(srcDir, file), path.join(outDir, file));
}
console.log(`copied ${fs.readdirSync(outDir).length} wasm assets to dist/wasm`);
