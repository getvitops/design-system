/**
 * The elements the on-demand loader can fetch: tag → source module, and what each needs besides
 * itself.
 *
 * One table, three readers: `vite.config.ts` turns it into one `dist/elements/<tag>.js` entry per
 * element, `loader.ts` uses the keys to ignore tags it does not own (`wc-consent`, site-local
 * `wc-*`) instead of 404ing on them, and `@getvitops/astro` reads `dist/elements/manifest.json`
 * (emitted from it) to `modulepreload` what a page uses.
 *
 * `dependencies` repeats each class's `static dependencies` so the build can see it without
 * evaluating the class; `element-tags.test.ts` fails when the two disagree, or when this table
 * and `elements.ts` (the eager bundle) list different elements.
 *
 * Not here on purpose: `wc-consent` (must load ahead of everything it gates), `wc-stepper`,
 * `wc-config-form`, `wc-color-field`, `wc-config-preview` and `wc-theme-editor`, each of which has
 * its own entry and loader.
 */
export interface ElementEntry {
  /** File under `src/web-components/`, without `.ts`. */
  readonly source: string;
  /** Other tags this element needs on the page to work (markup it contains or hands off to). */
  readonly dependencies: readonly string[];
}

export const ELEMENTS: Readonly<Record<string, ElementEntry>> = {
  'wc-split-panel': { source: 'WCSplitPanel', dependencies: [] },
  'wc-image-compare': { source: 'WCImageCompare', dependencies: [] },
  'wc-dismissable': { source: 'WCDismissable', dependencies: [] },
  'wc-copy': { source: 'WCCopy', dependencies: [] },
  'wc-carousel': { source: 'WCCarousel', dependencies: [] },
  'wc-entries': { source: 'WCEntries', dependencies: [] },
  'wc-color-scheme-toggle': { source: 'WCColorSchemeToggle', dependencies: [] },
  'wc-contrast-toggle': { source: 'WCContrastToggle', dependencies: [] },
  'wc-multifield': { source: 'WCMultiField', dependencies: [] },
  'wc-marquee': { source: 'WCMarquee', dependencies: [] },
  'wc-tree': { source: 'WCTree', dependencies: [] },
  'wc-cards': { source: 'WCCards', dependencies: [] },
  // The lightbox is server-rendered markup around a `<wc-carousel>`, not created at runtime.
  'wc-gallery': { source: 'WCGallery', dependencies: ['wc-carousel'] },
  'wc-counter': { source: 'WCCounter', dependencies: [] },
  'wc-turnstile': { source: 'WCTurnstile', dependencies: [] },
  'wc-tabs': { source: 'WCTabs', dependencies: [] },
  'wc-combobox': { source: 'WCCombobox', dependencies: [] },
  'wc-format': { source: 'WCFormat', dependencies: [] },
  'wc-range': { source: 'WCRange', dependencies: [] },
  'wc-field': { source: 'WCField', dependencies: [] },
  'wc-notifications': { source: 'WCNotifications', dependencies: [] },
};

export const ELEMENT_TAGS: readonly string[] = Object.keys(ELEMENTS);
