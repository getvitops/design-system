import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The carousel styles its navigation twice — once for the native
 * `::scroll-button()` / `::scroll-marker` pseudo-elements, once for the real
 * elements `WCCarousel` builds where those are missing — and the two must look and
 * behave identically.
 *
 * They cannot be one selector list. A selector list is **not** forgiving, so one
 * unparseable complex selector drops the whole rule: in Firefox,
 * `.carousel__button, …::scroll-button(*) { … }` would take the fallback button's
 * styling down with the pseudo-element that engine doesn't know. `:is()` is no
 * rescue either — it cannot contain pseudo-elements.
 *
 * So the duplication is deliberate, and this is what stops it drifting. Without a
 * guard the fallback silently stops matching the native path, which nobody notices
 * because each looks fine in the browser they happen to be testing in — the same
 * class of bug `format-parity.test.ts` exists to catch across output formats.
 *
 * Read from the repo's own source rather than the generator's `assets/` snapshot,
 * so this runs in a clean checkout before any build.
 */
const SOURCE = readFileSync(
  join(
    import.meta.dirname,
    '..',
    '..',
    '..',
    'packages',
    'core',
    'css',
    'patterns',
    'carousel.css',
  ),
  'utf8',
);

/**
 * Comments out, once, for everything below.
 *
 * This file's comments are long and quote the very declarations under test — the
 * `::scroll-button()` block explains Chrome's UA `padding: 1px 6px`, and the
 * docblock explains why `anchor-name` was removed. Left in, a comment both swallows
 * the declaration that follows it (everything up to the next `;` is one fragment)
 * and makes the "no anchor positioning" assertion fail on prose.
 */
const CSS = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Declaration property names in the first rule whose selector line contains
 * `marker`, up to the first nested block or the rule's close.
 *
 * A deliberately small parser: it reads only the flat declarations at the top of a
 * block, which is exactly where both paths declare their geometry, and stops at the
 * first `{` so nested `&:hover` / `&[aria-selected]` blocks are excluded. A real CSS
 * parser here would be a dependency for one assertion.
 */
function declarationsAfter(marker: string): string[] {
  const start = CSS.indexOf(marker);
  expect(start, `selector not found in carousel.css: ${marker}`).toBeGreaterThan(-1);
  const open = CSS.indexOf('{', start);
  const body = CSS.slice(open + 1);
  const end = Math.min(
    ...[body.indexOf('{'), body.indexOf('}')].filter((i) => i > -1).concat([body.length]),
  );
  return (
    body
      .slice(0, end)
      .split(';')
      .map((decl) => decl.split(':')[0]?.trim() ?? '')
      // The tail after the last `;` is the start of the first nested selector
      // (`&:hover`), not a declaration.
      .filter((name) => /^[a-z-]+$/.test(name))
      .sort()
  );
}

describe('carousel fallback/native parity', () => {
  it('styles the fallback prev/next exactly as it styles ::scroll-button()', () => {
    const fallback = declarationsAfter('\n.carousel__button {');
    // Non-vacuity: two empty lists would compare equal and assert nothing, which
    // is how a parser this small stops earning its keep after a refactor.
    expect(fallback.length).toBeGreaterThan(10);
    expect(fallback).toEqual(declarationsAfter('&::scroll-button(*) {'));
  });

  it('styles the fallback dot exactly as it styles ::scroll-marker', () => {
    // The native rule carries `content: ''` — a pseudo-element with no content
    // generates no box — which a real <button> neither needs nor can have.
    const native = declarationsAfter('> *::scroll-marker {').filter((name) => name !== 'content');
    expect(declarationsAfter('\n.carousel__marker {')).toEqual(native);
  });

  it('keeps both control paths free of anchor positioning', () => {
    // `position: fixed` + `anchor-name` / `position-area` pinned the controls to a
    // viewport corner in any engine without anchor positioning — and the oddbird
    // polyfill reaches neither `position-area` nor a pseudo-element anchor, so it
    // never rescued them. The shell is `position: relative`; absolute is enough.
    expect(CSS).not.toMatch(/anchor-name|position-area|position-anchor/);
  });

  it('declares the feature probe exactly once per flag', () => {
    // WCCarousel reads these back rather than re-running CSS.supports. Two
    // declarations of a flag would mean two conditions to keep in step.
    expect(CSS.match(/--carousel-native-nav: 1/g)).toHaveLength(1);
    expect(CSS.match(/--carousel-scroll-timeline: 1/g)).toHaveLength(1);
  });
});
