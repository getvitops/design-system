import { describe, expect, it } from 'vite-plus/test';
import { anchorId, blockAttrs, classTokens, customProperties, rootAttrs } from './attrs.ts';

describe('anchorId', () => {
  it('slugifies and accepts a clean id', () => {
    expect(anchorId('Contact Us')).toBe('contact-us');
    expect(anchorId('contact')).toBe('contact');
  });
  it('rejects what cannot be an id', () => {
    expect(anchorId('')).toBeUndefined();
    expect(anchorId('9lives')).toBeUndefined();
    expect(anchorId(42)).toBeUndefined();
  });
});

describe('classTokens', () => {
  it('keeps valid tokens, drops the rest', () => {
    expect(classTokens('mt-4  md:flex "x" <b>')).toBe('mt-4 md:flex');
  });
  it('is undefined when nothing survives', () => {
    expect(classTokens('"><script>')).toBeUndefined();
  });
});

describe('customProperties', () => {
  it('keeps custom properties', () => {
    expect(customProperties('--p-card: 3rem; --gap: 1rem')).toBe('--p-card: 3rem; --gap: 1rem');
  });
  it('drops ordinary properties and fetching values', () => {
    expect(
      customProperties('background: url(x); --a: url(https://x/y); display: none'),
    ).toBeUndefined();
    expect(customProperties('--a: 1px; position: fixed')).toBe('--a: 1px');
  });
  it('rejects values that try to leave the declaration', () => {
    expect(customProperties('--a: red}</style><script>')).toBeUndefined();
    expect(customProperties('--a: \\75rl(x)')).toBeUndefined();
  });
});

describe('blockAttrs', () => {
  it('is empty for a block that sets nothing', () => {
    expect(blockAttrs({})).toEqual({});
    expect(blockAttrs(undefined)).toEqual({});
  });
  it('reads the block-type spelling too', () => {
    expect(blockAttrs({ class_name: 'mt-4' })).toEqual({ class: 'mt-4' });
  });
  it('collects the three fields', () => {
    expect(blockAttrs({ anchor: 'services', className: 'mt-4', style: '--p-card: 2rem' })).toEqual({
      id: 'services',
      class: 'mt-4',
      style: '--p-card: 2rem',
    });
  });
});

describe('theme on every block', () => {
  it('adds the tinted classes and --tone-* properties to the root', () => {
    const a = rootAttrs({ theme: 'surface' }, ['callout']);
    expect(a.class).toBe('callout tone tone--tint');
    expect(a.style).toContain('--tone-bg: var(--color-bg-surface-muted');
  });
  it('fills with the role solid and its computed text for `<role>:solid`', () => {
    const a = rootAttrs({ theme: 'brand-primary:solid' }, ['hero']);
    expect(a.class).toBe('hero tone tone--solid');
    expect(a.style).toContain('--tone-on-solid: var(--color-text-on-brand-primary');
  });
  it("replaces a block's own tone classes rather than doubling them, and is inert for none", () => {
    expect(rootAttrs({ theme: 'info' }, ['x', 'tone', 'tone--solid']).class).toBe(
      'x tone tone--tint',
    );
    expect(rootAttrs({ theme: 'none' }, ['x', 'tone']).class).toBe('x tone');
    expect(rootAttrs({ theme: 'bad role!' }, ['x']).class).toBe('x');
  });
});
