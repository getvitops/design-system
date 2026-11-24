import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

/**
 * `@getvitops/generator/preview` runs the generator's pure `build()` in a browser or Worker. It
 * must reach no `node:*` or lightningcss, which is the whole reason `build.ts` was split from
 * `generate.ts`; this fails the day someone imports a Node API back into that graph.
 * This walks the BUILT import graph from `dist/preview.mjs` — through this package's chunks and into
 * `@getvitops/config` and `@getvitops/utils/*` — and fails on a module a Worker cannot load.
 *
 * It reads `dist/`, so it needs `build:packages` first, like every test here that resolves a
 * `@getvitops/*` subpath. It is a static check, not a workerd run: a Node API reached through a
 * dynamic `import()` or a global would not appear. The portal's own deploy is the runtime proof.
 */
const PACKAGES = resolve(import.meta.dirname, '../..');
const ENTRY = resolve(PACKAGES, 'generator/dist/preview.mjs');

const NODE_ONLY =
  /^(?:node:|fs$|path$|crypto$|child_process$|os$|url$|lightningcss|tailwind|sharp)/;
const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/g;

function resolveSpecifier(from: string, spec: string): string | undefined {
  if (spec.startsWith('.')) return resolve(dirname(from), spec);
  if (spec === '@getvitops/config') return resolve(PACKAGES, 'config/dist/index.mjs');
  const utils = /^@getvitops\/utils\/(.+)$/.exec(spec);
  if (utils) return resolve(PACKAGES, 'utils/dist', utils[1]!, 'index.mjs');
  return undefined;
}

function offendersFrom(entry: string): { visited: string[]; offenders: string[] } {
  const seen = new Set<string>();
  const offenders: string[] = [];
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!existsSync(file)) {
      offenders.push(`missing build output: ${file}`);
      return;
    }
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const match of source.matchAll(IMPORT)) {
      const spec = match[1]!;
      if (NODE_ONLY.test(spec)) offenders.push(`${file} -> ${spec}`);
      else {
        const next = resolveSpecifier(file, spec);
        if (next) visit(next);
      }
    }
  };
  visit(entry);
  return { visited: [...seen], offenders };
}

describe('@getvitops/generator/preview', () => {
  it('reaches no Node builtin or native dependency, so a Worker can load it', () => {
    const { visited, offenders } = offendersFrom(ENTRY);
    expect(visited.length).toBeGreaterThan(5);
    expect(offenders).toEqual([]);
  });
});
