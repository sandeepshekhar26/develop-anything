// ============================================================
// auk — AI Context Engineering Platform
// Minimal CLI framework (zero dependencies)
//
// Implements the subset of the commander.js API that auk
// uses: options (boolean, value-taking, negatable, coercion),
// subcommands, preAction hooks, version, and help output.
// ============================================================

type ActionFn = (options: Record<string, unknown>, command: Command) => void | Promise<void>;
type HookFn = (thisCommand: Command, actionCommand: Command) => void | Promise<void>;
type CoerceFn = (value: string, previous: unknown) => unknown;

interface OptionDef {
  flags: string;
  description: string;
  short?: string;
  long: string;
  /** camelCase attribute name */
  attribute: string;
  takesValue: boolean;
  negate: boolean;
  defaultValue?: unknown;
  coerce?: CoerceFn;
}

function camelCase(s: string): string {
  return s.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
}

function parseFlags(flags: string): Pick<OptionDef, 'short' | 'long' | 'takesValue' | 'negate' | 'attribute'> {
  const parts = flags.split(/[,\s]+/).filter(Boolean);
  let short: string | undefined;
  let long = '';
  let takesValue = false;
  for (const p of parts) {
    if (p.startsWith('--')) long = p;
    else if (p.startsWith('-')) short = p;
    else if (p.startsWith('<') || p.startsWith('[')) takesValue = true;
  }
  const negate = long.startsWith('--no-');
  const attribute = camelCase(negate ? long.slice(5) : long.slice(2));
  return { short, long, takesValue, negate, attribute };
}

export class Command {
  private _name: string;
  private _description = '';
  private _version?: string;
  private _options: OptionDef[] = [];
  private _commands: Command[] = [];
  private _action?: ActionFn;
  private _hooks: { event: string; fn: HookFn }[] = [];
  private _opts: Record<string, unknown> = {};
  private _parent?: Command;
  /** positional arguments left over after option parsing */
  args: string[] = [];

  constructor(name = '') {
    this._name = name;
  }

  name(n: string): this {
    this._name = n;
    return this;
  }

  description(d: string): this {
    this._description = d;
    return this;
  }

  version(v: string): this {
    this._version = v;
    return this;
  }

  option(flags: string, description = '', defaultOrCoerce?: unknown, defaultValue?: unknown): this {
    const parsed = parseFlags(flags);
    const def: OptionDef = { flags, description, ...parsed };
    if (typeof defaultOrCoerce === 'function') {
      def.coerce = defaultOrCoerce as CoerceFn;
      if (defaultValue !== undefined) def.defaultValue = defaultValue;
    } else if (defaultOrCoerce !== undefined) {
      def.defaultValue = defaultOrCoerce;
    }
    this._options.push(def);
    if (def.defaultValue !== undefined) {
      this._opts[def.attribute] = def.defaultValue;
    } else if (def.negate && this._opts[def.attribute] === undefined) {
      // commander default for standalone --no-x is true
      const positiveExists = this._options.some(o => o !== def && o.attribute === def.attribute);
      if (!positiveExists) this._opts[def.attribute] = true;
    }
    return this;
  }

  hook(event: 'preAction' | 'postAction', fn: HookFn): this {
    this._hooks.push({ event, fn });
    return this;
  }

  addCommand(cmd: Command): this {
    cmd._parent = this;
    this._commands.push(cmd);
    return this;
  }

  action(fn: ActionFn): this {
    this._action = fn;
    return this;
  }

  opts(): Record<string, unknown> {
    return this._opts;
  }

  // ----------------------------------------------------------
  // parsing
  // ----------------------------------------------------------

  parse(argv?: string[], parseOptions?: { from?: string }): this {
    void this.parseAsync(argv, parseOptions);
    return this;
  }

  async parseAsync(argv?: string[], parseOptions?: { from?: string }): Promise<this> {
    let args: string[];
    if (argv && parseOptions?.from === 'user') {
      args = argv.slice();
      // commander's `from: 'user'` includes the command name when
      // re-dispatching a subcommand directly; strip it if it matches.
      if (args[0] === this._name) args = args.slice(1);
    } else {
      args = (argv ?? process.argv).slice(2);
    }
    await this.run(args);
    return this;
  }

  private findOption(token: string): OptionDef | undefined {
    return this._options.find(o => o.long === token || o.short === token);
  }

