/**
 * `<main class="centered">`: the page landmark used as a layout.
 *
 * `main` is a landmark, not a layout. Making it the reading-width `.centered` grid puts every
 * child in the narrow measure track, so a section, band or hero inside it cannot give its tone or
 * backdrop the viewport without opting out of the page it sits in (the template used to patch that
 * with `grid-column: fullbleed` rules). A band owns its own width instead, and plain content takes
 * its own `.centered` wrapper (`<VitopsContent>` adds one around the text between bands).
 *
 * The finding is an error, not a suggestion: every site scaffolded before 9.0 has this line in
 * its layout. `--fix` removes the class from `<main>` and nothing else, because wrapping a site's
 * hand-written page content is a per-page decision. The message says what to do about it.
 */
import type { LintFinding } from './lint.ts';

const EXT = /\.(astro|html|htm|jsx|tsx|vue|svelte)$/;
/** A `<main …>` opening tag whose literal `class="…"` carries the `centered` token. */
const MAIN_TAG = /<main\b[^>]*>/g;
/** A `<SiteFooter …>` opening tag. The footer owns its own `.centered` row (`width="content"`). */
const FOOTER_TAG = /<SiteFooter\b[^>]*>/g;
const CLASS_VALUE = /\bclass\s*=\s*(["'])([^"']*)\1/;
/** The same attribute with its leading whitespace, so dropping it leaves no gap. */
const CLASS_WITH_SPACE = /(\s+)\bclass\s*=\s*(["'])([^"']*)\2/;

/** The `cls` values this file reports, so a summary can name them as layout errors. */
export const LAYOUT_RULES: ReadonlySet<string> = new Set(['main.centered', 'SiteFooter.centered']);

function hasCentered(tag: string): boolean {
  const m = CLASS_VALUE.exec(tag);
  return Boolean(m && m[2]!.split(/\s+/).includes('centered'));
}

export function lintMainLayout(files: { path: string; text: string }[]): LintFinding[] {
  const out: LintFinding[] = [];
  for (const f of files) {
    if (!EXT.test(f.path)) continue;
    for (const m of f.text.matchAll(MAIN_TAG)) {
      if (!hasCentered(m[0])) continue;
      out.push({
        file: f.path,
        line: f.text.slice(0, m.index).split('\n').length,
        cls: 'main.centered',
        severity: 'error',
        reason:
          '`<main>` is a landmark, not a layout: `.centered` on it holds every section and band to the reading width, so their backgrounds stop at the text column.',
        suggestion:
          'remove `centered` from <main> (`vitops lint --fix` does), then give hand-written page content its own `<div class="centered">`; `<VitopsContent>` already wraps the text between bands',
      });
    }
  }
  return out;
}

function removeCentered(text: string, re: RegExp): string {
  return text.replace(re, (tag) =>
    hasCentered(tag)
      ? tag.replace(CLASS_WITH_SPACE, (_all, lead: string, q: string, value: string) => {
          const kept = value.split(/\s+/).filter((c) => c && c !== 'centered');
          return kept.length ? `${lead}class=${q}${kept.join(' ')}${q}` : '';
        })
      : tag,
  );
}

/** Remove the `centered` token from every `<main>` and `<SiteFooter>` that has it. Other classes stay. */
export function fixMainLayout(text: string): string {
  return removeCentered(removeCentered(text, MAIN_TAG), FOOTER_TAG);
}

/**
 * `<SiteFooter class="centered">`: the old starter put it there, and `.sitefooter`'s own layout
 * cancelled it, so the footer sat against the viewport edge. 9.0 renders the `.centered` row inside
 * the footer (`width="content"`), so the class on the footer is dead weight.
 */
export function lintFooterLayout(files: { path: string; text: string }[]): LintFinding[] {
  const out: LintFinding[] = [];
  for (const f of files) {
    if (!EXT.test(f.path)) continue;
    for (const m of f.text.matchAll(FOOTER_TAG)) {
      if (!hasCentered(m[0])) continue;
      out.push({
        file: f.path,
        line: f.text.slice(0, m.index).split('\n').length,
        cls: 'SiteFooter.centered',
        severity: 'error',
        reason:
          '`<SiteFooter>` owns its `.centered` row; the class on the footer itself loses to `.sitefooter` and drops the gutters.',
        suggestion:
          'remove `centered` from <SiteFooter> (`vitops lint --fix` does); use `width="full"` for an edge-to-edge footer',
      });
    }
  }
  return out;
}
