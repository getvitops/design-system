import type { IconifyJSON } from '@iconify/types';
import { describe, expect, it } from 'vitest';
import { buildIconSprite, spriteId } from './icons-sprite.ts';

/**
 * The collection JSONs are optional peers (@iconify-json/ph alone is ~4.5 MB),
 * so every test injects `loadSet` rather than installing one. That is the same
 * reason the emitter takes the seam in the first place.
 */
const fakeSet = (): IconifyJSON => ({
  prefix: 'test',
  icons: {
    // Two icons deliberately sharing an internal id, to prove replaceIDs ran.
    alpha: {
      body: '<defs><linearGradient id="g"/></defs><path fill="url(#g)" d="M0 0h24v24H0z"/>',
    },
    beta: {
      body: '<defs><linearGradient id="g"/></defs><path fill="url(#g)" d="M4 4h16v16H4z"/>',
    },
    plain: { body: '<path d="M1 1h2v2H1z"/>' },
  },
  aliases: {
    // An alias inside the set itself — getIconData must follow it.
    'alpha-alias': { parent: 'alpha' },
  },
  width: 24,
  height: 24,
});

const load = async (prefix: string) => (prefix === 'test' ? fakeSet() : null);

describe('spriteId', () => {
  it('replaces the prefix separator with a double dash', () => {
    // Icon.astro mirrors this; icon.test.ts guards the pair. A drift here makes
    // <use> resolve to nothing, which renders as an empty box rather than error.
    expect(spriteId('ph:caret-down')).toBe('ph--caret-down');
    expect(spriteId('simple-icons:zoho')).toBe('simple-icons--zoho');
  });
});

describe('buildIconSprite', () => {
  it('emits one hidden <symbol> per icon', async () => {
    const r = await buildIconSprite({ include: { test: ['plain'] }, loadSet: load });
    expect(r.ids).toEqual(['test--plain']);
    expect(r.svg).toContain('<symbol id="test--plain"');
    expect(r.svg).toContain('style="display:none"');
    expect(r.svg).toContain('aria-hidden="true"');
    expect(r.missing).toEqual([]);
  });

  it('carries a viewBox on every symbol', async () => {
    // Without it the symbol has no intrinsic coordinate system and <use> renders
    // at the wrong scale.
    const r = await buildIconSprite({ include: { test: ['plain'] }, loadSet: load });
    expect(r.svg).toMatch(/<symbol id="test--plain" viewBox="[^"]+"/);
  });

  it('resolves the set’s own aliases', async () => {
    const r = await buildIconSprite({ include: { test: ['alpha-alias'] }, loadSet: load });
    expect(r.ids).toEqual(['test--alpha-alias']);
    expect(r.missing).toEqual([]);
  });

  it('rewrites internal ids so two icons cannot cross-render', async () => {
    // The failure this prevents is silent: concatenated into one document, the
    // second icon's `url(#g)` would resolve to the FIRST icon's gradient.
    const r = await buildIconSprite({ include: { test: ['alpha', 'beta'] }, loadSet: load });
    const ids = [...r.svg.matchAll(/<linearGradient id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size, 'both gradients must end up with distinct ids').toBe(2);
    expect(ids).not.toContain('g');
  });

  it('reports missing icons without throwing', async () => {
    // One bad name in a long include list should not cost the whole sprite.
    const r = await buildIconSprite({ include: { test: ['plain', 'nope'] }, loadSet: load });
    expect(r.missing).toEqual(['test:nope']);
    expect(r.ids).toEqual(['test--plain']);
  });

  it('throws a message naming the package to install for a missing set', async () => {
    await expect(buildIconSprite({ include: { ph: ['list'] }, loadSet: load })).rejects.toThrow(
      /@iconify-json\/ph/,
    );
  });

  it('duplicates an aliased body rather than nesting a <use>', async () => {
    // Nested <use href="#target"> inside a <symbol> is legal but unreliable
    // precisely under an EXTERNAL-file <use>, which is how this sprite is served.
    const r = await buildIconSprite({
      include: { test: ['plain'] },
      aliases: { 'icon-check': 'test:plain' },
      loadSet: load,
    });
    expect(r.ids).toEqual(['test--plain', 'icon-check']);
    expect(r.svg).toContain('<symbol id="icon-check"');
    expect(r.svg).not.toContain('<use');
    // Same path, emitted twice.
    expect(r.svg.match(/M1 1h2v2H1z/g)).toHaveLength(2);
  });

  it('reports an alias pointing at an icon that was not included', async () => {
    const r = await buildIconSprite({
      include: { test: ['plain'] },
      aliases: { 'icon-x': 'test:absent' },
      loadSet: load,
    });
    expect(r.missing).toEqual(['test:absent (aliased as icon-x)']);
  });

  it('skips empty lists without loading the set', async () => {
    let calls = 0;
    const counting = async (p: string) => (calls++, p === 'test' ? fakeSet() : null);
    const r = await buildIconSprite({ include: { test: [], ph: [] }, loadSet: counting });
    expect(calls).toBe(0);
    expect(r.ids).toEqual([]);
  });
});
