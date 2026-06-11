// ============================================================
// Tests: zero-dependency CLI framework
// ============================================================

import { describe, it } from 'node:test';
import { expect } from '../helpers/expect.js';
import { Command } from '../../src/utils/cli.js';

describe('Command option parsing', () => {
  it('parses boolean flags', async () => {
    let seen: Record<string, unknown> = {};
    const cmd = new Command('test')
      .option('--ci', 'CI mode')
      .option('--quick', 'Quick mode')
      .action(opts => { seen = opts; });
    await cmd.parseAsync(['test', '--ci'], { from: 'user' });
    expect(seen.ci).toBe(true);
    expect(seen.quick).toBeUndefined();
  });

  it('parses value options and camelCases names', async () => {
    let seen: Record<string, unknown> = {};
    const cmd = new Command('test')
      .option('--diff <ref>', 'git ref')
      .option('--dry-run', 'preview')
      .action(opts => { seen = opts; });
    await cmd.parseAsync(['test', '--diff', 'main', '--dry-run'], { from: 'user' });
    expect(seen.diff).toBe('main');
    expect(seen.dryRun).toBe(true);
  });

  it('supports --key=value form', async () => {
    let seen: Record<string, unknown> = {};
    const cmd = new Command('test')
      .option('--diff <ref>', 'git ref')
      .action(opts => { seen = opts; });
    await cmd.parseAsync(['test', '--diff=feature/x'], { from: 'user' });
    expect(seen.diff).toBe('feature/x');
  });

  it('applies coercion functions', async () => {
    let seen: Record<string, unknown> = {};
    const cmd = new Command('test')
      .option('--targets <targets>', 'list', (v: string) => v.split(','))
      .action(opts => { seen = opts; });
    await cmd.parseAsync(['test', '--targets', 'a,b,c'], { from: 'user' });
    expect(seen.targets).toEqual(['a', 'b', 'c']);
  });

  it('handles negatable --no-x flags with positive default', async () => {
    let seen: Record<string, unknown> = {};
    const cmd = new Command('test')
      .option('--compile', 'compile', true)
      .option('--no-compile', 'skip compile')
      .action(opts => { seen = opts; });

    await cmd.parseAsync(['test'], { from: 'user' });
    expect(seen.compile).toBe(true);

    const cmd2 = new Command('test')
      .option('--compile', 'compile', true)
      .option('--no-compile', 'skip compile')
      .action(opts => { seen = opts; });
    await cmd2.parseAsync(['test', '--no-compile'], { from: 'user' });
    expect(seen.compile).toBe(false);
  });

  it('dispatches subcommands with their own options', async () => {
    let ran = '';
    let seen: Record<string, unknown> = {};
    const sub = new Command('verify')
      .option('--ci', 'ci mode')
      .action(opts => { ran = 'verify'; seen = opts; });
    const program = new Command('auk');
    program.addCommand(sub);
    await program.parseAsync(['node', 'auk', 'verify', '--ci']);
    expect(ran).toBe('verify');
    expect(seen.ci).toBe(true);
  });

  it('runs parent preAction hooks before subcommand actions', async () => {
    const order: string[] = [];
    const sub = new Command('go').action(() => { order.push('action'); });
    const program = new Command('auk')
      .option('-v, --verbose', 'verbose')
      .hook('preAction', () => { order.push('hook'); });
    program.addCommand(sub);
    await program.parseAsync(['node', 'auk', 'go']);
    expect(order).toEqual(['hook', 'action']);
  });

  it('collects global options on the program', async () => {
    const program = new Command('auk').option('-v, --verbose', 'verbose');
    const sub = new Command('noop').action(() => {});
    program.addCommand(sub);
    await program.parseAsync(['node', 'auk', '-v', 'noop']);
    expect(program.opts().verbose).toBe(true);
  });
});
