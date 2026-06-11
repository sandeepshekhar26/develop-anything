// ============================================================
// auk — tests for cross-language import resolution
// (Go module paths + TS path aliases, not just relative imports)
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildResolverContext, resolveImport, resolveImportTargets } from '../../src/analyzer/import-graph.js';

function mapOf(...paths: string[]): Map<string, string> {
  return new Map(paths.map(p => [p, p]));
}

describe('import resolver', () => {
  it('resolves relative imports without a context', () => {
    const files = mapOf('src/a.ts', 'src/util/b.ts');
    assert.strictEqual(resolveImport('./util/b.js', 'src/a.ts', files), 'src/util/b.ts');
    assert.strictEqual(resolveImport('../a', 'src/util/b.ts', files), 'src/a.ts');
  });

  it('resolves Go module package imports rooted at go.mod', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auk-res-'));
    fs.mkdirSync(path.join(dir, 'backend'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'backend', 'go.mod'), 'module github.com/me/ncb\n\ngo 1.22\n');

    const files = [
      'backend/cmd/app/main.go',
      'backend/internal/services/stock.go',
      'backend/internal/services/order.go',
    ];
    const ctx = buildResolverContext(dir, files);
    const targets = resolveImportTargets(
      'github.com/me/ncb/internal/services',
      'backend/cmd/app/main.go',
      mapOf(...files),
      ctx,
    );
    // a Go package import maps to every file in the package directory
    assert.deepStrictEqual(targets.sort(), [
      'backend/internal/services/order.go',
      'backend/internal/services/stock.go',
    ]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('resolves TS path aliases from tsconfig paths', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auk-res-'));
    fs.mkdirSync(path.join(dir, 'frontend'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'frontend', 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./src/*'] } } }),
    );

    const files = ['frontend/src/app/page.tsx', 'frontend/src/components/Button.tsx'];
    const ctx = buildResolverContext(dir, files);
    const hit = resolveImport('@/components/Button', 'frontend/src/app/page.tsx', mapOf(...files), ctx);
    assert.strictEqual(hit, 'frontend/src/components/Button.tsx');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns nothing for true external packages', () => {
    const ctx = buildResolverContext('/tmp', ['src/a.ts']);
    assert.deepStrictEqual(resolveImportTargets('react', 'src/a.ts', mapOf('src/a.ts'), ctx), []);
    assert.deepStrictEqual(resolveImportTargets('github.com/gin-gonic/gin', 'backend/x.go', mapOf('backend/x.go'), ctx), []);
  });
});
