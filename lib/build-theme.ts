/**
 * Build the deployed theme `dist/` by dogfooding @getvitops/generator.
 *
 * Replaces the old lightningcss-CLI pipeline (generate:theme + build:css +
 * build:elements): core owns the lightningcss *library* and does the bundling, so
 * the root no longer needs the lightningcss binary. Formats:
 *   (default) bricks   → full theme payload (styles.min.css, Bricks JSON, JS, bricks/, docs/)
 *   --format css       → standalone styles.css + design-manifest.json (docsite)
 *   --format tailwind  → tailwind.css + tokens.json (Astro/EmDash)
 *   --format design    → DESIGN.md (agent brief) — written to the REPO ROOT, not dist/
 */
import { cpSync, rmSync } from 'node:fs';
import { generate, type Format } from '@getvitops/generator';

const i = process.argv.indexOf('--format');
const format = (i >= 0 ? (process.argv[i + 1] as Format) : 'bricks') as Format;

// DESIGN.md is a tracked, root-level document (it sits beside AGENTS.md and is
// read by agents, not served), so it is the one format that does not target dist/.
const outDir = format === 'design' ? '.' : 'dist';

const res = await generate({ input: 'src/design-system.json', format, outDir });
console.log(`build-theme: ${format} → ${res.written.length} paths in ${res.outDir}/`);

// Mirror the generated OKF bundle into the tracked `docs/` tree. `dist/` is
// gitignored, so without this the in-repo copy silently rots — it had drifted to a
// 5-file bundle from an older generator while the emitter had moved on to 11.
// rm first: a plain copy would leave behind docs the generator no longer emits.
if (format === 'bricks') {
  rmSync('docs', { recursive: true, force: true });
  cpSync('dist/docs', 'docs', { recursive: true });
  console.log('build-theme: docs/ synced from dist/docs/');
}
