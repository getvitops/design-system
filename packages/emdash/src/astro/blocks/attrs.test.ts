import { describe, expect, it } from 'vite-plus/test';
import { anchorId, blockAttrs, classTokens, customProperties } from './attrs.ts';

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
