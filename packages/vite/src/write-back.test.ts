/**
 * `<wc-theme-editor>`'s **Save to source** writes a design-system-relative patch
 * (`colors.palette.navy.anchors.600`) back into whatever config file the plugin
 * was pointed at. Now that `input` may be the larger site config, the server has
 * to know *where in that file* the design system lives — and get it right for
 * every shape the site schema accepts, including the two shorthands
 * `resolveSiteConfig` normalises away in memory.
 *
 * This is the one place in the change that writes to a consumer's source, so it
 * is the one worth pinning hardest. The failure isn't an exception: merge at the
 * wrong depth and you get a `colors` key sitting beside `organization` that
 * nothing reads, while the tokens the editor showed you never move.
 */
import { describe, expect, test } from 'vitest';
import { designSystemPath, getAt, setAt } from './index.ts';

const ds = { colors: { palette: { navy: { seed: '#123456' } } } };

describe('designSystemPath', () => {
  test('a design-system.json IS the design system — the empty path', () => {
    expect(designSystemPath(ds)).toEqual([]);
  });

  test('the canonical site-config shape', () => {
    expect(designSystemPath({ designSystem: { themes: { default: ds } } })).toEqual([
      'designSystem',
      'themes',
      'default',
    ]);
  });

  test('follows the requested theme', () => {
    expect(designSystemPath({ designSystem: { themes: { default: ds } } }, 'elegant')).toEqual([
      'designSystem',
      'themes',
      'elegant',
    ]);
  });

  test('a bare design system written inline — one theme, and it is the block itself', () => {
    // `resolveSiteConfig` reads this as `{ themes: { default: … } }`, but on disk
    // there is no `themes` key. Writing to the normalised path would add one
    // beside the author's object and edit a copy nobody builds from.
    expect(designSystemPath({ designSystem: ds })).toEqual(['designSystem']);
  });

  test('the legacy bare theme map, from before the block gained system-wide fields', () => {
    expect(designSystemPath({ designSystem: { default: ds, elegant: ds } })).toEqual([
      'designSystem',
      'default',
    ]);
  });
});

describe('the merge target', () => {
  const patch = { colors: { palette: { navy: { seed: '#0d3b2b' } } } };
  /** What the middleware does: read → locate → merge the subtree → put it back. */
  const save = (file: Record<string, unknown>, theme?: string) => {
    const at = designSystemPath(file, theme);
    const merged = {
      ...(getAt(file, at) as Record<string, unknown>),
      colors: patch.colors,
    };
    return setAt(file, at, merged) as Record<string, unknown>;
  };

  test('lands inside the theme, not at the root of a site config', () => {
    const file = { organization: { name: 'Acme' }, designSystem: { themes: { default: ds } } };
    const out = save(file);
    expect(getAt(out, ['designSystem', 'themes', 'default', 'colors', 'palette', 'navy'])).toEqual({
      seed: '#0d3b2b',
    });
    // The tell-tale of the bug this guards: a stray top-level `colors`.
    expect(out.colors).toBeUndefined();
    expect(out.organization).toEqual({ name: 'Acme' });
  });

  test('leaves the other themes alone', () => {
    const file = { designSystem: { themes: { default: ds, elegant: ds } } };
    const out = save(file);
    expect(getAt(out, ['designSystem', 'themes', 'elegant'])).toEqual(ds);
  });

  test('still replaces the whole file for a design-system.json', () => {
    expect(save({ ...ds })).toEqual({ colors: patch.colors });
  });
});

describe('setAt', () => {
  test('does not mutate its input — the on-disk object is read once and reused', () => {
    const file = { designSystem: { themes: { default: ds } } };
    const frozen = JSON.stringify(file);
    setAt(file, ['designSystem', 'themes', 'default'], { colors: {} });
    expect(JSON.stringify(file)).toBe(frozen);
  });
});
