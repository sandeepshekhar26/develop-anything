// ============================================================
// auk — tests for the graph viewer template
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { renderGraphHtml } from '../../src/viewer/template.js';
import type { DependencyGraph } from '../../src/types/analysis.js';

const graph: DependencyGraph = {
  version: 2,
  generatedAt: '2026-06-11T00:00:00.000Z',
  nodes: [
    { id: 'src/a.ts', type: 'file', layer: 'service', symbols: ['foo'], centrality: { degree: 1, betweenness: 0 } },
    { id: 'src/b.ts', type: 'file', layer: 'utility', symbols: [], centrality: { degree: 1, betweenness: 0 } },
  ],
  edges: [{ source: 'src/a.ts', target: 'src/b.ts', symbols: ['foo'], type: 'import' }],
  layers: { service: ['src/a.ts'], utility: ['src/b.ts'] } as DependencyGraph['layers'],
  boundaries: [],
  symbols: [{ id: 'src/a.ts#foo', file: 'src/a.ts', name: 'foo', kind: 'function', exported: true, line: 1, metrics: { fanIn: 2, fanOut: 0 } }],
  callEdges: [],
};

describe('graph viewer template', () => {
  it('is fully self-contained (no external URLs)', () => {
    const html = renderGraphHtml(graph, 'proj');
    assert.ok(!/src\s*=\s*["']https?:/.test(html), 'no external scripts');
    assert.ok(!/href\s*=\s*["']https?:/.test(html), 'no external styles');
    assert.ok(!html.includes('@import'), 'no css imports');
  });

  it('embeds graph data that round-trips', () => {
    const html = renderGraphHtml(graph, 'proj');
    const m = html.match(/<script type="application\/json" id="auk-graph">(.*?)<\/script>/s);
    assert.ok(m);
    const data = JSON.parse(m![1].replace(/\\u003c/g, '<'));
    assert.strictEqual(data.files.length, 2);
    assert.strictEqual(data.symbols[0].fanIn, 2);
    assert.strictEqual(data.project, 'proj');
  });

  it('escapes the project name', () => {
    const html = renderGraphHtml(graph, '<script>alert(1)</script>');
    assert.ok(!html.includes('<script>alert'));
  });
});
