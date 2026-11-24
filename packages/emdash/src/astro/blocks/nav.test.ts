import { describe, expect, it } from 'vite-plus/test';
import { menuName, navDepth, navId, navLabel, navVariant } from './nav.ts';

describe('menuName', () => {
  it('accepts an EmDash menu slug', () => {
    expect(menuName('footer-sitemap')).toBe('footer-sitemap');
    expect(menuName(' primary ')).toBe('primary');
  });

  it('refuses anything that is not a slug, so it never reaches getMenu()', () => {
    for (const bad of ['', '  ', '../x', 'a b', '<b>', 'a/b', '-lead', 'x'.repeat(65), 7, null])
      expect(menuName(bad), String(bad)).toBeNull();
  });
});

describe('navVariant / navDepth', () => {
  it('falls back to a plain list and one level', () => {
    expect(navVariant('nope')).toBe('list');
    expect(navVariant(undefined)).toBe('list');
    expect(navDepth(undefined)).toBe(1);
    expect(navDepth('abc')).toBe(1);
  });

  it('keeps the four variants and clamps depth to 1-3', () => {
    for (const v of ['list', 'inline', 'columns', 'sitenav']) expect(navVariant(v)).toBe(v);
    expect([navDepth('2'), navDepth(3), navDepth('9'), navDepth(0)]).toEqual([2, 3, 3, 1]);
  });
});

describe('navLabel: a unique landmark name', () => {
  it('prefers the label, then the heading, then the menu label, then the name', () => {
    expect(navLabel('Services', 'Heading', 'Menu label', 'm')).toBe('Services');
    expect(navLabel('', 'Heading', 'Menu label', 'm')).toBe('Heading');
    expect(navLabel('', '', 'Menu label', 'm')).toBe('Menu label');
    expect(navLabel('', '', '', 'm')).toBe('m');
  });

  it('never repeats a name the header or footer landmark already carries', () => {
    // <SiteNav> is "Primary"; <SiteFooter> is "Site map" and "Legal".
    for (const taken of ['Primary', 'primary', 'Site map', 'Legal'])
      expect(navLabel(taken, '', '', 'x')).toBe(`${taken} (this page)`);
  });
});

describe('navId', () => {
  it('is DOM-id safe and prefers the block key so two blocks of one menu stay apart', () => {
    expect(navId('abc_123', 'primary')).toBe('navblock-abc-123');
    expect(navId(undefined, 'Footer Sitemap')).toBe('navblock-footer-sitemap');
    expect(navId('', '')).toBe('navblock-x');
  });
});
