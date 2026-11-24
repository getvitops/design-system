import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vite-plus/test';
import { generate } from './generate.ts';
import { defaultConfig } from './index.ts';

/**
 * No `animation:` shorthand in the emitted CSS may carry an `animation-timeline`.
 *
 * lightningcss folds `animation: x linear both; animation-timeline: view()` into
 * `animation: linear both x view()` when it minifies. Chromium does not accept a timeline inside
 * the shorthand (`CSS.supports('animation', 'x linear both view()')` is false in Chrome 159), so it
 * drops the WHOLE declaration and the effect silently never runs: `.text-reveal`, `.scroll-size`,
 * `.steps--animated`, `.parallax__layer` and the scroll-progress bar all did. Written as longhands
 * (`animation-name`, `-timing-function`, `-fill-mode`, `-timeline`) it is left alone, so the source
 * partials must stay in that form. This reads the bundle rather than the sources because the merge
 * happens at build time.
 *
 * Needs the framework partials from the gitignored `assets/` snapshot, so skip in a clean checkout.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const hasAssets = existsSync(join(HERE, '..', 'assets', 'css', 'index.css'));

const tmp = mkdtempSync(join(tmpdir(), 'vitops-timeline-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** `animation: …` declarations (not `animation-name` etc.) whose value names a timeline. */
function shorthandsWithTimeline(css: string): string[] {
  return [...css.matchAll(/(?<![\w-])animation:\s*([^;}]+)/g)]
    .map((m) => m[1]!.trim())
    .filter((value) => /\b(?:view|scroll)\(|(?:^|\s)--[\w-]+(?:\s|$)/.test(value));
}

const FILE = { css: 'styles.css', bricks: 'styles.min.css', tailwind: 'tailwind.css' } as const;

describe.skipIf(!hasAssets)('animation-timeline stays out of the animation shorthand', () => {
  it.each(['css', 'bricks', 'tailwind'] as const)('in the %s bundle', async (format) => {
    const outDir = join(tmp, format);
    await generate({ input: defaultConfig(), format, outDir });
    const css = readFileSync(join(outDir, FILE[format]), 'utf8');
    expect(css).toContain('bg-position-reveal'); // the file really holds the partials
    expect(shorthandsWithTimeline(css)).toEqual([]);
  });
});
