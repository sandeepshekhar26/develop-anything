// ============================================================
// auk — tests for the tree-sitter parser layer
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseFiles } from '../../src/analyzer/parser.js';
import type { FileEntry, Language } from '../../src/types/analysis.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auk-tsp-'));

function write(name: string, content: string, language: Language): FileEntry {
  const abs = path.join(tmp, name);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return { path: name, absolutePath: abs, language, size: content.length, hash: 'h' };
}

describe('tree-sitter parser - TypeScript', () => {
  it('extracts symbols, body spans, and call sites', async () => {
    const entry = write('svc.ts', [
      "import { db } from './db.js';",
      'export class UserService {',
      '  getUser(id: string) {',
      '    if (!id) throw new Error("no id");',
      '    return db.find(id);',
      '  }',
      '}',
      'export function helper() {',
      '  const svc = new UserService();',
      '  return svc.getUser("1");',
      '}',
    ].join('\n'), 'typescript');

    const [r] = await parseFiles([entry]);
    assert.strictEqual(r.parserUsed, 'tree-sitter');

    const cls = r.symbols.find(s => s.name === 'UserService' && s.type === 'class');
    assert.ok(cls?.exported);
    const method = r.symbols.find(s => s.name === 'getUser');
    assert.strictEqual(method?.type, 'method');
    assert.strictEqual(method?.parentSymbol, 'UserService');
    assert.ok((method?.bodySize ?? 0) >= 3);
    assert.ok((method?.complexityHint ?? 0) >= 2); // if branch

    const calls = r.calls ?? [];
    assert.ok(calls.some(c => c.caller === 'UserService.getUser' && c.callee === 'db.find' && c.calleeRoot === 'db'));
    assert.ok(calls.some(c => c.caller === 'helper' && c.kind === 'new' && c.callee === 'UserService'));
    assert.ok(calls.some(c => c.caller === 'helper' && c.callee === 'svc.getUser'));

    // imports come from the shared extraction
    assert.strictEqual(r.imports[0].source, './db.js');
  });

  it('records extends as a call edge', async () => {
    const entry = write('sub.ts', 'class Base {}\nexport class Sub extends Base {}\n', 'typescript');
    const [r] = await parseFiles([entry]);
    assert.ok(r.calls?.some(c => c.kind === 'extends' && c.callee === 'Base'));
  });
});

describe('tree-sitter parser - Python', () => {
  it('extracts functions, classes, and calls', async () => {
    const entry = write('app.py', [
      'from db import find',
      'class Service:',
      '    def get(self, id):',
      '        if id:',
      '            return find(id)',
      'def _private():',
      '    pass',
    ].join('\n'), 'python');

    const [r] = await parseFiles([entry]);
    assert.strictEqual(r.parserUsed, 'tree-sitter');
    assert.ok(r.symbols.some(s => s.name === 'Service' && s.type === 'class'));
    const get = r.symbols.find(s => s.name === 'get');
    assert.strictEqual(get?.parentSymbol, 'Service');
    assert.ok(r.symbols.find(s => s.name === '_private')?.exported === false);
    assert.ok(r.calls?.some(c => c.caller === 'Service.get' && c.callee === 'find'));
  });
});

describe('tree-sitter parser - Go', () => {
  it('extracts functions and methods with export by case', async () => {
    const entry = write('main.go', [
      'package main',
      'func Public() { helper() }',
      'func helper() {}',
      'type Server struct {}',
      'func (s *Server) Run() { Public() }',
    ].join('\n'), 'go');

    const [r] = await parseFiles([entry]);
    assert.strictEqual(r.parserUsed, 'tree-sitter');
    assert.ok(r.symbols.find(s => s.name === 'Public')?.exported);
    assert.ok(r.symbols.find(s => s.name === 'helper')?.exported === false);
    assert.ok(r.symbols.some(s => s.name === 'Run' && s.type === 'method'));
    assert.ok(r.calls?.some(c => c.caller === 'Public' && c.callee === 'helper'));
  });
});

describe('regex fallback', () => {
  it('uses regex for languages without a grammar', async () => {
    const entry = write('lib.rb', "require 'json'\nclass Foo\n  def bar\n  end\nend\n", 'ruby');
    const [r] = await parseFiles([entry]);
    assert.strictEqual(r.parserUsed, 'regex');
    assert.ok(r.symbols.some(s => s.name === 'Foo'));
  });

  it('tree-sitter finds at least the symbols regex finds (TS differential)', async () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/analyzer/import-graph.ts'), 'utf-8');
    const entry = write('diff.ts', src, 'typescript');
    const [tsResult] = await parseFiles([entry]);
    const { parseFile } = await import('../../src/analyzer/parser.js');
    const regexResult = parseFile(entry);
    const tsNames = new Set(tsResult.symbols.map(s => s.name));
    for (const s of regexResult.symbols.filter(s => s.type === 'function' || s.type === 'class')) {
      assert.ok(tsNames.has(s.name), `tree-sitter missed symbol: ${s.name}`);
    }
  });
});
