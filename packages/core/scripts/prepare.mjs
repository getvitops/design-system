/**
 * Populate @getvitops/core's shipped assets + JSON Schema from the repo sources.
 *
 * `assets/` and `schema.json` are gitignored build inputs (like `dist/`): this
 * script snapshots the framework-static sources into the package so it is
 * self-contained when published. Run before `vp pack` (see the `build:core` task).
 *
 *   assets/css      ← ../../src/css/*.css (+ patterns/), excluding generated/
 *   assets/bricks   ← ../../bricks/{elements,load.php}
 *   assets/js       ← ../../dist/{polyfills,elements,deferred,editor}.js (+ polyfills/)
 *   schema.json     ← toJSONSchema(DesignSystemSchema)
 *
 * The JS bundles are framework-static (config-independent); they come from the
 * repo's `build:js` output, so that must run first (the task declares the dep).
 */
import { cpSync, mkdirSync, rmSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsonSchema } from '../src/schema.ts';
import { siteJsonSchema } from '../src/site.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const REPO = join(PKG, '..', '..');
const assets = join(PKG, 'assets');

rmSync(assets, { recursive: true, force: true });
mkdirSync(join(assets, 'css', 'patterns'), { recursive: true });

// CSS partials (exclude the generated token layer — generate() rebuilds it).
const cssSrc = join(REPO, 'src', 'css');
for (const f of readdirSync(cssSrc))
  if (f.endsWith('.css')) cpSync(join(cssSrc, f), join(assets, 'css', f));
const patternsSrc = join(cssSrc, 'patterns');
if (existsSync(patternsSrc))
  for (const f of readdirSync(patternsSrc))
    if (f.endsWith('.css')) cpSync(join(patternsSrc, f), join(assets, 'css', 'patterns', f));

// Bricks PHP elements + loader.
mkdirSync(join(assets, 'bricks'), { recursive: true });
cpSync(join(REPO, 'bricks', 'elements'), join(assets, 'bricks', 'elements'), { recursive: true });
cpSync(join(REPO, 'bricks', 'load.php'), join(assets, 'bricks', 'load.php'));

// Pre-built framework JS bundles (from the repo's build:js output).
mkdirSync(join(assets, 'js'), { recursive: true });
const dist = join(REPO, 'dist');
let jsCount = 0;
for (const f of ['polyfills.js', 'elements.js', 'deferred.js', 'editor.js']) {
  if (existsSync(join(dist, f))) {
    cpSync(join(dist, f), join(assets, 'js', f));
    jsCount++;
  }
}
if (existsSync(join(dist, 'polyfills')))
  cpSync(join(dist, 'polyfills'), join(assets, 'js', 'polyfills'), { recursive: true });

// Published JSON Schemas (design-system + site config).
writeFileSync(join(PKG, 'schema.json'), JSON.stringify(jsonSchema, null, 2) + '\n');
writeFileSync(join(PKG, 'site.schema.json'), JSON.stringify(siteJsonSchema, null, 2) + '\n');

const cssCount = readdirSync(join(assets, 'css')).filter((f) => f.endsWith('.css')).length;
const patCount = readdirSync(join(assets, 'css', 'patterns')).length;
console.log(
  `prepare: assets synced (${cssCount} css + ${patCount} patterns, ${jsCount} js bundles, bricks elements) + schema.json`,
);
if (jsCount === 0)
  console.warn(
    'prepare: no JS bundles found in dist/ — run `vp run build:js` first for the Bricks target.',
  );
