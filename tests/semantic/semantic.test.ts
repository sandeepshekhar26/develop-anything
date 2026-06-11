// ============================================================
// auk — tests for the semantic similarity layer
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { splitIdentifier } from '../../src/semantic/tokenizer.js';
import { buildVectors, cosine } from '../../src/semantic/tfidf.js';
import { clusterFiles } from '../../src/semantic/clusterer.js';
import { TfidfProvider } from '../../src/semantic/similarity.js';
import type { ParsedFile, FileEntry } from '../../src/types/analysis.js';

describe('tokenizer', () => {
  it('splits camelCase, snake_case, and acronym runs', () => {
    assert.deepStrictEqual(splitIdentifier('getUserById'), ['user']);
    assert.deepStrictEqual(splitIdentifier('parse_http_request'), ['parse', 'http', 'request']);
    assert.deepStrictEqual(splitIdentifier('HTTPServerConfig'), ['http', 'server', 'config']);
  });
});

describe('tfidf', () => {
  it('computes expected cosine on a tiny corpus', () => {
    const docs = new Map<string, string[]>([
      ['a', ['auth', 'login', 'token']],
      ['b', ['auth', 'login', 'session']],
      ['c', ['render', 'canvas', 'pixel']],
    ]);
    const idx = buildVectors(docs);
    const simAB = cosine(idx.vectors.get('a')!, idx.vectors.get('b')!);
    const simAC = cosine(idx.vectors.get('a')!, idx.vectors.get('c')!);
    assert.ok(simAB > 0.3, `a-b should be similar, got ${simAB}`);
    assert.strictEqual(simAC, 0);
  });
});

describe('clusterer', () => {
  it('finds two groups in a synthetic corpus, deterministically', () => {
    const docs = new Map<string, string[]>();
    for (let i = 0; i < 12; i++) docs.set(`auth${i}.ts`, ['auth', 'login', 'token', `extra${i}`]);
    for (let i = 0; i < 12; i++) docs.set(`render${i}.ts`, ['render', 'canvas', 'pixel', `other${i}`]);
    docs.set('lonely.ts', ['completely', 'unrelated', 'words']);

    const idx = buildVectors(docs);
    const r1 = clusterFiles(idx);
    const r2 = clusterFiles(idx);
    assert.deepStrictEqual(r1, r2);
    assert.strictEqual(r1.clusters.length, 2);
    const sizes = r1.clusters.map(c => c.files.length).sort();
    assert.deepStrictEqual(sizes, [12, 12]);
    assert.ok(r1.clusters.every(c => !c.files.includes('lonely.ts')));
  });
});

describe('TfidfProvider', () => {
  function fakeParsed(path: string, symbols: string[], imports: string[]): ParsedFile {
    const entry: FileEntry = { path, absolutePath: '/' + path, language: 'typescript', size: 0, hash: 'h' };
    return {
      entry,
      imports: imports.map(source => ({ source, symbols: [], isDefault: false, isNamespace: false, line: 1 })),
      exports: [],
      symbols: symbols.map(name => ({ name, type: 'function' as const, exported: true, line: 1 })),
      comments: [],
    };
  }

  it('round-trips through serialize/deserialize', () => {
    const files = [
      fakeParsed('src/auth/login.ts', ['validateLogin', 'createToken'], ['./session.js']),
      fakeParsed('src/auth/session.ts', ['createSession', 'validateToken'], []),
      fakeParsed('src/ui/button.ts', ['renderButton'], []),
    ];
    const p = new TfidfProvider();
    p.index(files);
    const restored = TfidfProvider.deserialize(p.serialize());
    const orig = p.similar('src/auth/login.ts', 2);
    const back = restored.similar('src/auth/login.ts', 2);
    assert.deepStrictEqual(back, orig);
    assert.strictEqual(orig[0].file, 'src/auth/session.ts');
  });

  it('ranks unindexed token bags against the index', () => {
    const files = [
      fakeParsed('src/auth/login.ts', ['validateLogin', 'authToken'], []),
      fakeParsed('src/ui/button.ts', ['renderButton', 'paintCanvas'], []),
    ];
    const p = new TfidfProvider();
    p.index(files);
    const [best] = p.similarToTokens(['auth', 'token', 'validate'], 1);
    assert.strictEqual(best.file, 'src/auth/login.ts');
  });
});
