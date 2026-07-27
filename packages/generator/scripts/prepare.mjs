/**
 * Populate @getvitops/generator's shipped assets + JSON Schema from the repo sources.
 *
 * `assets/` and `schema.json` are gitignored build inputs (like `dist/`): this
 * script snapshots the framework-static sources into the package so it is
 * self-contained when published. Run before `vp pack` (see the `build:generator` task).
 *
 *   assets/css      ← @getvitops/core/css/*.css (+ patterns/), excluding generated/
 *   assets/bricks   ← ../../bricks/{elements,load.php}  (interim; → @getvitops/bricks later)
 *   assets/js       ← @getvitops/core/dist/{polyfills,elements,deferred}.js (+ polyfills/)
 *   schema.json     ← toJSONSchema(DesignSystemSchema)
 *
 * The framework CSS + JS bundles are owned by @getvitops/core (sibling package);
 * `build:core` must build its JS bundles first (the task declares the dep).
 */
import { cpSync, mkdirSync, rmSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsonSchema } from '../src/schema.ts';
import { siteJsonSchema } from '../src/site.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const REPO = join(PKG, '..', '..');
const CORE = join(PKG, '..', 'core'); // @getvitops/core (framework: CSS + JS bundles)
const assets = join(PKG, 'assets');

rmSync(assets, { recursive: true, force: true });
mkdirSync(join(assets, 'css', 'patterns'), { recursive: true });

// CSS partials from @getvitops/core (exclude the generated token layer — generate() rebuilds it).
const cssSrc = join(CORE, 'css');
for (const f of readdirSync(cssSrc))
  if (f.endsWith('.css')) cpSync(join(cssSrc, f), join(assets, 'css', f));
const patternsSrc = join(cssSrc, 'patterns');
if (existsSync(patternsSrc))
  for (const f of readdirSync(patternsSrc))
    if (f.endsWith('.css')) cpSync(join(patternsSrc, f), join(assets, 'css', 'patterns', f));

// Bricks PHP elements + loader (interim: repo-owned until @getvitops/bricks exists).
mkdirSync(join(assets, 'bricks'), { recursive: true });
cpSync(join(REPO, 'bricks', 'elements'), join(assets, 'bricks', 'elements'), { recursive: true });
cpSync(join(REPO, 'bricks', 'load.php'), join(assets, 'bricks', 'load.php'));

// Pre-built framework JS bundles from @getvitops/core's build. editor.js (the live
// theme editor) rides along so a generated dist/ can host it, but nothing enqueues
// it — a page opts in by placing a <wc-theme-editor> tag and loading the bundle.
mkdirSync(join(assets, 'js'), { recursive: true });
const coreDist = join(CORE, 'dist');
let jsCount = 0;
for (const f of ['polyfills.js', 'elements.js', 'deferred.js', 'editor.js']) {
  if (existsSync(join(coreDist, f))) {
    cpSync(join(coreDist, f), join(assets, 'js', f));
    jsCount++;
  }
}
if (existsSync(join(coreDist, 'polyfills')))
  cpSync(join(coreDist, 'polyfills'), join(assets, 'js', 'polyfills'), { recursive: true });

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
    'prepare: no JS bundles found in @getvitops/core/dist — run `vp run build:core` first.',
  );
