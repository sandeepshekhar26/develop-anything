// Resolves `./foo.js` specifiers to `./foo.ts` source files so the CLI
// and tests can run directly from TypeScript source with:
//   node --experimental-strip-types --import ./scripts/ts-run.mjs <file.ts>
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && specifier.endsWith('.js') && context.parentURL?.startsWith('file:')) {
    const candidate = new URL(specifier, context.parentURL);
    if (!existsSync(fileURLToPath(candidate))) {
      const tsCandidate = specifier.replace(/\.js$/, '.ts');
      const tsUrl = new URL(tsCandidate, context.parentURL);
      if (existsSync(fileURLToPath(tsUrl))) {
        return nextResolve(tsCandidate, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
