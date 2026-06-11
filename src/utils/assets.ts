// ============================================================
// auk — AI Context Engineering Platform
// Asset resolution — locates bundled files (wasm grammars, etc.)
// relative to the module, never the working directory, so that
// `npx auk-develop` works from any project.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Candidate roots: dist build (dist/index.js → dist/wasm) and dev tree (src/utils → assets/wasm) */
const candidates = [
  path.join(here, 'wasm'),                     // dist/index.js → dist/wasm
  path.join(here, '..', 'wasm'),               // dist/sub → dist/wasm (safety)
  path.join(here, '..', '..', 'assets', 'wasm'), // src/utils → assets/wasm (dev)
];

export class AssetMissingError extends Error {
  constructor(name: string) {
    super(`Bundled asset not found: ${name}`);
    this.name = 'AssetMissingError';
  }
}

/** Resolve a bundled asset by filename. Throws AssetMissingError if absent. */
export function resolveAsset(name: string): string {
  for (const dir of candidates) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  throw new AssetMissingError(name);
}
