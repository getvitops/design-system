import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

/**
 * `<Icon>` is server-rendered on Cloudflare Workers, which cannot load a native module. It once
 * imported `@getvitops/generator`'s root entry, which re-exports `generate.ts` and so reaches
 * lightningcss; that shipped in an alpha and returned a 500 on every request of a consumer that
 * used the component anywhere. The fix was to import the narrow `icons-sprite` subpath. This walks
 * the real source import graph of the two modules `Icon.astro` takes values from, so a future
 * re-export that quietly reconnects them fails here, not in a deployed Worker.
 *
 * Only STATIC imports count: `favicon.ts` loads `sharp` with a dynamic `import()` on purpose, and
 * that is exactly the pattern that keeps it out of the bundle.
 */
const PACKAGES = resolve(import.meta.dirname, '..', '..');
const ICON_ENTRIES = [
  // `Icon.astro` imports `loadIconSvg` / `spriteId` from `@getvitops/generator/icons-sprite`.
  resolve(PACKAGES, 'generator/src/icons-sprite.ts'),
  // ...and `resolveIcon` from the `@getvitops/utils` root, which bundlers tree-shake but a graph
  // walk cannot, so the whole root's static imports are held to the same line.
  resolve(PACKAGES, 'utils/src/index.ts'),
];

/** Packages that are, or ship, a native binary. */
const NATIVE = ['lightningcss', 'sharp', 'png-to-ico', 'oxipng', '@resvg/resvg-js'];

const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/g;
const SIDE_EFFECT_IMPORT = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;

function specifiersOf(file: string): string[] {
  const source = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  return [...source.matchAll(IMPORT), ...source.matchAll(SIDE_EFFECT_IMPORT)].map((m) => m[1]!);
}

/** `file -> specifier` for every static native import and every `generate.ts` reachable. */
function offendersFrom(entry: string): string[] {
  const seen = new Set<string>();
  const offenders: string[] = [];
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const spec of specifiersOf(file)) {
      if (NATIVE.some((n) => spec === n || spec.startsWith(`${n}/`))) {
        offenders.push(`${file.replace(`${PACKAGES}/`, '')} -> ${spec}`);
      } else if (spec.startsWith('.')) {
        const next = resolve(dirname(file), spec.replace(/\.(mjs|js)$/, '.ts'));
        if (next.endsWith('/generate.ts')) {
          offenders.push(`${file.replace(`${PACKAGES}/`, '')} -> ${spec} (the generator entry)`);
        }
        visit(next);
      }
    }
  };
  visit(entry);
  return offenders;
}

describe('<Icon> import graph', () => {
  it.each(ICON_ENTRIES.map((e) => [e.replace(`${PACKAGES}/`, ''), e]))(
    '%s reaches no native module statically',
    (_name, entry) => {
      expect(offendersFrom(entry!)).toEqual([]);
    },
  );

  it('the walk can see an offender (guards against a vacuous pass)', () => {
    // The generator's own root entry is the known bad one: it must register as an offender.
    expect(offendersFrom(resolve(PACKAGES, 'generator/src/index.ts')).length).toBeGreaterThan(0);
  });
});
