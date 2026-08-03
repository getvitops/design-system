/**
 * The inverse of `lint.ts`: hand-written CSS that re-implements a framework
 * primitive.
 *
 * `lint.ts` catches a class that resolves to nothing — you named something and it
 * isn't there. This catches the costlier direction, where the code *works*: a
 * centred container written by hand, a two-column split behind a media query, a
 * flex row. Nothing is broken, so nothing ever surfaces it, and the design system
 * quietly stops being the place those decisions live.
 *
 * Every finding here is a `suggestion`, never an `error`. These are judgement
 * calls — a rule can be right about the pattern and wrong about the intent — and
 * a reuse hint that failed CI on the day it shipped would be a worse defect than
 * the drift it reports. `--strict` is there for consumers who want the ratchet.
 *
 * Rules stay conservative on purpose: each requires the *combination* that makes
 * the intent unambiguous. `margin-inline: auto` alone is not a centred track;
 * `display: flex` alone is not a cluster.
 */
import type { Format } from '@getvitops/generator';
import { type CssRule, extractStyleBlocks, scanCss } from './css-scan.ts';
import type { LintFinding } from './lint.ts';

/**
 * The framework's own track widths. Declared in two places today
 * (`core/css/layout.css` and the tailwind emitter), so a rule keyed to the token
 * NAME rather than to a value survives either one moving.
 */
const TRACK_WIDTHS = ['--width-measure', '--width-breakout', '--width-spotlight'];

/**
 * Column ratios that correspond to a `split-<a>-<b>` class.
 *
 * `.split` is FLEX, not grid — `display: flex` with `flex: 1` children, and a
 * ratio class setting `--_split-a`/`--_split-b`. Equal columns are the base
 * `.split` with no ratio class, which is why `1fr 1fr` is deliberately absent:
 * suggesting `split-1-1` would name a class that does not exist, and this file
 * would then be committing the very defect `lint.ts` reports.
 */
const SPLITS: Record<string, string> = {
  '1fr 2fr': '1-2',
  '2fr 1fr': '2-1',
  '1fr 3fr': '1-3',
  '3fr 1fr': '3-1',
  '1fr 4fr': '1-4',
  '4fr 1fr': '4-1',
  '2fr 3fr': '2-3',
  '3fr 2fr': '3-2',
};

const decl = (rule: CssRule, property: string) =>
  rule.declarations.find((d) => d.property === property)?.value;

/** Is this rule inside a `min-width` media or container query? */
const inMinWidthQuery = (rule: CssRule) => rule.conditions.some((c) => /min-width\s*:/.test(c));

/** The framework breakpoint a `min-width` condition corresponds to, if any. */
function breakpointOf(rule: CssRule): string | null {
  const rem = rule.conditions.map((c) => /min-width\s*:\s*([\d.]+)rem/.exec(c)?.[1]).find(Boolean);
  if (!rem) return null;
  const n = Number(rem);
  // The framework's container breakpoints: sm/md/lg/xl = 30/48/64/80rem.
  return n >= 80 ? 'xl' : n >= 64 ? 'lg' : n >= 48 ? 'md' : n >= 30 ? 'sm' : null;
}

/** Spell a responsive utility the way the target format actually emits it. */
const responsive = (bp: string, base: string, format: Format) =>
  format === 'tailwind' ? `@${bp}:${base}` : `${bp}-${base}`;

type Verdict = Omit<LintFinding, 'file' | 'line'>;

/**
 * One rule = one check. Kept as data rather than a chain of ifs so adding a
 * primitive is adding an entry, and so each carries its own explanation.
 */
