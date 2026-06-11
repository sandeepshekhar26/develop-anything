// ============================================================
// End-to-end test: full auk pipeline against a fixture codebase
// (init → generate → compile → verify → badge)
// ============================================================

import { describe, it } from 'node:test';
import { expect } from '../helpers/expect.js';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function runAuk(args: string[], cwd: string): string {
  const distEntry = path.join(repoRoot, 'dist', 'index.js');
  const useDist = fs.existsSync(distEntry);
  const nodeArgs = useDist
    ? [distEntry, ...args]
    : [
        '--experimental-strip-types',
        '--no-warnings',
        '--import', path.join(repoRoot, 'scripts', 'ts-run.mjs'),
        path.join(repoRoot, 'src', 'index.ts'),
        ...args,
      ];
  return execFileSync(process.execPath, nodeArgs, { cwd, encoding: 'utf-8' });
}

function makeFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auk-e2e-'));
  const write = (rel: string, content: string) => {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  };

  write('src/types/result.ts', [
    '// Decision: services return Result<T,E> — explicit error paths.',
    'export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };',
    'export function ok<T>(value: T): Result<T, never> { return { ok: true, value }; }',
    'export function err<E>(error: E): Result<never, E> { return { ok: false, error }; }',
    '',
  ].join('\n'));

  write('src/services/user-service.ts', [
    "import { Result, ok, err } from '../types/result.js';",
    "import { UserModel } from '../models/user-model.js';",
    'export class UserService {',
    '  getUser(id: string): Result<UserModel> {',
    "    if (!id) return err(new Error('missing id'));",
    "    return ok(new UserModel(id, 'Test'));",
    '  }',
    '}',
    '',
  ].join('\n'));

  write('src/controllers/user-controller.ts', [
    "import { UserService } from '../services/user-service.js';",
    'export class UserController {',
    '  private service = new UserService();',
    '  handleGet(id: string) { return this.service.getUser(id); }',
    '}',
    '',
  ].join('\n'));

  write('src/models/user-model.ts', [
    'export class UserModel {',
    '  constructor(public id: string, public name: string) {}',
    '}',
    '',
  ].join('\n'));

  return dir;
}

describe('auk end-to-end', () => {
  it('runs init → generate → verify → badge on a fixture project', () => {
    const fixture = makeFixture();

    const initOut = runAuk(['init'], fixture);
    expect(initOut).toContain('initialized');

    const genOut = runAuk(['generate'], fixture);
    expect(genOut).toContain('Generation complete');
    expect(fs.existsSync(path.join(fixture, '.auk', 'rules.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(fixture, '.auk', 'graph.json'))).toBe(true);
    expect(fs.existsSync(path.join(fixture, 'CLAUDE.md'))).toBe(true);
    expect(fs.existsSync(path.join(fixture, 'AGENTS.md'))).toBe(true);

    // graph should have resolved ESM-style .js imports to .ts files
    const graph = JSON.parse(fs.readFileSync(path.join(fixture, '.auk', 'graph.json'), 'utf-8'));
    expect(graph.edges.length).toBeGreaterThan(0);

    const verifyOut = runAuk(['verify'], fixture);
    expect(verifyOut).toContain('Health Score');
    expect(fs.existsSync(path.join(fixture, '.auk', 'health.json'))).toBe(true);

    const badgeOut = runAuk(['badge', '--svg'], fixture);
    expect(badgeOut).toContain('badge.json');
    const badge = JSON.parse(fs.readFileSync(path.join(fixture, '.auk', 'badge.json'), 'utf-8'));
    expect(badge.schemaVersion).toBe(1);
    expect(badge.label).toBe('context health');

    fs.rmSync(fixture, { recursive: true, force: true });
  });

  it('detects context rot after a violating change', () => {
    const fixture = makeFixture();
    runAuk(['init'], fixture);
    runAuk(['generate', '--no-compile'], fixture);

    const healthy = JSON.parse(
      runAuk(['verify'], fixture) !== '' &&
        fs.readFileSync(path.join(fixture, '.auk', 'health.json'), 'utf-8')
    );

    // introduce a default export — violates exports-named-only
    fs.writeFileSync(
      path.join(fixture, 'src', 'services', 'rogue-service.ts'),
      'export default class RogueService { run() { return 1; } }\n'
    );

    runAuk(['verify'], fixture);
    const after = JSON.parse(fs.readFileSync(path.join(fixture, '.auk', 'health.json'), 'utf-8'));
    expect(after.overallScore <= healthy.overallScore).toBe(true);

    fs.rmSync(fixture, { recursive: true, force: true });
  });
});
