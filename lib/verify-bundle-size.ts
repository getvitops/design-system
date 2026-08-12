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
 * Scoped to the 5 files this package actually AUTHORS — `elements.js`,
 * `consent.js`, `editor.js`, `deferred.js`, `polyfills.js` (the
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
  'elements.js': 30_000,
  'consent.js': 3_500,
  'editor.js': 5_500,
  'deferred.js': 1_200,
  'polyfills.js': 1_200,
};

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
  const gzipped = gzipSync(raw).length;
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
