// Registers the .js -> .ts resolver hook. Used to run auk from source:
//   node --experimental-strip-types --import ./scripts/ts-run.mjs src/index.ts
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(new URL('./ts-loader.mjs', import.meta.url), pathToFileURL('./'));
