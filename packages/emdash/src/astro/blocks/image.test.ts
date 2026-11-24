import { describe, expect, it } from 'vite-plus/test';
import { absoluteMediaUrl, parseRatio, srcsetWidths } from './image.ts';

describe('parseRatio', () => {
  it.each([
    ['16:9', 16 / 9],
    ['16/9', 16 / 9],
    ['1200x800', 1.5],
    [' 4 : 3 ', 4 / 3],
    ['1.5', 1.5],
    [1.5, 1.5],
  ])('reads %j', (input, expected) => {
    expect(parseRatio(input)).toBeCloseTo(expected);
  });

  it.each(['', 'wide', '16:0', '0:9', '100:1', '1:100', '-1', null, undefined, {}, Number.NaN])(
    'rejects %j',
    (input) => {
      expect(parseRatio(input)).toBeUndefined();
    },
  );
});

describe('srcsetWidths', () => {
  it('takes every breakpoint up to 2x the display width, plus the width itself', () => {
    expect(srcsetWidths(400)).toEqual([400, 640, 750]);
    expect(srcsetWidths(1200)).toEqual([640, 750, 828, 960, 1080, 1200, 1280, 1600, 1920]);
  });

  it('does not go past the largest breakpoint except for the display width', () => {
    expect(srcsetWidths(1920)).toEqual([640, 750, 828, 960, 1080, 1280, 1600, 1920]);
  });

  it('is empty for a width that is not a positive number', () => {
    expect(srcsetWidths(0)).toEqual([]);
    expect(srcsetWidths(Number.NaN)).toEqual([]);
  });
});

describe('absoluteMediaUrl', () => {
  const origin = 'https://example.com';

  it('resolves a root-relative media path against the origin', () => {
    expect(absoluteMediaUrl('/_emdash/api/media/file/a.jpg', origin)).toBe(
      'https://example.com/_emdash/api/media/file/a.jpg',
    );
  });

  it('leaves absolute URLs, a missing origin and non-paths alone', () => {
    expect(absoluteMediaUrl('https://cdn.test/a.jpg', origin)).toBe('https://cdn.test/a.jpg');
    expect(absoluteMediaUrl('/a.jpg', undefined)).toBe('/a.jpg');
    expect(absoluteMediaUrl('data:image/png;base64,AA', origin)).toBe('data:image/png;base64,AA');
  });

  it('refuses a path that leaves the origin', () => {
    expect(absoluteMediaUrl('//evil.test/a.jpg', origin)).toBe('//evil.test/a.jpg');
    expect(absoluteMediaUrl('/\\evil.test/a.jpg', origin)).toBe('/\\evil.test/a.jpg');
  });
});
