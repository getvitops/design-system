/**
 * `vitops lint` — find pre-1.0 colour-grammar token references in consumer
 * source, and rewrite them.
 *
 * The class linter (`lint.ts`) reads `class` attributes; this reads `var(--…)`
 * out of CSS and `<style>` blocks, which is the other half of where a design
 * system is referenced and the half nothing checked. `validate()` covers the
 * same grammar inside a `design-system.json`; a consumer's own stylesheets are
 * outside that file and were entirely unguarded.
 *
 * **Why a codemod and not just a report.** The 1.0 rename is mechanical, and a
 * downstream consumer did it by hand — correctly, but only because they noticed
 * that applying the renames *sequentially* compounds them. A surface role's
 * backgrounds rotate (`--surface-bg` → `--color-bg-surface-muted`,
 * `--surface-bg-bold` → `--color-bg-surface`), so a naive
 * find-and-replace-each-in-turn walks a value through two renames and lands
 * somewhere neither table entry names. `applyRenames` builds one alternation and
 * rewrites in a single pass, which makes simultaneity structural rather than
 * something the operator has to know.
 */
import type { LintFinding } from './lint.ts';

/** A rewrite this tool can perform without a judgement call. */
export interface TokenFix {
  from: string;
  to: string;
}

/**
 * Rewrite every old name in one pass.
 *
 * Longest-first alternation so a name that is a prefix of another (`--x-bg` vs
 * `--x-bg-bold`) cannot be matched short, and a single `replace` so no output of
 * one rename is ever input to the next.
 */
export function applyRenames(text: string, renames: Record<string, string>): string {
  const names = Object.keys(renames).sort((a, b) => b.length - a.length);
  if (!names.length) return text;
  const escaped = names.map((n) => n.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`));
  // `(?![\w-])` so `--brand-bg` does not match inside `--brand-bg-bold` — the
  // longest-first ordering handles the listed names, this handles unlisted ones.
  const re = new RegExp(`(${escaped.join('|')})(?![\\w-])`, 'g');
  return text.replace(re, (m) => renames[m] ?? m);
}

/** Every `var(--name)` in a text, with its line number. */
function varRefs(src: string): { name: string; line: number }[] {
  const out: { name: string; line: number }[] = [];
  for (const m of src.matchAll(/var\(\s*(--[\w-]+)/g))
    out.push({ name: m[1] as string, line: src.slice(0, m.index).split('\n').length });
  return out;
}

/**
 * Report old-grammar token references in source files.
 *
 * `renames` comes from the generator's `movedTokens()`, built from the
 * consumer's own role names — there is no fixed list, which is why nothing
 * detected these before.
 */
export function lintTokens(
  files: { path: string; text: string }[],
  renames: Record<string, string>,
): (LintFinding & { fix: TokenFix })[] {
  const findings: (LintFinding & { fix: TokenFix })[] = [];
  const seen = new Set<string>();
  for (const f of files)
    for (const { name, line } of varRefs(f.text)) {
      const to = renames[name];
      if (to == null) continue;
      const key = `${f.path}:${line}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        file: f.path,
        line,
        cls: `var(${name})`,
        severity: 'error',
        reason: `\`${name}\` is the pre-1.0 colour grammar and resolves to nothing`,
        suggestion: `var(${to})`,
        fix: { from: name, to },
      });
    }
  return findings;
}
