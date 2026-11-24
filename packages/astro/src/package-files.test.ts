import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

/**
 * `@getvitops/astro` ships its components as SOURCE, and its `files` array names each file one by
 * one. A component that imports a sibling module the list does not name builds and passes every
 * test in this repo (the file is right there), then fails in a consumer's dev server with "Failed
 * to load url ./footer.ts ... Does the file exist?". Only a scaffold install used to catch it.
 * This walks the relative imports of every shipped source file and fails on one that would not
 * ship.
 */
const ROOT = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as { files: string[] };
const entries = pkg.files.filter((f) => f.startsWith('src/'));
/** An entry is a file, or a directory whose whole subtree ships (`src/schemas`). */
const ships = (rel: string) => entries.some((e) => rel === e || rel.startsWith(`${e}/`));

const IMPORT =
  /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"](\.[^'"]+)['"]|(?:^|\n)\s*import\s+['"](\.[^'"]+)['"]/g;

function relativeImports(file: string): string[] {
  const source = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  return [...source.matchAll(IMPORT)].map((m) => (m[1] ?? m[2])!);
}

/** `./x.ts`, `./x.js` (a `.ts` source), `./x` and `./x/index.ts`, whichever exists. */
function resolveImport(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec);
  for (const candidate of [
    base,
    base.replace(/\.js$/, '.ts'),
    `${base}.ts`,
    `${base}.astro`,
    resolve(base, 'index.ts'),
  ]) {
    if (existsSync(candidate) && !candidate.endsWith('/')) {
      try {
        if (readFileSync(candidate, 'utf8') !== undefined) return candidate;
      } catch {
        /* a directory: try the next candidate */
      }
    }
  }
  return null;
}

describe('@getvitops/astro `files`', () => {
  it('names every file it lists', () => {
    for (const f of entries) expect(existsSync(resolve(ROOT, f)), f).toBe(true);
  });

  it('ships every module a shipped .astro or .ts file imports by a relative path', () => {
    const missing: string[] = [];
    for (const f of entries.filter((e) => /\.(astro|ts)$/.test(e))) {
      const abs = resolve(ROOT, f);
      for (const spec of relativeImports(abs)) {
        const target = resolveImport(abs, spec);
        if (!target) continue; // a non-code asset or a type-only path; nothing to ship
        const rel = relative(ROOT, target);
        if (rel.startsWith('src/') && !ships(rel)) missing.push(`${f} imports ${rel}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
