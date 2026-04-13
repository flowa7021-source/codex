// ─── TypeScript resolver hook (worker thread) ─────────────────────────────────
// This file runs in the loader worker thread.
// Maps .js imports to .ts when only the .ts file exists.

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export async function resolve(specifier, context, nextResolve) {
  // Only handle relative imports ending in .js
  if (!specifier.startsWith('.') || !specifier.endsWith('.js')) {
    return nextResolve(specifier, context);
  }

  const parentUrl = context.parentURL;
  if (!parentUrl) return nextResolve(specifier, context);

  try {
    const parentDir = path.dirname(fileURLToPath(parentUrl));
    const jsPath = path.resolve(parentDir, specifier);
    const tsPath = jsPath.replace(/\.js$/, '.ts');

    if (!existsSync(jsPath) && existsSync(tsPath)) {
      return nextResolve(
        pathToFileURL(tsPath).href,
        context,
      );
    }
  } catch {
    // ignore resolution errors and fall through
  }

  return nextResolve(specifier, context);
}
