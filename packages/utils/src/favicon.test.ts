import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { faviconLinks, faviconManifest, generateFavicons } from './favicon.ts';

describe('faviconLinks', () => {
  it('emits the base set at site root, no svg link by default', () => {
    const links = faviconLinks();
    expect(links).toContainEqual({ rel: 'icon', href: '/favicon.ico', sizes: '32x32' });
    expect(links).toContainEqual({
      rel: 'icon',
      type: 'image/png',
      sizes: '32x32',
      href: '/icon-32.png',
    });
    expect(links).toContainEqual({ rel: 'apple-touch-icon', href: '/apple-touch-icon.png' });
    expect(links).toContainEqual({ rel: 'manifest', href: '/site.webmanifest' });
    expect(links.some((l) => l.type === 'image/svg+xml')).toBe(false);
  });

  it('includes the svg link only when hasSvg', () => {
    const links = faviconLinks({ hasSvg: true });
    expect(links).toContainEqual({ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' });
  });

  it('omits the manifest link when manifest:false', () => {
    const links = faviconLinks({ manifest: false });
    expect(links.some((l) => l.rel === 'manifest')).toBe(false);
  });

  it('honors a URL base', () => {
    const links = faviconLinks({ base: '/assets/' });
    expect(links[0]?.href).toBe('/assets/favicon.ico');
  });
});

describe('faviconManifest', () => {
  it('builds a PWA manifest with 192/512 + maskable icons', () => {
    const m = faviconManifest({ name: 'Vitops', themeColor: '#2f6f5e', backgroundColor: '#000' });
    expect(m.name).toBe('Vitops');
    expect(m.short_name).toBe('Vitops'); // defaults to name
    expect(m.theme_color).toBe('#2f6f5e');
    expect(m.background_color).toBe('#000');
    expect(m.display).toBe('standalone');
    const icons = m.icons as Array<Record<string, string>>;
    expect(icons.map((i) => i.sizes)).toEqual(['192x192', '512x512', '512x512']);
    expect(icons.find((i) => i.purpose === 'maskable')?.src).toBe('/icon-mask.png');
  });
});

/**
 * The maskable outputs must be OPAQUE.
 *
 * `icon-mask.png` is declared `purpose: "maskable"` and `apple-touch-icon.png` is
 * linked unconditionally; both sit a deliberately-inset logo on a larger canvas,
 * which IS the maskable safe zone and is correct. But that canvas used to be
 * filled with `alpha: 0`, so 36% of one and 40% of the other were transparent —
 * and maskable means the OS crops to its own shape and composites the rest onto
 * whatever it likes, usually black. iOS discards alpha outright.
 *
 * `backgroundColor` existed and reached only the web manifest, so the raster and
 * the manifest disagreed about the very colour meant to sit behind the icon.
 */
describe('generateFavicons transparency', () => {
  const fixture = join(tmpdir(), `vitops-favicon-${process.pid}`);
  const SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<circle cx="50" cy="50" r="40" fill="#2e9b73"/></svg>';

  const run = async (opts: Record<string, unknown>, dir: string) => {
    mkdirSync(fixture, { recursive: true });
    const source = join(fixture, 'logo.svg');
    writeFileSync(source, SVG);
    const warnings: string[] = [];
    const real = console.warn;
    console.warn = (...a: unknown[]) => void warnings.push(a.join(' '));
    try {
      await generateFavicons({ source, outputDir: join(fixture, dir), optimize: false, ...opts });
    } finally {
      console.warn = real;
    }
    return { warnings, out: (f: string) => join(fixture, dir, f) };
  };
  const isOpaque = async (file: string) =>
    (await (await import('sharp')).default(file).stats()).isOpaque;

  it('makes both maskable outputs opaque and leaves the rest alone', async () => {
    const { out } = await run({}, 'a');
    expect(await isOpaque(out('icon-mask.png')), 'icon-mask must be opaque').toBe(true);
    expect(await isOpaque(out('apple-touch-icon.png')), 'apple-touch-icon must be opaque').toBe(
      true,
    );
    // These are not maskable — transparency is correct for them.
    expect(await isOpaque(out('icon-512.png'))).toBe(false);
    expect(await isOpaque(out('icon-32.png'))).toBe(false);
  }, 30_000);

  it('warns when it has to invent the background colour', async () => {
    const { warnings } = await run({}, 'b');
    expect(warnings.join('\n')).toMatch(/has transparency/);
    expect(warnings.join('\n')).toContain('#ffffff');
  }, 30_000);

  it('composites the given colour, and then says nothing', async () => {
    const { warnings, out } = await run({ backgroundColor: '#0d3b2b' }, 'c');
    expect(warnings.filter((w) => w.includes('transparency'))).toEqual([]);
    const sharp = (await import('sharp')).default;
    const px = await sharp(out('icon-mask.png'))
      .extract({ left: 0, top: 0, width: 2, height: 2 })
      .raw()
      .toBuffer();
    expect([px[0], px[1], px[2]]).toEqual([0x0d, 0x3b, 0x2b]);
  }, 30_000);

  it('rejects a background that is not a hex colour', async () => {
    await expect(run({ backgroundColor: 'rebeccapurple' }, 'd')).rejects.toThrow(/hex colour/);
  }, 30_000);

  afterAll(() => rmSync(fixture, { recursive: true, force: true }));
});
