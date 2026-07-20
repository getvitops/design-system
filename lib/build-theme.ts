/**
 * Build the deployed theme `dist/` by dogfooding @getvitops/generator.
 *
 * Replaces the old lightningcss-CLI pipeline (generate:theme + build:css +
 * build:elements): core owns the lightningcss *library* and does the bundling, so
 * the root no longer needs the lightningcss binary. Formats:
 *   (default) bricks   → full theme payload (styles.min.css, Bricks JSON, JS, bricks/, docs/)
 *   --format css       → standalone styles.css + design-manifest.json (docsite)
 *   --format tailwind  → tailwind.css + tokens.json (Astro/EmDash)
 */
import { generate, type Format } from '@getvitops/generator';

const i = process.argv.indexOf('--format');
const format = (i >= 0 ? (process.argv[i + 1] as Format) : 'bricks') as Format;

const res = await generate({ input: 'src/design-system.json', format, outDir: 'dist' });
console.log(`build-theme: ${format} → ${res.written.length} paths in ${res.outDir}/`);
