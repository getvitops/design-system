import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vite-plus/test';
import { generate } from './generate.ts';
import { defaultConfig } from './index.ts';

/**
 * `generate()` with no `format` emits the Tailwind stylesheet. Tailwind is the format the EmDash
 * sites build, and the Astro integration and the Vite plugin already default to it; the library
 * and the CLI used to default to `bricks` alone, so a bare `vitops generate` produced a payload
 * nobody on the Astro path uses. Bricks is still a named format (see `format-parity.test.ts`).
 *
 * Needs the framework partials from the gitignored `assets/` snapshot, so skip in a clean checkout.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const hasAssets = existsSync(join(HERE, '..', 'assets', 'css', 'index.css'));

const tmp = mkdtempSync(join(tmpdir(), 'vitops-default-format-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe.skipIf(!hasAssets)('the default output format', () => {
  it('is tailwind when none is given, and writes neither the css nor the bricks payload', async () => {
    const outDir = join(tmp, 'default');
    await generate({ input: defaultConfig(), outDir });
    const files = readdirSync(outDir);
    expect(files).toContain('tailwind.css');
    expect(files).not.toContain('styles.css');
    expect(files).not.toContain('bricks');
  });

  it('still emits the bricks payload when asked for it by name', async () => {
    const outDir = join(tmp, 'bricks');
    await generate({ input: defaultConfig(), format: 'bricks', outDir });
    expect(readdirSync(outDir)).toContain('bricks');
  });
});
