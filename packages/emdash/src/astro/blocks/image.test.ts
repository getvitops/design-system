import { describe, expect, it } from 'vite-plus/test';
import {
  absoluteMediaUrl,
  parseRatio,
  resolveImageOrigin,
  srcsetWidths,
  transformBlockImage,
  warnImageFallback,
  type GetImage,
} from './image.ts';

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

describe('transformBlockImage', () => {
  const ok: GetImage = async ({ src }) => ({
    src: `/_image?href=${encodeURIComponent(src)}&f=avif`,
    srcSet: { attribute: '/_image?w=640 640w, /_image?w=960 960w' },
  });
  const unchanged: GetImage = async ({ src }) => ({ src, srcSet: { attribute: '' } });

  it('returns a srcset with the stated box', async () => {
    const result = await transformBlockImage({
      src: '/_emdash/api/media/file/a.jpg',
      ratio: 4 / 5,
      displayWidth: 960,
      origin: 'https://gofitness.ca',
      getImage: ok,
    });
    expect(result).toMatchObject({ image: { width: 960, height: 1200 } });
  });
  it('names the reason when the origin is not authorized', async () => {
    expect(
      await transformBlockImage({
        src: '/m/a.jpg',
        ratio: 1,
        displayWidth: 600,
        origin: 'http://localhost:4321',
        getImage: unchanged,
      }),
    ).toEqual({ reason: 'unauthorized-origin' });
  });
  it('names the reason when the service throws or the src is relative with no origin', async () => {
    const boom: GetImage = async () => {
      throw new Error('no service');
    };
    expect(
      await transformBlockImage({
        src: '/m/a.jpg',
        ratio: 1,
        displayWidth: 600,
        origin: 'https://x.ca',
        getImage: boom,
      }),
    ).toEqual({ reason: 'transform-failed' });
    expect(
      await transformBlockImage({
        src: '/m/a.jpg',
        ratio: 1,
        displayWidth: 600,
        origin: undefined,
        getImage: ok,
      }),
    ).toEqual({ reason: 'not-absolute' });
  });
});

describe('resolveImageOrigin / warnImageFallback', () => {
  it('prefers siteUrl, then env, then site, then the request', () => {
    const base = { requestOrigin: 'http://localhost' };
    expect(resolveImageOrigin({ ...base, siteUrl: 'a', env: 'b', site: 'c' })).toBe('a');
    expect(resolveImageOrigin({ ...base, env: 'b', site: 'c' })).toBe('b');
    expect(resolveImageOrigin({ ...base, site: 'c' })).toBe('c');
    expect(resolveImageOrigin(base)).toBe('http://localhost');
  });
  it('warns once per origin and reason', () => {
    const lines: string[] = [];
    warnImageFallback('unauthorized-origin', '/a.jpg', 'http://t1', (m) => lines.push(m));
    warnImageFallback('unauthorized-origin', '/b.jpg', 'http://t1', (m) => lines.push(m));
    warnImageFallback('not-absolute', '/b.jpg', 'http://t1', (m) => lines.push(m));
    expect(lines).toHaveLength(1);
  });
});
