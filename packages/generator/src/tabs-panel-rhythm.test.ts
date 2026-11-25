import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vite-plus/test';
import { generate } from './generate.ts';
import { defaultConfig } from './index.ts';

/**
 * The blocks inside a tab panel are spaced like `.rhythm` spaces them. A panel written as rich text
 * (paragraphs, a quote, a link) used to render with no space between its blocks. The panel is a
 * `<section>` before upgrade and `.tabs__panel` after, so the rule must cover both.
 *
 * Needs the framework partials from the gitignored `assets/` snapshot, so skip in a clean checkout.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const hasAssets = existsSync(join(HERE, '..', 'assets', 'css', 'index.css'));

const tmp = mkdtempSync(join(tmpdir(), 'vitops-tabs-rhythm-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe.skipIf(!hasAssets)('tab panel spacing', () => {
  it('spaces sibling blocks in both the section and the upgraded panel', async () => {
    const outDir = join(tmp, 'tw');
    await generate({ input: defaultConfig(), format: 'tailwind', outDir });
    const css = readFileSync(join(outDir, 'tailwind.css'), 'utf8');
    const i = css.indexOf('> section,\n  .tabs__panel');
    expect(i).toBeGreaterThan(-1);
    const block = css.slice(i, i + 400);
    expect(block).toMatch(/> \* \+ \*/);
    expect(block).toMatch(/margin-block-start:\s*calc\(var\(--rhythm-base\)/);
  });
});
