import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Drift guards over the two inline `<head>` scripts in `<Head />`.
 *
 * They can't be imported — they live in an `.astro` frontmatter — so this reads
 * the source. That is enough for what actually breaks here, which is not the
 * scripts' logic but their *presence and contract*: both were documented in
 * three other files while one of them didn't exist at all, having been dropped
 * in the move to publishable packages. The cost of that is silent and remote
 * (scroll-driven content invisible on Firefox), so it needs a test that fails
 * loudly at home.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, 'components', 'Head.astro'), 'utf8');

describe('THEME_SCRIPT', () => {
  it('uses the same localStorage key as WCColorSchemeToggle', () => {
    // `WCColorSchemeToggle.STORAGE_KEY` in @getvitops/core. If these drift, the
    // pre-paint script reads nothing and every dark-mode page flashes light.
    expect(SRC).toContain("localStorage.getItem('vitops-color-scheme')");
  });

  it('applies the scheme before paint, not after hydration', () => {
    expect(SRC).toContain('document.documentElement.dataset.theme');
    expect(SRC).toContain('colorScheme');
  });
});

describe('<html> class flags', () => {
  it('sets none — the CSS asks the platform instead', () => {
    // `animation.css` gates on `@media (scripting: enabled)` and
    // `@supports not (animation-timeline: view())`, so there is nothing to flip
    // before paint. Re-adding a flag here would quietly narrow the fix to pages
    // that render <Head />: Bricks sites and consumers with their own <head>
    // would go back to trigger animations stuck at `opacity: 0`, and `no-js` in
    // particular needs a class in an <html> tag Astro does not own.
    // `packages/generator/src/js-detection.test.ts` guards the CSS end.
    //
    // Matched on the mechanism, not the class names: the comment above the
    // component names both to explain their absence, so a bare substring check
    // would trip on its own documentation.
    expect(SRC).not.toContain('classList');
  });
});
