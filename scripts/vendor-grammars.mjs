// ============================================================
// auk — vendor tree-sitter grammar wasm files into assets/wasm
// Dev-time script: grammar packages are devDependencies; their
// prebuilt .wasm binaries are committed under assets/wasm so the
// published package never compiles or downloads anything.
// Run: node scripts/vendor-grammars.mjs
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'assets', 'wasm');

const grammars = [
  ['tree-sitter-typescript', 'tree-sitter-typescript.wasm'],
  ['tree-sitter-typescript', 'tree-sitter-tsx.wasm'],
  ['tree-sitter-javascript', 'tree-sitter-javascript.wasm'],
  ['tree-sitter-python', 'tree-sitter-python.wasm'],
  ['tree-sitter-go', 'tree-sitter-go.wasm'],
  ['tree-sitter-java', 'tree-sitter-java.wasm'],
  ['tree-sitter-rust', 'tree-sitter-rust.wasm'],
];

fs.mkdirSync(outDir, { recursive: true });

for (const [pkg, file] of grammars) {
  const src = path.join(root, 'node_modules', pkg, file);
  if (!fs.existsSync(src)) {
    console.error(`missing: ${src} — run npm install first`);
    process.exitCode = 1;
    continue;
  }
  fs.copyFileSync(src, path.join(outDir, file));
  console.log(`vendored ${file} (${(fs.statSync(src).size / 1024 / 1024).toFixed(1)} MB)`);
}
