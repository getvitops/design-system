import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vite-plus/test';
import { generate } from './generate.ts';
import { defaultConfig } from './index.ts';

/**
 * A `.cta` on a solid tone must not be painted in the band's own colour.
 *
 * `.tone--solid` fills with `--tone-solid`; the old rule gave a `.cta` inside it the same
 * `--tone-solid` fill, so the button vanished into the band (a "Get a Quote" on a dark band was
 * nearly invisible). It now inverts: fill `--tone-on-solid`, label `--tone-solid`. On a tint the
 * button keeps the solid fill. Reads the emitted tailwind CSS (nested, as written) so a regression in
 * the bundle is caught, not just in the source partial.
 *
 * Needs the framework partials from the gitignored `assets/` snapshot, so skip in a clean checkout.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const hasAssets = existsSync(join(HERE, '..', 'assets', 'css', 'index.css'));

const tmp = mkdtempSync(join(tmpdir(), 'vitops-tone-cta-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** The declaration block of the first rule whose selector matches. */
function ruleBody(css: string, selector: RegExp): string {
  const m = selector.exec(css);
  if (!m) return '';
  const start = css.indexOf('{', m.index);
  return css.slice(start + 1, css.indexOf('}', start));
}

describe.skipIf(!hasAssets)('a call to action inside a tone', () => {
  it('inverts on a solid band and keeps the solid on a tint', async () => {
    const outDir = join(tmp, 'tw');
    await generate({ input: defaultConfig(), format: 'tailwind', outDir });
    const css = readFileSync(join(outDir, 'tailwind.css'), 'utf8');

    const solid = ruleBody(css, /(?:&|\.tone)\.tone--solid\s+\.cta\s*\{/);
    expect(solid).toMatch(/background-color:\s*var\(--tone-on-solid\)/);
    expect(solid).toMatch(/color:\s*var\(--tone-solid\)/);

    const tint = ruleBody(css, /(?:&|\.tone)\.tone--tint\s+\.cta\s*\{/);
    expect(tint).toMatch(/background-color:\s*var\(--tone-solid\)/);
    expect(tint).toMatch(/color:\s*var\(--tone-on-solid\)/);
  });
});