const RULES: ((rule: CssRule, format: Format) => Verdict | null)[] = [
  // ── a centred track, written by hand ──────────────────────────────────────
  (rule) => {
    const token = TRACK_WIDTHS.find(
      (t) => decl(rule, 'max-inline-size')?.includes(t) || decl(rule, 'max-width')?.includes(t),
    );
    const centred = /\bauto\b/.test(decl(rule, 'margin-inline') ?? decl(rule, 'margin') ?? '');
    if (!token || !centred) return null;
    return {
      cls: `${rule.selector} { max-inline-size: var(${token}); margin-inline: auto }`,
      severity: 'suggestion',
      reason:
        '`.centered` is this pattern — a grid of named tracks, not a max-width plus auto margins',
      suggestion:
        'use `.centered`, and widen an individual child with `breakout`, `spotlight` or ' +
        '`fullbleed` on that child rather than overriding the parent',
    };
  },

  // ── a two-column split behind a breakpoint ────────────────────────────────
  (rule, format) => {
    const cols = decl(rule, 'grid-template-columns');
    if (!cols || !inMinWidthQuery(rule)) return null;
    const ratio = SPLITS[cols.replace(/\s+/g, ' ').trim()];
    const bp = ratio && breakpointOf(rule);
    if (!ratio || !bp) return null;
    return {
      cls: `${rule.selector} { grid-template-columns: ${cols} }`,
      severity: 'suggestion',
      reason: `a ${cols} split behind a min-width query is the \`split-${ratio}\` utility`,
      suggestion:
        `${responsive(bp, `split-${ratio}`, format)} on the container — the responsive form is ` +
        'equal below the breakpoint and takes the ratio above it, which is what the query is doing by hand',
    };
  },

  // ── a flex row with centred items ─────────────────────────────────────────
  (rule, format) => {
    if (decl(rule, 'display') !== 'flex') return null;
    if (decl(rule, 'align-items') !== 'center') return null;
    if (/column/.test(decl(rule, 'flex-direction') ?? '')) return null;
    return {
      cls: `${rule.selector} { display: flex; align-items: center }`,
      severity: 'suggestion',
      reason: 'the framework has this as utilities',
      suggestion:
        format === 'tailwind'
          ? "Tailwind's own `flex items-center` (the framework drops these names in this format)"
          : '`flex items-center`, or `.cluster-start` if this is a row of related controls',
    };
  },
];

/**
 * Lint stylesheets and the `<style>` blocks of component files.
 *
 * `files` carries raw text, same as `lintSource` — this module stays free of the
 * filesystem so the caller owns discovery.
 */
/**
 * The banner every generated stylesheet opens with.
 *
 * Linting the generator's own output is the worst false positive this tool can
 * produce: the emitted bundle contains the framework's real implementations of
 * these very patterns, so it reports `.split` as reinventing `.split`. The
 * `css` format writes `styles.css` into the consumer's source tree (`src/styles`
 * by default), which is squarely inside what `--src` scans.
 *
 * Matched on the banner rather than on a path, because the output directory is
 * configurable and a path rule would silently stop working when someone changes
 * it.
 */
// Case-sensitive on purpose: the banner shouts `GENERATED`, and matching it
// case-insensitively also swallowed an authored `/* generated content here */`.
const GENERATED = /^\s*\/\*!?\s*GENERATED\b|do not edit by hand\./;

export function lintCss(files: { path: string; text: string }[], format: Format): LintFinding[] {
  const findings: LintFinding[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    if (GENERATED.test(file.text.slice(0, 400))) continue;
    // A .css file is one block starting at line 1; a component file may hold
    // several, each offset to where its <style> opens so a reported line points
    // into the original file rather than into the extracted block.
    const blocks = file.path.endsWith('.css')
      ? [{ css: file.text, line: 1 }]
      : extractStyleBlocks(file.text);
    for (const block of blocks)
      for (const rule of scanCss(block.css))
        for (const check of RULES) {
          const verdict = check(rule, format);
          if (!verdict) continue;
          const line = block.line + rule.line - 1;
          const key = `${file.path}:${line}:${verdict.reason}`;
          if (seen.has(key)) continue;
          seen.add(key);
          findings.push({ file: file.path, line, ...verdict });
          break; // one suggestion per rule — the first match wins
        }
  }
  return findings;
}
