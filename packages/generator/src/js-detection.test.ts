import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { generate } from './generate.ts';
import { defaultConfig } from './index.ts';

/**
 * The framework asks the platform whether JavaScript and scroll-driven timelines
 * are available. It used to ask two classes on `<html>` — `no-js` and
 * `.no-scroll-timeline` — set by an inline `<head>` snippet.
 *
 * That snippet never existed. Three source comments described it, two of them
 * disagreeing about which file owned it, and nothing shipped it: only the repo's
 * own hand-written pages set `no-js`. So on every Astro and Bricks consumer the
 * `:root:not(.no-js)` gate matched unconditionally, `.animate-trigger` stayed
 * `animation-play-state: paused` with no IntersectionObserver coming to release
 * it, and an entrance animation that never runs is `opacity: 0` — invisible
 * content, for exactly the visitors least able to work around it.
 *
 * The at-rules below cannot fail that way: no class to install, no script to
 * load, and an engine that doesn't understand either one drops the block and
 * leaves the animation *running*. This guards the direction of that failure,
 * because a class-based flag is the obvious-looking "fix" for an animation that
 * appears never to start.
 *
 * Asserted on the minified bundle deliberately — that is the file a consumer
 * loads, and lightningcss is called without `targets`, so nothing here is
 * downlevelled into a form these greps would miss.
 *
 * Needs the framework partials from `packages/generator/assets/`, a gitignored
 * build artifact, so skip rather than fail in a clean checkout.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, '..', 'assets');
const hasAssets = existsSync(join(ASSETS, 'css', 'index.css'));

const tmp = mkdtempSync(join(tmpdir(), 'vitops-js-detect-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const cache = new Map<string, string>();
async function bundle(format: 'css' | 'tailwind' = 'css'): Promise<string> {
  const cached = cache.get(format);
  if (cached !== undefined) return cached;
  const out = join(tmp, format);
  await generate({ input: defaultConfig(), format, outDir: out, assetsDir: ASSETS });
  const css = readFileSync(join(out, format === 'css' ? 'styles.css' : 'tailwind.css'), 'utf8');
  cache.set(format, css);
  return css;
}

/**
 * Does any *rule* select one of the old flags?
 *
 * A substring check can't be used across formats: the css bundle is minified so
 * its comments are gone, but the tailwind one is not piped through lightningcss
 * and ships them verbatim — including the ones in `animation.css` that name both
 * classes to explain why they aren't used. Match a selector position instead, so
 * prose about the flags stays legal and a rule depending on them does not.
 */
const selectsFlag = (css: string) => /(^|[\s,{}>+~])\.no-(js|scroll-timeline)\b/m.test(css);

describe.skipIf(!hasAssets)('JS + timeline detection', () => {
  it('pauses trigger animations only where scripting is enabled', async () => {
    const css = await bundle();
    expect(css).toMatch(/@media\s*\(\s*scripting\s*:\s*enabled\s*\)/);
  });

  it('cancels scroll-driven animations where the timeline is unsupported', async () => {
    const css = await bundle();
    expect(css).toMatch(/@supports\s+not\s*\(\s*animation-timeline\s*:\s*view\(\s*\)\s*\)/);
  });

  it.each(['css', 'tailwind'] as const)(
    'ships neither class flag in the %s format, so nothing goes on <html>',
    async (format) => {
      // A regression here means the framework has gone back to depending on
      // markup the Astro integration cannot emit — it does not own the <html>
      // tag — and, in the tailwind format, on markup no Bricks site has either.
      expect(selectsFlag(await bundle(format))).toBe(false);
    },
  );

  it('detects the same two things in the tailwind format', async () => {
    // The tailwind path inlines the animation engine rather than bundling the
    // partial, so it is a separate emit and can drift independently.
    const css = await bundle('tailwind');
    expect(css).toMatch(/@media\s*\(\s*scripting\s*:\s*enabled\s*\)/);
    expect(css).toMatch(/@supports\s+not\s*\(\s*animation-timeline\s*:\s*view\(\s*\)\s*\)/);
  });

  it('keeps the pause and its release together in one block', async () => {
    // Split across two blocks, an engine could apply `paused` while dropping
    // `running` — the exact permanently-invisible state this all exists to avoid.
    const css = await bundle();
    const at = css.search(/@media\s*\(\s*scripting\s*:\s*enabled\s*\)/);
    const block = css.slice(at, css.indexOf('@', at + 1));
    expect(block).toContain('paused');
    expect(block).toContain('running');
  });
});
