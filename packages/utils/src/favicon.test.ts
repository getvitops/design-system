import { describe, expect, it } from 'vitest';
import { faviconLinks, faviconManifest } from './favicon.ts';

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
