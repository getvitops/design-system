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
 * Class names that mean "the thing that constrains page width".
 *
 * The token-anchored rule below only fires once someone already knows about
 * `--width-measure`, which is precisely the author who was never going to
 * hand-roll a container. The reported failure was the other author: agents
 * inventing a `.wrap` from scratch, with a plain pixel `max-width`, on site after
 * site. `wrap` is also the more *available* name for the concept, so it wins the
 * naming race against `.centered` every time unless something says otherwise.
 *
 * Matched on the name only in combination with a width-constraining declaration —
 * a `.wrapper` that merely sets `display: flex` is not this pattern.
 */
const CONTAINER_NAMES = [
  'wrap',
  'wrapper',
  'container',
  'inner',
  'outer',
  'content-wrap',
  'content-wrapper',
  'page-wrap',
  'page-wrapper',
  'site-wrap',
  'site-wrapper',
  'shell',
  'constrain',
  'measure',
];

/**
 * Page scale, as a rem-equivalent, above which a width cap is a *container*
 * rather than an element.
 *
 * Keyed to the framework's own `md` breakpoint (48rem) rather than to a number
 * picked for this rule, and it is what keeps a capped figure quiet — someone
 * writing `max-width: 40rem` on an image is not reinventing `.centered`.
 */
const PAGE_SCALE_REM = 48;
/** The same line in `ch`, where a width cap is a reading measure by construction. */
const PAGE_SCALE_CH = 40;

/**
 * The largest length in a width value, as a rem-equivalent — so `min(100%,
 * 1200px)` and `clamp(20rem, 90vw, 75rem)` are read at their cap rather than
 * skipped for not being a bare length.
 *
 * Relative-to-viewport units (`%`, `vw`, `vmin`) are deliberately ignored: they
 * express "as wide as there is", which is not a container cap.
 */
function widthScale(value: string): { rem: number; ch: number } {
  let rem = 0;
  let ch = 0;
  for (const m of value.matchAll(/([\d.]+)(rem|px|em|ch)\b/g)) {
    const n = Number(m[1]);
    if (!Number.isFinite(n)) continue;
    if (m[2] === 'ch') ch = Math.max(ch, n);
    else rem = Math.max(rem, m[2] === 'px' ? n / 16 : n);
  }
  return { rem, ch };
}

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
  //
  // Three ways in, one verdict. They are one rule rather than three because they
  // describe the same mistake and a rule reports once — a `.wrap` with a pixel cap
  // and auto margins trips all three, and three findings on one line would read as
  // three problems.
  (rule) => {
    const cap = decl(rule, 'max-inline-size') ?? decl(rule, 'max-width') ?? decl(rule, 'width');
    const centred = /\bauto\b/.test(decl(rule, 'margin-inline') ?? decl(rule, 'margin') ?? '');
    if (!cap) return null;

    const token = TRACK_WIDTHS.find((t) => cap.includes(t));
    const { rem, ch } = widthScale(cap);
    const pageScale = rem >= PAGE_SCALE_REM || ch >= PAGE_SCALE_CH;
    // A container-shaped NAME lowers the bar to any cap at all: the name is the
    // stated intent, so the value no longer has to prove it.
    const named = CONTAINER_NAMES.some((n) =>
      // `[-_]+` rather than `[-_]`, so BEM's `__` separator is one boundary:
      // `.site-header__inner` is the container here, and requiring a single
      // separator missed every element-notation selector.
      new RegExp(`[.#]([a-z0-9]+[-_]+)*${n}([-_]+[a-z0-9]+)*\\b`, 'i').test(rule.selector),
    );

    // What makes each trigger unambiguous. A framework track token or a
    // container-shaped name is enough on its own; a bare length has to be both
    // page-scale AND centred, or it is just a capped element.
    const why = token
      ? `it caps width at \`var(${token})\`, a framework track`
      : named
        ? `\`${rule.selector.trim()}\` names a page container`
        : pageScale && centred
          ? `it caps width at page scale and centres with auto margins`
          : null;
    if (!why) return null;
    if (token && !centred) return null;

    return {
      cls: `${rule.selector} { ${cap.length > 40 ? 'width cap' : `max-width: ${cap}`} }`,
      severity: 'suggestion',
      reason: `\`.centered\` is this pattern — ${why}`,
      suggestion:
        'use `.centered`. It is a grid of named tracks, not a max-width box, so a child ' +
        'opts into a wider track with `breakout`, `spotlight` or `fullbleed` on itself — ' +
        'a hand-rolled container has no answer for the full-bleed image except more CSS',
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

  // ── a repeated-item grid, which is what `.subgrid` is for ─────────────────
  //
  // Deliberately NOT gated on a media query, which is what keeps it off the split
  // rule's territory: a `repeat()` is a set of like items, an explicit `1fr 2fr`
  // is two different panels. The two cannot both fire on one rule anyway — this
  // requires `repeat()` and the split requires a `min-width` condition.
  (rule) => {
    const cols = decl(rule, 'grid-template-columns');
    if (!cols || !/^\s*repeat\(/i.test(cols)) return null;
    if (!/\bgrid\b/.test(decl(rule, 'display') ?? '')) return null;
    // `subgrid` in the same rule means this IS the framework pattern, being
    // configured or extended rather than replaced.
    if (rule.declarations.some((d) => /subgrid/.test(d.value))) return null;

    const count = /^\s*repeat\(\s*(\d+)/i.exec(cols)?.[1];
    const auto = /^\s*repeat\(\s*auto-(fit|fill)/i.test(cols);
    if (!count && !auto) return null;
    if (count && Number(count) < 2) return null;

    return {
      cls: `${rule.selector} { grid-template-columns: ${cols} }`,
      severity: 'suggestion',
      reason:
        'a grid of repeated items is `.subgrid` — a plain grid aligns the outer boxes but ' +
        'not the tranches inside them, so headings, bodies and footers land at different ' +
        'heights across the set',
      suggestion: auto
        ? '`.subgrid subgrid-responsive` (2 columns under 60rem, 1 under 40rem) with ' +
          '`--subgrid-row-span` set to the number of row bands each item contains — or ' +
          '`.grid-auto` with `--grid-min`, which is the framework class for this exact ' +
          'auto-fit track and the right answer when the items have no tranches to align'
        : `\`.subgrid subgrid-cols-${count}\`, with \`--subgrid-row-span\` (or ` +
          '`subgrid-rows-<n>`) set to the number of row bands each item contains — and ' +
          '`.subgrid-card` on the items to get an edge-bled `__media` and a pinned `__footer`',
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
