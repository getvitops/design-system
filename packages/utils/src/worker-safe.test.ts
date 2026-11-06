import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

/**
 * The subpaths documented as Worker-safe must not reach a Node builtin through any local import.
 * `notify` once re-exported `google-ads.ts`, which reached `google/token.ts` and `node:crypto`,
 * and nothing failed until a Worker tried to load it. This walks the real import graph instead
 * of trusting each module's docblock.
 */
const WORKER_ENTRIES = [
  'notify/index.ts',
  'tracking/index.ts',
  'security/index.ts',
  'crm/index.ts',
  'schema/index.ts',
  'git/index.ts',
  'url/index.ts',
  'reviews/select.ts',
  'content.ts',
];

const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/g;
const SIDE_EFFECT_IMPORT = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;

function specifiersOf(file: string): string[] {
  const source = readFileSync(file, 'utf8')
    // Docblocks mention `node:crypto` in prose; only real statements count.
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  return [...source.matchAll(IMPORT), ...source.matchAll(SIDE_EFFECT_IMPORT)].map((m) => m[1]!);
}

function nodeImportsReachableFrom(entry: string): string[] {
  const seen = new Set<string>();
  const offenders: string[] = [];
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const spec of specifiersOf(file)) {
      if (spec.startsWith('node:')) offenders.push(`${file} -> ${spec}`);
      else if (spec.startsWith('.')) visit(resolve(dirname(file), spec));
    }
  };
  visit(entry);
  return offenders;
}

/**
 * `@getvitops/config`'s root entry carries zod; its `./providers` entry is bare literals. Worker code
 * may import TYPES from the root (erased at build) but a runtime value must come from `./providers`,
 * or a conversion route's bundle gains a schema library it never runs.
 */
const VALUE_IMPORT_OF_CONFIG_ROOT =
  /(?:^|\n)\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+['"]@getvitops\/config['"]/;

function configRootValueImportsReachableFrom(entry: string): string[] {
  const seen = new Set<string>();
  const offenders: string[] = [];
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    if (VALUE_IMPORT_OF_CONFIG_ROOT.test(source)) offenders.push(file);
    for (const spec of specifiersOf(file))
      if (spec.startsWith('.')) visit(resolve(dirname(file), spec));
  };
  visit(entry);
  return offenders;
}

describe('Worker-safe subpaths', () => {
  it.each(WORKER_ENTRIES)('%s takes no runtime value from the config package root', (entry) => {
    const root = resolve(import.meta.dirname, entry);
    expect(configRootValueImportsReachableFrom(root)).toEqual([]);
  });

  it.each(WORKER_ENTRIES)('%s reaches no node: builtin', (entry) => {
    const root = resolve(import.meta.dirname, entry);
    expect(nodeImportsReachableFrom(root)).toEqual([]);
  });
});
