import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vite-plus/test';

/**
 * Image priority is zero-sum: boosting an image that is not the Largest Contentful Paint element
 * competes with the one that is. `<Carousel>` and `<Gallery>` used to boost their first image
 * unconditionally, so a gallery near the foot of a page slowed the hero down for nothing.
 *
 * Astro components cannot be imported here, so this reads the source, as `head.test.ts` does for the
 * inline scripts: what breaks is the contract (an opt-in, defaulting to off), not any logic.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(HERE, rel), 'utf8');

describe.each(['Carousel.astro', 'Gallery.astro'])('%s image priority', (file) => {
  const src = read(file);

  it('is an opt-in prop that defaults to off', () => {
    expect(src).toMatch(/priority\?: boolean;/);
    expect(src).toMatch(/\bpriority = false,/);
  });

  it('boosts the first image only when asked', () => {
    expect(src).toContain("loading={priority && i === 0 ? 'eager' : 'lazy'}");
    expect(src).toContain("fetchpriority={priority && i === 0 ? 'high' : undefined}");
  });

  it('never boosts an image unconditionally', () => {
    expect(src).not.toMatch(/fetchpriority=\{i === 0/);
    expect(src).not.toMatch(/loading=\{i === 0/);
    // And it never demotes the rest with `low`: with the boost off they carry no hint at all.
    expect(src).not.toContain("'low'");
  });
});

describe('the EmDash hero block', () => {
  it('gives its eager image a high fetch priority, since it is the likely LCP element', () => {
    const hero = readFileSync(
      join(HERE, '..', '..', '..', 'emdash', 'src', 'astro', 'blocks', 'Hero.astro'),
      'utf8',
    );
    expect(hero).toContain('loading="eager" fetchpriority="high"');
  });
});
