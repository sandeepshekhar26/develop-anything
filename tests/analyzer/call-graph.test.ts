// ============================================================
// auk — tests for the symbol-level call graph
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseFiles } from '../../src/analyzer/parser.js';
import { buildCallGraph, findHotspots, maxCallDepth } from '../../src/analyzer/call-graph.js';
import type { FileEntry } from '../../src/types/analysis.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auk-cg-'));

function write(name: string, content: string): FileEntry {
  const abs = path.join(tmp, name);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return { path: name, absolutePath: abs, language: 'typescript', size: content.length, hash: 'h' };
}

async function fixtureGraph() {
  const entries = [
    write('src/util.ts', 'export function log(msg: string) { console.log(msg); }\n'),
    write('src/service.ts', [
      "import { log } from './util.js';",
      'export class Service {',
      '  run() { log("a"); this.helper(); }',
      '  helper() { log("b"); }',
      '}',
    ].join('\n')),
    write('src/main.ts', [
      "import { Service } from './service.js';",
      "import { log } from './util.js';",
      'export function main() {',
      '  const s = new Service();',
      '  s.run();',
      '  log("start");',
      '  external();',
      '}',
    ].join('\n')),
  ];
  const parsed = await parseFiles(entries);
  return buildCallGraph(parsed);
}

describe('call graph', () => {
  it('resolves cross-file calls through imports', async () => {
    const g = await fixtureGraph();
    const edge = g.callEdges.find(e => e.source === 'src/main.ts#main' && e.target === 'src/util.ts#log');
    assert.ok(edge?.resolved);
  });

  it('resolves instantiation edges', async () => {
    const g = await fixtureGraph();
    const edge = g.callEdges.find(e => e.source === 'src/main.ts#main' && e.target === 'src/service.ts#Service');
    assert.strictEqual(edge?.kind, 'instantiation');
  });

  it('marks unknown callees as unresolved external', async () => {
    const g = await fixtureGraph();
    const ext = g.callEdges.find(e => e.target === 'external:external');
    assert.ok(ext && !ext.resolved);
  });

  it('computes fan-in for hotspots', async () => {
    const g = await fixtureGraph();
    const log = g.symbols.find(s => s.id === 'src/util.ts#log');
    assert.ok((log?.metrics.fanIn ?? 0) >= 3); // Service.run, Service.helper, main
    assert.deepStrictEqual(findHotspots(g, 3)[0]?.id, 'src/util.ts#log');
  });

  it('is deterministic (byte-stable serialization)', async () => {
    const a = JSON.stringify(await fixtureGraph());
    const b = JSON.stringify(await fixtureGraph());
    assert.strictEqual(a, b);
  });

  it('maxCallDepth handles cycles without hanging', async () => {
    const entries = [
      write('cyc/a.ts', "import { b } from './b.js';\nexport function a() { b(); }\n"),
      write('cyc/b.ts', "import { a } from './a.js';\nexport function b() { a(); }\n"),
    ];
    const parsed = await parseFiles(entries);
    const g = buildCallGraph(parsed);
    assert.ok(maxCallDepth(g) >= 1);
  });
});
