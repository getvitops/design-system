/**
 * A `--shadow-<name>` token feeds two consumers with different grammars:
 * `box-shadow` (pattern geometry, via the `--ds-*` group aliases) and
 * `filter: drop-shadow(…)` (the `.drop-shadow-<name>` utilities and the
 * `shadow:` state shortcut). `drop-shadow()` is the stricter of the two, and it
 * fails *closed*: an unsupported value invalidates the whole `filter`
 * declaration, so the utility renders no shadow rather than a degraded one.
 * `validate()` has to catch that, because nothing downstream can.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { generate } from './generate.ts';
import { defaultConfig } from './index.ts';
import { type DesignSystem, validate } from './schema.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, '..', 'assets');
// The framework partials are a gitignored build artifact — skip rather than
// fail in a clean checkout, as bundle-layers.test.ts does.
const hasAssets = existsSync(join(ASSETS, 'css', 'index.css'));

const tmp = mkdtempSync(join(tmpdir(), 'vitops-shadow-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const withShadows = (shadows: Record<string, string>): DesignSystem => ({
  ...defaultConfig(),
  shadows,
});

const warningsFor = (shadows: Record<string, string>) => {
  const result = validate(withShadows(shadows));
  expect(result.ok).toBe(true);
  return result.warnings.join('\n');
};

describe('validate: drop-shadow grammar', () => {
  it('warns on a spread radius', () => {
    // The regression: four lengths is legal `box-shadow` and illegal
    // `drop-shadow()`, so the token looked right and the utility was blank.
    const w = warningsFor({ '2xl': '0 40px 80px -20px rgb(0 0 0 / 0.5)' });
    expect(w).toContain('shadows.2xl');
    expect(w).toContain('spread radius');
    expect(w).toContain('.drop-shadow-2xl');
  });

  it('warns on multiple comma-separated layers', () => {
    expect(
      warningsFor({ stack: '0 1px 2px rgb(0 0 0 / 0.1), 0 8px 16px rgb(0 0 0 / 0.1)' }),
    ).toContain('comma-separated layers');
  });

  it('warns on inset', () => {
    expect(warningsFor({ well: 'inset 0 2px 4px rgb(0 0 0 / 0.2)' })).toContain('`inset`');
  });

  it('does not miscount numbers inside colour functions', () => {
    // `rgb(0 0 0 / 0.5)` and `color-mix()` carry bare numbers that must not be
    // tallied as lengths — the naive whitespace split reported a false spread.
    expect(
      warningsFor({
        a: '0 4px 6px rgb(0 0 0 / 0.12)',
        b: '0 4px 6px color-mix(in oklch, black 20%, transparent)',
        c: '0 4px 6px #0000001f',
        d: '0 1px rgb(0 0 0 / 0.1)',
      }),
    ).toBe('');
  });

  it('passes the shipped config', () => {
    expect(validate(defaultConfig()).warnings).toEqual([]);
  });
});

describe.skipIf(!hasAssets)('shadow utilities', () => {
  it('emits every shadow as both a token and a drop-shadow utility', async () => {
    const ds = defaultConfig();
    await generate({ input: ds, format: 'css', outDir: tmp, assetsDir: ASSETS });
    const css = readFileSync(join(tmp, 'styles.css'), 'utf8');
    for (const name of Object.keys(ds.shadows ?? {})) {
      expect(css).toContain(`--shadow-${name}:`);
      expect(css).toContain(`.drop-shadow-${name}`);
    }
  });
});