  private async run(args: string[]): Promise<void> {
    const rest: string[] = [];
    let i = 0;
    while (i < args.length) {
      const token = args[i];
      if (token === '--help' || token === '-h') {
        this.help();
        return;
      }
      if (this._version && (token === '--version' || token === '-V')) {
        console.log(this._version);
        return;
      }
      const opt = this.findOption(token);
      if (opt) {
        if (opt.takesValue) {
          const value = args[++i];
          if (value === undefined) {
            console.error(`error: option '${opt.flags}' argument missing`);
            process.exit(1);
          }
          this._opts[opt.attribute] = opt.coerce
            ? opt.coerce(value, this._opts[opt.attribute])
            : value;
        } else {
          this._opts[opt.attribute] = opt.negate ? false : true;
        }
        i++;
        continue;
      }
      // try equals form: --key=value
      if (token.startsWith('--') && token.includes('=')) {
        const eq = token.indexOf('=');
        const flag = token.slice(0, eq);
        const valOpt = this.findOption(flag);
        if (valOpt && valOpt.takesValue) {
          const value = token.slice(eq + 1);
          this._opts[valOpt.attribute] = valOpt.coerce
            ? valOpt.coerce(value, this._opts[valOpt.attribute])
            : value;
          i++;
          continue;
        }
      }
      if (!token.startsWith('-')) {
        const sub = this._commands.find(c => c._name === token);
        if (sub) {
          // inherit remaining args into subcommand
          await this.dispatch(sub, args.slice(i + 1));
          return;
        }
        if (this._commands.length > 0) {
          console.error(`error: unknown command '${token}'`);
          this.outputHelp();
          process.exit(1);
        }
      }
      if (token.startsWith('-') && !this.findOption(token)) {
        console.error(`error: unknown option '${token}'`);
        process.exit(1);
      }
      rest.push(token);
      i++;
    }

    this.args = rest;

    if (this._action) {
      await this.runHooks('preAction', this);
      await this._action(this._opts, this);
      await this.runHooks('postAction', this);
    } else if (this._commands.length > 0) {
      this.help();
    }
  }

  private async dispatch(sub: Command, args: string[]): Promise<void> {
    await sub.run(args);
  }

  private async runHooks(event: string, actionCommand: Command): Promise<void> {
    // walk up the command tree, running hooks registered on ancestors
    const chain: Command[] = [];
    let cur: Command | undefined = this as Command;
    while (cur) {
      chain.unshift(cur);
      cur = cur._parent;
    }
    for (const cmd of chain) {
      for (const h of cmd._hooks) {
        if (h.event === event) await h.fn(cmd, actionCommand);
      }
    }
  }

  // ----------------------------------------------------------
  // help
  // ----------------------------------------------------------

  help(): void {
    this.outputHelp();
    process.exit(0);
  }

  outputHelp(): void {
    const lines: string[] = [];
    const usageParts = ['Usage:', this.fullName()];
    if (this._options.length > 0) usageParts.push('[options]');
    if (this._commands.length > 0) usageParts.push('[command]');
    lines.push(usageParts.join(' '));
    lines.push('');
    if (this._description) {
      lines.push(this._description);
      lines.push('');
    }
    if (this._options.length > 0 || this._version) {
      lines.push('Options:');
      const rows: [string, string][] = [];
      for (const o of this._options) rows.push([o.flags, o.description]);
      if (this._version) rows.push(['-V, --version', 'output the version number']);
      rows.push(['-h, --help', 'display help for command']);
      const width = Math.max(...rows.map(r => r[0].length)) + 2;
      for (const [f, d] of rows) lines.push(`  ${f.padEnd(width)}${d}`);
      lines.push('');
    }
    if (this._commands.length > 0) {
      lines.push('Commands:');
      const width = Math.max(...this._commands.map(c => c._name.length)) + 2;
      for (const c of this._commands) {
        lines.push(`  ${c._name.padEnd(width)}${c._description}`);
      }
      lines.push('');
    }
    console.log(lines.join('\n'));
  }

  private fullName(): string {
    const parts: string[] = [];
    let cur: Command | undefined = this as Command;
    while (cur) {
      if (cur._name) parts.unshift(cur._name);
      cur = cur._parent;
    }
    return parts.join(' ');
  }
}
