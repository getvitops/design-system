import { describe, expect, it } from 'vite-plus/test';
import {
  injectElementPreloads,
  preloadFiles,
  usedTags,
  type ElementManifest,
} from './preload-elements.ts';

const manifest: ElementManifest = {
  'wc-copy': { file: 'elements/wc-copy.js', imports: ['chunks/BaseElement.js'], dependencies: [] },
  'wc-carousel': {
    file: 'elements/wc-carousel.js',
    imports: ['chunks/BaseElement.js', 'chunks/RovingTabindex.js'],
    dependencies: [],
  },
  'wc-gallery': {
    file: 'elements/wc-gallery.js',
    imports: ['chunks/BaseElement.js', 'chunks/keynav.js'],
    dependencies: ['wc-carousel'],
  },
};
const page = (body: string, loader = true) =>
  `<html><head><title>t</title>${loader ? '<script type="module" src="/vitops/loader.js"></script>' : ''}</head><body>${body}</body></html>`;

describe('usedTags', () => {
  it('finds owned tags only, once', () => {
    expect(
      usedTags('<wc-copy></wc-copy><wc-copy a="1"><wc-consent></wc-consent><p></p>', manifest),
    ).toEqual(['wc-copy']);
  });
});

describe('preloadFiles', () => {
  it('includes a dependency and de-duplicates shared chunks', () => {
    expect(preloadFiles(['wc-gallery'], manifest)).toEqual([
      'chunks/BaseElement.js',
      'chunks/RovingTabindex.js',
      'chunks/keynav.js',
      'elements/wc-carousel.js',
      'elements/wc-gallery.js',
    ]);
  });
});

describe('injectElementPreloads', () => {
  it('adds one hint per file before </head>', () => {
    const out = injectElementPreloads(page('<wc-copy></wc-copy>'), manifest, '/vitops');
    expect(out).toContain('href="/vitops/elements/wc-copy.js"');
    expect(out.match(/rel="modulepreload"/g)).toHaveLength(2);
    expect(out.indexOf('modulepreload')).toBeLessThan(out.indexOf('</head>'));
  });
  it('is idempotent', () => {
    const once = injectElementPreloads(page('<wc-copy></wc-copy>'), manifest, '/vitops');
    expect(injectElementPreloads(once, manifest, '/vitops')).toBe(once);
  });
  it('leaves pages without the loader, or without elements, alone', () => {
    const eager = page('<wc-copy></wc-copy>', false);
    expect(injectElementPreloads(eager, manifest, '/vitops')).toBe(eager);
    const none = page('<p>hi</p>');
    expect(injectElementPreloads(none, manifest, '/vitops')).toBe(none);
  });
});
