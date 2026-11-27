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
import { dirname, join, normalize } from 'node:path';

const CORE_DIST = join('packages', 'core', 'dist');

/** Gzipped-byte ceilings. Bump deliberately; see this file's docblock. */
const BUDGETS: Record<string, number> = {
  // `elements.js` no longer bundles the elements: it is the eager entry, which loads every
  // `elements/<tag>.js` at once (see `ELEMENT_BUDGET` below, where the per-element weight is held).
  // Before the split it was one 37.5 KB bundle that every page paid for.
  'elements.js': 1_500,
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
  // Toggletip handling (click pin, aria-expanded) added ~165 B, so 1,800.
  'deferred.js': 1_800,
  'polyfills.js': 1_200,
  // The on-demand loader: a tag table, the scan, the observer. Each element it fetches is budgeted
  // below, so this is only the loader itself.
  'loader.js': 1_500,
};

/**
 * What one `elements/<tag>.js` may weigh with every chunk it statically imports (Lit, `BaseElement`
 * and the helpers it shares), gzipped. A page using one element pays this and nothing for the
 * rest, so the number that matters is how far it sits below `elements.js`: a ceiling here (the heaviest, `<wc-carousel>`, is 15.0 KB, of which ~10 KB is Lit) is what
 * catches an element that quietly drags in something large (the colour library is 90 KB raw).
 */
const ELEMENT_BUDGET = 16_000;

/**
 * Gzipped size of the chunks a file imports statically (`from"../chunks/BaseElement.js"`), which it
 * cannot run without. When two entries share a module the bundler lifts it into a chunk and each
 * entry's own file shrinks, so measuring the entry alone would let a bundle grow without the number
 * moving. A dynamic `import("./x.js")` is not counted: it is fetched on demand. Paths resolve
 * against the importing file, because `elements/*.js` reach `chunks/` through `../`.
 */
function sharedSize(file: string, source: string, seen = new Set<string>()): number {
  let total = 0;
  for (const match of source.matchAll(/(?:^|[;}])(?:import|export)[^"';()]*?"(\.{1,2}\/[^"]+)"/g)) {
    const target = normalize(join(dirname(file), match[1]!));
    if (seen.has(target) || target in BUDGETS) continue;
    seen.add(target);
    try {
      const chunk = readFileSync(join(CORE_DIST, target));
      total += gzipSync(chunk).length + sharedSize(target, chunk.toString('utf8'), seen);
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
  const gzipped = gzipSync(raw).length + sharedSize(file, raw.toString('utf8'));
  const over = gzipped > budget;
  if (over) failed = true;
  const pct = ((gzipped / budget) * 100).toFixed(0);
  console.log(
    `${over ? '✗' : '✓'} ${file.padEnd(14)} ${String(gzipped).padStart(6)} B / ${budget} B budget (${pct}%)`,
  );
}

// Per element, from the manifest the build emits (tag → `elements/<tag>.js`).
try {
  const manifest = JSON.parse(
    readFileSync(join(CORE_DIST, 'elements', 'manifest.json'), 'utf8'),
  ) as Record<string, { file: string }>;
  console.log(`\nPer element (gzipped, with static chunks; budget ${ELEMENT_BUDGET} B each):\n`);
  for (const [tag, { file }] of Object.entries(manifest)) {
    const raw = readFileSync(join(CORE_DIST, file));
    const gzipped = gzipSync(raw).length + sharedSize(file, raw.toString('utf8'));
    const over = gzipped > ELEMENT_BUDGET;
    if (over) failed = true;
    console.log(`${over ? '✗' : '✓'} ${tag.padEnd(24)} ${String(gzipped).padStart(6)} B`);
  }
} catch {
  console.error('✗ elements/manifest.json not found — did build:core run?');
  failed = true;
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
