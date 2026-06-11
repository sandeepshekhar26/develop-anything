// ============================================================
// auk — AI Context Engineering Platform
// Colorful CLI logger with brand styling
// ============================================================

// Zero-dependency ANSI colors. Respects NO_COLOR, --no-color, and non-TTY output.
const colorEnabled: boolean =
  process.env.NO_COLOR === undefined &&
  process.env.FORCE_COLOR !== '0' &&
  !process.argv.includes('--no-color') &&
  (process.stdout.isTTY === true || process.env.FORCE_COLOR !== undefined);

type Paint = (s: string) => string;

function ansi(open: string, close: string): Paint {
  return (s: string) => (colorEnabled ? `\x1b[${open}m${s}\x1b[${close}m` : s);
}

function hex(hexColor: string): Paint {
  const n = parseInt(hexColor.replace('#', ''), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return ansi(`38;2;${r};${g};${b}`, '39');
}

const yellow = ansi('33', '39');
const red = ansi('31', '39');

/** Log levels */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

/** Logger configuration */
let verbose = false;

export function setVerbose(v: boolean): void {
  verbose = v;
}

/** Brand colors */
const brand = {
  primary: hex('#7C3AED'),    // Purple
  secondary: hex('#06B6D4'),  // Cyan
  accent: hex('#F59E0B'),     // Amber
  success: hex('#10B981'),    // Emerald
  error: hex('#EF4444'),      // Red
  warning: hex('#F59E0B'),    // Amber
  dim: ansi('90', '39'),
  bold: ansi('1', '22'),
};

/** The auk logo/banner */
export function printBanner(): void {
  const banner = `
${brand.primary('  ╔═══════════════════════════════════════════╗')}
${brand.primary('  ║')}   ${brand.bold(brand.secondary('auk'))} ${brand.dim('— AI Context Engineering')}            ${brand.primary('║')}
${brand.primary('  ║')}   ${brand.dim('One command. Every AI gets your code.')}   ${brand.primary('║')}
${brand.primary('  ╚═══════════════════════════════════════════╝')}
`;
  console.log(banner);
}

/** Log an info message */
export function info(message: string): void {
  console.log(`${brand.secondary('ℹ')} ${message}`);
}

/** Log a success message */
export function success(message: string): void {
  console.log(`${brand.success('✔')} ${message}`);
}

/** Log a warning message */
export function warn(message: string): void {
  console.log(`${brand.warning('⚠')} ${yellow(message)}`);
}

/** Log an error message */
export function error(message: string): void {
  console.error(`${brand.error('✖')} ${red(message)}`);
}

/** Log a debug message (only in verbose mode) */
export function debug(message: string): void {
  if (verbose) {
    console.log(`${brand.dim('⋯')} ${brand.dim(message)}`);
  }
}

/** Log a step in a process */
export function step(number: number, total: number, message: string): void {
  const progress = brand.dim(`[${number}/${total}]`);
  console.log(`${progress} ${message}`);
}

/** Log a section header */
export function header(title: string): void {
  console.log();
  console.log(brand.bold(brand.primary(`▸ ${title}`)));
  console.log(brand.dim('─'.repeat(50)));
}

/** Log a key-value pair */
export function keyValue(key: string, value: string | number): void {
  console.log(`  ${brand.dim(key + ':')} ${value}`);
}

/** Log a rule status */
export function ruleStatus(status: string, message: string): void {
  const icons: Record<string, string> = {
    valid: brand.success('✅'),
    degraded: brand.warning('⚠️'),
    violated: brand.error('❌'),
    obsolete: brand.dim('💀'),
  };
  const icon = icons[status] || brand.dim('•');
  console.log(`  ${icon} ${message}`);
}

/** Create a simple progress indicator */
export function createProgress(message: string): { stop: (finalMessage?: string) => void } {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r${brand.secondary(frames[i++ % frames.length])} ${message}`);
  }, 80);

  return {
    stop(finalMessage?: string) {
      clearInterval(interval);
      process.stdout.write(`\r${brand.success('✔')} ${finalMessage || message}\n`);
    },
  };
}

export const logger = {
  info,
  success,
  warn,
  error,
  debug,
  step,
  header,
  keyValue,
  ruleStatus,
  printBanner,
  createProgress,
  setVerbose,
  brand,
};
