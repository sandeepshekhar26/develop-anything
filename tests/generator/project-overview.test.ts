// ============================================================
// auk — tests for the project overview generator
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildProjectOverview } from '../../src/generator/project-overview.js';
import type { AnalysisResult, ParsedFile, FileEntry } from '../../src/types/analysis.js';

function entry(p: string, language: FileEntry['language']): FileEntry {
  return { path: p, absolutePath: '/' + p, language, size: 10, hash: 'h' };
}
function pf(p: string, language: FileEntry['language'], symbols: ParsedFile['symbols'] = [], imports: string[] = []): ParsedFile {
  return {
    entry: entry(p, language),
    imports: imports.map(s => ({ source: s, symbols: [], isDefault: false, isNamespace: false, line: 1 })),
    exports: [],
    symbols,
    comments: [],
  };
}

function analysisOf(files: ParsedFile[]): AnalysisResult {
  const langBreakdown: Record<string, number> = {};
  for (const f of files) langBreakdown[f.entry.language] = (langBreakdown[f.entry.language] ?? 0) + 1;
  return {
    scannedFiles: files.map(f => f.entry),
    parsedFiles: files,
    graph: { version: 2, generatedAt: '', nodes: [], edges: [], layers: {} as any, boundaries: [] },
    patterns: [],
    layers: [],
    stats: { totalFiles: files.length, totalSymbols: 0, totalImports: 0, languageBreakdown: langBreakdown, layerBreakdown: {} },
  };
}

describe('project overview generator', () => {
  it('detects a Wails + Go + Next.js monorepo', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auk-ov-'));
    fs.writeFileSync(path.join(dir, 'wails.json'), JSON.stringify({ version: 2, name: 'app' }));
    fs.writeFileSync(path.join(dir, 'go.mod'), 'module github.com/me/app\n\ngo 1.22\n');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      name: 'app', main: 'dist/index.js',
      scripts: { dev: 'next dev', build: 'next build', test: 'vitest' },
      dependencies: { next: '14', react: '18', zustand: '4' },
    }));
    fs.writeFileSync(path.join(dir, 'Makefile'), 'build:\n\tgo build\n\ngen:\n\twails generate\n');

    const files = [
      pf('backend/cmd/app/main.go', 'go', [{ name: 'main', type: 'function', exported: false, line: 5 }]),
      pf('backend/internal/handlers/aggregator.go', 'go', [], ['github.com/gin-gonic/gin']),
      pf('backend/internal/handlers/device.go', 'go', [], ['github.com/gin-gonic/gin']),
      pf('frontend/app/layout.tsx', 'typescript'),
      pf('frontend/app/page.tsx', 'typescript'),
      pf('frontend/components/Button.tsx', 'typescript'),
    ];

    const ov = buildProjectOverview(analysisOf(files), 'app', dir);

    assert.ok(ov.stack.some(s => s.startsWith('Wails')), 'detects Wails');
    assert.ok(ov.stack.some(s => s.includes('Next.js (App Router)')), 'detects App Router');
    assert.ok(ov.stack.some(s => s.includes('Gin')), 'detects Gin');
    assert.ok(ov.stack.some(s => s.includes('Zustand')), 'detects Zustand');
    assert.ok(ov.commands.some(c => c.command === 'wails dev'), 'has wails dev command');
    assert.ok(ov.commands.some(c => c.command === 'go test ./...'), 'has go test');
    assert.ok(ov.entrypoints.some(e => e.path === 'backend/cmd/app/main.go'), 'finds go main');
    assert.ok(ov.entrypoints.some(e => e.path.includes('layout.tsx')), 'finds next layout');
    assert.ok(ov.directories.some(d => d.path.includes('handlers')), 'maps handler dir');
    assert.match(ov.summary, /Wails/);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('is deterministic', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auk-ov-'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', scripts: { build: 'tsc' }, dependencies: {} }));
    const files = [pf('src/a.ts', 'typescript'), pf('src/b.ts', 'typescript')];
    const a = buildProjectOverview(analysisOf(files), 'x', dir);
    const b = buildProjectOverview(analysisOf(files), 'x', dir);
    assert.deepStrictEqual(a, b);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
