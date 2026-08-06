import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DARK_SEL, SYSTEM_DARK_SEL } from './shared.ts';

/**
 * The dark-mode selector exists twice by necessity.
 *
 * `DARK_SEL` here is what the generator emits the dark functional-token flip
 * under. `<wc-theme-editor>` has to write its dark overrides under the *same*
 * selector or they land on a rule the page never matches — and it lives in
 * @getvitops/core, which cannot import this: the dependency runs the other way
 * (generator snapshots core's assets), so an import would be a cycle.
 *
 * Drift here fails silently and asymmetrically: light-mode edits keep working,
 * so the editor looks fine, and only dark-mode edits quietly do nothing. Hence
 * this guard — the same shape as `head.test.ts`'s storage-key check.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const editor = readFileSync(join(HERE, '../../core/src/web-components/WCThemeEditor.ts'), 'utf8');

describe('dark-mode selector', () => {
  it('is matched verbatim by <wc-theme-editor>', () => {
    const declared = /DARK_SELECTOR\s*=\s*'([^']+)'/.exec(editor)?.[1];
    expect(declared, 'WCThemeEditor must declare DARK_SELECTOR').toBeTruthy();
    expect(declared).toBe(DARK_SEL);
  });

  it('covers both the Bricks attribute and the one the toggle writes', () => {
    // Bricks sets data-brx-theme; <wc-color-scheme-toggle> sets data-theme. Dropping
    // either makes the flip unreachable on that target.
    expect(DARK_SEL).toContain('data-brx-theme');
    expect(DARK_SEL).toContain('data-theme');
  });
});

/**
 * The OS-preference block is what makes `<wc-color-scheme-toggle>`'s "System"
 * position mean anything. System *removes* `data-theme`, so with only the
 * explicit-choice block the page fell through to light on every machine — the
 * component shipped a segment that could not do anything.
 *
 * Two properties have to hold, and both fail silently if they don't: it must
 * match when no choice has been made (or System still resolves light), and it
 * must NOT match when the choice is explicitly light (or picking Light on a
 * dark-OS machine would do nothing).
 */
describe('the OS-preference selector', () => {
  it('is derived from DARK_SEL rather than written out again', () => {
    // Both selectors have to name the same two attributes, or one target gets
    // the explicit flip and not the system one.
    for (const attr of ['data-brx-theme', 'data-theme']) {
      expect(DARK_SEL).toContain(attr);
      expect(SYSTEM_DARK_SEL, `${attr} must appear in both`).toContain(attr);
    }
  });

  it('excludes an explicit light choice, and nothing else', () => {
    expect(SYSTEM_DARK_SEL).toBe(':root:not([data-brx-theme="light"]):not([data-theme="light"])');
    // It must not mention "dark" — this block is already inside the dark media
    // query, and requiring the attribute would defeat the whole point.
    expect(SYSTEM_DARK_SEL).not.toContain('dark');
  });

  it('is built from negations only, so a bare <html> matches', () => {
    // The toggle's System position removes the attribute entirely. A selector
    // that REQUIRED one — the obvious mistake, mirroring DARK_SEL's shape —
    // would match nothing in exactly the case this block exists for, and the
    // failure is invisible: the page just stays light.
    const conditions = SYSTEM_DARK_SEL.replace(/^:root/, '').match(/:not\([^)]*\)|\[[^\]]*\]/g);
    expect(conditions).not.toBeNull();
    for (const c of conditions as string[])
      expect(
        c,
        `${c} must be a negation — a bare attribute would exclude an unset document`,
      ).toMatch(/^:not\(/);
  });
});
