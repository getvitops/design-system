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
const CLASS_VALUE = /\bclass\s*=\s*(["'])([^"']*)\1/;

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

/** Remove the `centered` token from every `<main>` that has it. Other classes stay. */
export function fixMainLayout(text: string): string {
  return text.replace(MAIN_TAG, (tag) =>
    hasCentered(tag)
      ? tag
          .replace(CLASS_VALUE, (_all, q: string, value: string) => {
            const kept = value.split(/\s+/).filter((c) => c && c !== 'centered');
            return kept.length ? `class=${q}${kept.join(' ')}${q}` : '';
          })
          .replace(/\s+>/, '>')
      : tag,
  );
}
