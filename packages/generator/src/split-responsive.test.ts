import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vite-plus/test';
import { generate } from './generate.ts';
import { defaultConfig } from './index.ts';

/**
 * `.split-responsive` stacks a `.split` below `md` in every format, and `split-1-1` exists as a
 * ratio. A block cannot emit `md-split-1-2` (css/bricks only) or `@md:` (Tailwind scans source,
 * and a block's output is not source), so the stacking is a pattern. The hero block emits it.
 *
 * Needs the framework partials from the gitignored `assets/` snapshot, so skip in a clean checkout.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const hasAssets = existsSync(join(HERE, '..', 'assets', 'css', 'index.css'));

const tmp = mkdtempSync(join(tmpdir(), 'vitops-split-responsive-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe.skipIf(!hasAssets)('split-responsive and the hero pattern', () => {
  for (const format of ['tailwind', 'css'] as const) {
    it(`${format}: stacks below 48rem, resets every child's basis, defines split-1-1`, async () => {
      const outDir = join(tmp, format);
      await generate({ input: defaultConfig(), format, outDir });
      const css = readFileSync(
        join(outDir, format === 'css' ? 'styles.css' : 'tailwind.css'),
        'utf8',
      );
      const flat = css.replace(/\s+/g, ' ');
      expect(flat).toMatch(/\.split-responsive\s*\{?\s*@container \(width\s*<\s*48rem\)/);
      expect(flat).toMatch(/flex:\s*(0 0 auto|none)/);
      expect(flat).toMatch(/split-1-1/);
      expect(flat).toMatch(/\.hero__text/);
    });
  }
});
