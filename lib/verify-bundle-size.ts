#!/usr/bin/env node
/**
 * A gzipped-size budget for the bundles `@getvitops/core` authors itself.
 *
 * AGENTS.md's own reasoning already depends on byte counts — `<wc-consent>`
 * ships in its own Lit-free bundle specifically because it is "~2.8 KB
 * gzipped", and the consent-store split exists because importing it as a
 * value into `elements.js` cost "an extra 688-byte request for one string".
 * Nothing before this measured either claim; a bundle could have doubled in
 * size from an accidental heavy import and nothing would have said so.
 *
 * Scoped to the 7 files this package actually AUTHORS — `elements.js`,
 * `consent.js`, `config-form.js`, `stepper.js`, `editor.js`, `deferred.js`, `polyfills.js` (the
 * feature-detection loader, not what it loads). `polyfills/*.js` — the
 * vendored third-party polyfill implementations themselves
 * (`css-anchor-positioning-fn.js` alone gzips to ~31 KB) — are deliberately
 * excluded: a size change there comes from an upstream library release, not
 * from a change in this repo, and budgeting someone else's code tells us
 * nothing about our own regressions.
 *
 * A budget is a ceiling that requires a DELIBERATE bump when a real feature
 * legitimately grows a bundle (`elements.js` grows every time a new `<wc-*>`
 * ships, by design — see TODO.md's component-autoloader entry) — not a
 * permanent limit. Bumping one is a one-line, reviewable acknowledgement
 * that the growth was intended; the check exists to catch the SILENT case.
 *
 * Assumes `vp run build:core` already ran — this only measures what
 * `packages/core/dist/` currently contains, it does not build anything.
 */
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CORE_DIST = join('packages', 'core', 'dist');

/** Gzipped-byte ceilings. Bump deliberately; see this file's docblock. */
const BUDGETS: Record<string, number> = {
  // 28.1 KB -> 31.8 KB gzipped with `<wc-tabs>`, `<wc-combobox>`, `<wc-format>` and `<wc-range>`
  // (about 0.9 KB each; they share Lit, `BaseElement` and `RovingTabindex`, which were already in
  // the bundle). Intended growth, so the ceiling moves with ~4% headroom. Since `<wc-color-field>`
  // shares Lit with it the bundler lifts Lit into `polyfills/BaseElement.js`; the figure counts that
  // chunk (see `sharedSize`), and gzips it apart from the entry, hence the +600 B on 33,000. `<wc-multifield>` (light DOM, Lit-free, replacing the Lit `<wc-multi-field>`) and its row helper, a chunk shared with `config-form.js`, add ~400 B more. `<wc-contrast-toggle>` (the WCAG G174 switch, merged from the accessibility branch) adds ~300 B more, so 34,500. `<wc-copy>`'s polite live region (copied-label/failed-label), `BaseElement.connectionSignal` and `initFromLightDom`'s second, DOMContentLoaded retry add ~300 B, so 35,000.
  // The accessibility audit batches (announcer, field groups, lifecycle fixes) added ~900 B to the
  // merged bundle (35,877 B). The ceiling is a working figure, not a target: it varies with what a
  // client's build includes, and how components are delivered is being investigated separately.
  'elements.js': 37_000,
  'consent.js': 3_500,
  // The validator, the form codec and `<wc-config-form>`; Lit-free, loaded only by a page with a
  // config form (3.6 KB gzipped, ~10% headroom). Counts the row helper it shares with `elements.js`.
  // `mergeOwned`/`ownedFromProjections` (the form's save merge, lifted from the portal) and the live
  // refresh of selects built from another map add ~600 B, so 5,500.
  'config-form.js': 5_500,
  // `<wc-stepper>`; Lit-free, outside `elements.js` because that bundle is at 99% of its budget.
  // 2,008 B after the audit's focus and validity-timing fixes.
  'stepper.js': 2_200,
  // The glue only: the picker (~40 KB gzipped) is a dynamic import, fetched when the picker is opened.
  'color-field.js': 1_500,
  // `<wc-config-preview>`: the glue only; the generator it renders with is injected by the host.
  'config-preview.js': 2_000,
  'editor.js': 5_500,
  // `js/tooltip.ts` (hover, keyboard focus and Escape for `.tooltip-trigger`) moved into this bundle.
  'deferred.js': 1_600,
  'polyfills.js': 1_200,
};

/**
 * Gzipped size of the chunks an entry imports statically (`from"./polyfills/BaseElement.js"`), which
 * the entry cannot run without. When two entries share a module the bundler lifts it into a chunk
 * and each entry's own file shrinks, so measuring the entry alone would let a bundle grow without
 * the number moving. A dynamic `import("./x.js")` is not counted: it is fetched on demand.
 */
function sharedSize(source: string, seen = new Set<string>()): number {
  let total = 0;
  for (const match of source.matchAll(/(?:^|[;}])import[^"';]*?from"\.\/([^"]+)"/g)) {
    const file = match[1]!;
    if (seen.has(file) || file in BUDGETS) continue;
    seen.add(file);
    try {
      const chunk = readFileSync(join(CORE_DIST, file));
      total += gzipSync(chunk).length + sharedSize(chunk.toString('utf8'), seen);
    } catch {
      // A missing chunk is the build's failure to report, not this budget's.
    }
  }
  return total;
}

let failed = false;

console.log('Bundle size budget (gzipped, packages/core/dist/):\n');
for (const [file, budget] of Object.entries(BUDGETS)) {
  const path = join(CORE_DIST, file);
  let raw: Buffer;
  try {
    raw = readFileSync(path);
  } catch {
    console.error(`✗ ${file}: not found at ${path} — did build:core run?`);
    failed = true;
    continue;
  }
  const gzipped = gzipSync(raw).length + sharedSize(raw.toString('utf8'));
  const over = gzipped > budget;
  if (over) failed = true;
  const pct = ((gzipped / budget) * 100).toFixed(0);
  console.log(
    `${over ? '✗' : '✓'} ${file.padEnd(14)} ${String(gzipped).padStart(6)} B / ${budget} B budget (${pct}%)`,
  );
}

if (failed) {
  console.error(
    '\n✗ one or more bundles exceeded their budget. If this growth is intended, bump the ' +
      'number in lib/verify-bundle-size.ts and say why in the commit — that is the point of a ' +
      'budget rather than a silent number.',
  );
  process.exit(1);
}
console.log('\n✓ every bundle is within budget');
