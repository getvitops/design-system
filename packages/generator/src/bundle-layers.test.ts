import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { CSS_LAYERS, generate } from './generate.ts';
import { LAYER_CONTRACT } from './layer-contract.ts';
import { defaultConfig } from './index.ts';

/**
 * The css/bricks bundle ships cascade layers so a single-purpose utility can
 * override a component pattern — `class="card bg-danger-muted"`.
 *
 * Before this, patterns simply came later in the file and both sat at 0-1-0, so
 * the pattern won on source order. The same markup worked in the tailwind
 * format (Tailwind's own layers ordered them correctly), which is precisely the
 * kind of silent cross-format divergence `format-parity.test.ts` exists to
 * catch — this file is its bundle-level counterpart.
 *
 * Needs the framework partials from `packages/generator/assets/`, a gitignored
 * build artifact, so skip rather than fail in a clean checkout.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, '..', 'assets');
const hasAssets = existsSync(join(ASSETS, 'css', 'index.css'));

const tmp = mkdtempSync(join(tmpdir(), 'vitops-layers-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

let cached: string | undefined;
async function bundle(): Promise<string> {
  if (cached === undefined) {
    await generate({ input: defaultConfig(), format: 'css', outDir: tmp, assetsDir: ASSETS });
    cached = readFileSync(join(tmp, 'styles.css'), 'utf8');
  }
  return cached;
}

/** Layer blocks in emitted order, as [name, startOffset]. */
const layerSpans = (css: string) =>
  [...css.matchAll(/@layer ([\w.]+)\s*\{/g)].map((m) => [m[1] as string, m.index] as const);

/**
 * Where a class's rule sits, as an offset — matched on a selector BOUNDARY.
 *
 * A plain `indexOf('.split{')` is not safe against minified output: lightningcss
 * merges rules with identical declaration blocks, so a rule can become
 * `.a,.split{…}` and the substring search misses it entirely — reporting
 * `undefined` (i.e. "no layer") rather than failing loudly.
 */
function classAt(css: string, cls: string): number {
  const esc = cls.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
  return css.search(new RegExp(`(?:^|[,{}])\\.${esc}(?=[,{:>\\s.])`, 'm'));
}

/** Which layer the given offset sits inside. */
function layerAt(css: string, at: number): string | undefined {
  if (at === -1) return undefined;
  let found: string | undefined;
  for (const [name, start] of layerSpans(css)) {
    if (start < at) found = name;
    else break;
  }
  return found;
}

/** Which layer a literal snippet of rule text sits inside. */
const layerOf = (css: string, needle: string) => layerAt(css, css.indexOf(needle));

/** Which layer a CLASS's rule sits inside, matched on a selector boundary. */
const layerOfClass = (css: string, cls: string) => layerAt(css, classAt(css, cls));

describe.skipIf(!hasAssets)('css bundle cascade layers', () => {
  it('emits the layers in precedence order', async () => {
    // lightningcss drops the standalone `@layer a, b, c;` statement, but only
    // after physically reordering the blocks to match it (verified against the
    // installed version). So first-appearance order IS the declared order.
    const css = await bundle();
    const seen: string[] = [];
    for (const [name] of layerSpans(css)) if (!seen.includes(name)) seen.push(name);
    expect(seen).toEqual([...CSS_LAYERS]);
  });

  it('puts patterns in components and colour utilities in utilities', async () => {
    const css = await bundle();
    expect(layerOf(css, '.card{')).toBe('vitops.components');
    expect(layerOf(css, '.cta{')).toBe('vitops.components');
    expect(layerOf(css, '.bg-danger-muted{')).toBe('vitops.utilities');
    expect(layerOf(css, '.drop-shadow-')).toBe('vitops.utilities');
    expect(layerOf(css, '.font-display{')).toBe('vitops.utilities');
    // A new partial defaults to `vitops.components` unless it is in CHUNK_LAYER,
    // and spacing.css is pure utilities — unmapped, `class="cluster gap-l"`
    // would silently lose to the pattern's own gap.
    expect(layerOf(css, '.gap-l{')).toBe('vitops.utilities');
  });

  it('keeps the UA reset and pure token blocks in base', async () => {
    const css = await bundle();
    // global.css's `font-size: 100% !important` portability armour.
    expect(layerOf(css, 'font-size:100%')).toBe('vitops.base');
    // The border-box reset. In `base` deliberately: it is the lowest framework
    // layer, so a consumer's own reset — unlayered, or in a layer they declare
    // before vitops.base — still wins.
    expect(layerOf(css, 'box-sizing:border-box')).toBe('vitops.base');
  });

  it('ranks a colour utility above a pattern — the whole point', async () => {
    // The behavioural assertion. Utilities must sit in a LATER layer than
    // patterns, so `card bg-danger-muted` tints regardless of source order or
    // equal specificity.
    const css = await bundle();
    const order = [...CSS_LAYERS] as string[];
    const pattern = layerOf(css, '.card{');
    const utility = layerOf(css, '.bg-danger-muted{');
    expect(order.indexOf(utility as string)).toBeGreaterThan(order.indexOf(pattern as string));
  });

  it('survives minification (the bricks output is minified)', async () => {
    await generate({ input: defaultConfig(), format: 'css', outDir: tmp, assetsDir: ASSETS });
    const css = readFileSync(join(tmp, 'styles.css'), 'utf8');
    // Both css and bricks run through lightningcss with minify: true.
    expect(css).toContain('@layer vitops.');
    for (const name of CSS_LAYERS) expect(css).toContain(`@layer ${name}{`);
  });

  it('wraps every rule — nothing escapes into the unlayered top level', async () => {
    // An unlayered framework rule would beat ALL layered ones, silently
    // outranking the utilities it should lose to.
    const css = await bundle();
    const stripped = css
      .replace(/\/\*![\s\S]*?\*\//g, '') // the banner
      .replace(/@layer [\w.]+\s*\{[\s\S]*$/, ''); // everything from the first layer on
    expect(stripped.trim()).toBe('');
  });
});

/**
 * The css half of the cross-format layer contract. `format-parity.test.ts`
 * asserts the tailwind half against the SAME list, which is what makes the two
 * an ⇔ rather than two lists free to drift apart.
 */
describe.skipIf(!hasAssets)('layer contract — css bundle', () => {
  it('puts every pattern in vitops.components', async () => {
    const css = await bundle();
    for (const cls of LAYER_CONTRACT.components)
      expect(layerOfClass(css, cls), `.${cls} is a pattern`).toBe('vitops.components');
  });

  it('puts every utility in vitops.utilities', async () => {
    // Red on the pre-split arrangement for the whole layout.css half: `.m-xs`,
    // `.spotlight`, `.split-1-2` and `.grid-auto` all sat in `vitops.components`
    // because the layer was decided per FILE and layout.css was unmapped.
    const css = await bundle();
    for (const cls of LAYER_CONTRACT.utilities)
      expect(layerOfClass(css, cls), `.${cls} is a utility`).toBe('vitops.utilities');
  });

  it('puts the Tailwind-owned names in vitops.utilities too', async () => {
    // We still emit these for css/bricks — only the tailwind format defers.
    const css = await bundle();
    for (const cls of LAYER_CONTRACT.tailwindOwns)
      expect(layerOfClass(css, cls), `.${cls} is a utility`).toBe('vitops.utilities');
  });

  it('ranks utilities above patterns, so the contract has teeth', async () => {
    const css = await bundle();
    const order = [...CSS_LAYERS] as string[];
    const pattern = layerOfClass(css, 'split');
    const utility = layerOfClass(css, 'flex-col');
    expect(order.indexOf(utility as string)).toBeGreaterThan(order.indexOf(pattern as string));
  });
});
