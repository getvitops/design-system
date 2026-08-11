import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * `WCTree.ts`'s expansion state has two channels — `aria-expanded` (the a11y
 * mirror) and the nested group's `hidden` (`"until-found"`/absent — the visual
 * source of truth) — and `filter()` has a third, entirely separate one (plain
 * boolean `hidden` on `.tree__item`). `#setExpanded` and `#setHidden` are meant
 * to be the ONLY writers of their respective channels; every other method is
 * supposed to call them rather than touch the attributes directly, which is
 * what keeps the two `hidden` channels from colliding with each other. A
 * docblock convention says so, but nothing enforces it — this is that
 * enforcement, in the same source-grep style `tiers.test.ts` uses for the
 * `wc-*` prefix rule.
 *
 * The one documented exception is `#onBeforeMatch`, which mirrors a
 * browser-driven reveal onto `aria-expanded` without touching `hidden` at
 * all — it must not go through `#setExpanded`, which would ALSO write
 * `hidden` and race the browser's own removal of it. It is named here
 * explicitly rather than exempted by a broad pattern.
 */

const FILE = fileURLToPath(new URL('./WCTree.ts', import.meta.url));
const SOURCE = readFileSync(FILE, 'utf8');
const LINES = SOURCE.split('\n');

/**
 * The line range of a method body — either `#name(...) {` or the class-field
 * arrow-function form `#name = (...) => {`, both used in this file — found by
 * brace-depth counting from the signature line. Throws if the method can't be
 * found, so a rename breaks this test loudly rather than silently going blind.
 */
function methodBody(name: string): { start: number; end: number } {
  const startIndex = LINES.findIndex((line) => new RegExp(`^\\s*${name}\\s*[(=]`).test(line));
  if (startIndex < 0) throw new Error(`method ${name} not found in ${FILE}`);
  let depth = 0;
  let seenOpenBrace = false;
  for (let i = startIndex; i < LINES.length; i++) {
    const line = LINES[i]!;
    for (const ch of line) {
      if (ch === '{') {
        depth++;
        seenOpenBrace = true;
      } else if (ch === '}') {
        depth--;
      }
    }
    if (seenOpenBrace && depth === 0) return { start: startIndex, end: i };
  }
  throw new Error(`unterminated method body for ${name} in ${FILE}`);
}

/** Every 1-indexed line number whose text matches `pattern`. */
function matchingLines(pattern: RegExp): number[] {
  const lines: number[] = [];
  LINES.forEach((line, i) => {
    if (pattern.test(line)) lines.push(i);
  });
  return lines;
}

function isWithin(lineIndex: number, range: { start: number; end: number }): boolean {
  return lineIndex >= range.start && lineIndex <= range.end;
}

describe('WCTree.ts single-writer invariants', () => {
  it('#setExpanded and #setHidden both exist (this test is watching real methods)', () => {
    expect(() => methodBody('#setExpanded')).not.toThrow();
    expect(() => methodBody('#setHidden')).not.toThrow();
  });

  it('the nested group\'s "until-found" hidden channel is only ever touched inside #setExpanded', () => {
    const setExpanded = methodBody('#setExpanded');
    const offenders = matchingLines(/\.(setAttribute|removeAttribute)\(['"]hidden['"]/).filter(
      (line) => !isWithin(line, setExpanded),
    );
    expect(
      offenders.map((i) => `${i + 1}: ${LINES[i]!.trim()}`),
      'every hidden-attribute write outside #setExpanded is a channel collision waiting to happen',
    ).toEqual([]);
  });

  it("filter's plain boolean hidden channel is only ever touched inside #setHidden", () => {
    const setHidden = methodBody('#setHidden');
    // `.hidden` assignment (not a read, not a comparison) — the IDL setter.
    const offenders = matchingLines(/\.hidden\s*=(?!=)/).filter(
      (line) => !isWithin(line, setHidden),
    );
    expect(
      offenders.map((i) => `${i + 1}: ${LINES[i]!.trim()}`),
      'every .hidden assignment outside #setHidden bypasses the single writer',
    ).toEqual([]);
  });

  it('aria-expanded is only ever written inside #setExpanded or the documented #onBeforeMatch exception', () => {
    const setExpanded = methodBody('#setExpanded');
    const onBeforeMatch = methodBody('#onBeforeMatch');
    const offenders = matchingLines(/\.setAttribute\(['"]aria-expanded['"]/).filter(
      (line) => !isWithin(line, setExpanded) && !isWithin(line, onBeforeMatch),
    );
    expect(
      offenders.map((i) => `${i + 1}: ${LINES[i]!.trim()}`),
      'aria-expanded has two legitimate writers — #setExpanded and the beforematch mirror — and no others',
    ).toEqual([]);
  });
});
