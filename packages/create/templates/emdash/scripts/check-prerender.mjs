// Post-build guard: fail the build if a prerendered page is not a real page.
//
// `astro build` succeeds even when a prerendered route's response was an error: against a
// local database with pending migrations EmDash answers with a one-line "Database migrations
// are required" body, which is written to `index.html` like any other page. Nothing else
// notices, and the deploy then publishes it. `scripts/prepare-local-db.mjs` is what prevents
// it; this is what proves it did.
//
// Checks every `.html` under the client output: it must be an HTML document (not a bare
// text response) and must not carry the pending-migrations message.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? 'dist/client';
if (!existsSync(root)) {
  console.error(`check-prerender: ${root} does not exist (run \`astro build\` first).`);
  process.exit(1);
}

function* htmlFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith('.html')) yield path;
  }
}

const bad = [];
let count = 0;
for (const file of htmlFiles(root)) {
  count += 1;
  const text = readFileSync(file, 'utf8');
  if (/Database migrations are required/i.test(text))
    bad.push([file, 'carries the pending-migrations message']);
  else if (!/<html[\s>]/i.test(text)) bad.push([file, 'is not an HTML document']);
  else if (!/<title>[^<]+<\/title>/i.test(text)) bad.push([file, 'has no <title>']);
}

if (count === 0) {
  console.error(`check-prerender: no .html files under ${root}.`);
  process.exit(1);
}
if (bad.length) {
  console.error('check-prerender: the build prerendered pages that are not real pages:');
  for (const [file, why] of bad) console.error(`  ${file} ${why}`);
  console.error(
    '\nThe local database the build reads is probably unmigrated. Run `vpr prepare-local-db` (it ' +
      'migrates and seeds the local D1 through `astro dev`), then build again.',
  );
  process.exit(1);
}
console.log(`check-prerender: ${count} prerendered page(s) look like real pages.`);
