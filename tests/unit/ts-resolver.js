// ─── TypeScript resolver for Node.js test runner ─────────────────────────────
// Registers a custom module resolver that maps .js imports to .ts files when
// only the .ts file exists. Used so TypeScript source modules can be tested
// directly under Node.js 22+ with --experimental-strip-types.

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(
  pathToFileURL(new URL('./ts-resolver-hook.js', import.meta.url).pathname),
  import.meta.url,
);
