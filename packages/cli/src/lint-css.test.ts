import { describe, expect, it } from 'vitest';
import { extractStyleBlocks, scanCss } from './css-scan.ts';
import { lintCss } from './lint-css.ts';

/**
 * The costlier half of the linting problem. A class that resolves to nothing is
 * at least *broken* — someone eventually notices. Hand-written CSS that
 * re-implements a primitive WORKS, so nothing ever surfaces it, and the design
 * system quietly stops being where those decisions live.
 *
 * Both halves of the contract are asserted here: that the patterns are caught,
 * and — just as important — that near-misses are not. A reuse hint is a
 * judgement call, so a rule that fires on an unrelated rule is worse than one
 * that stays quiet.
 */
const at = (path: string, text: string) => [{ path, text }];

describe('scanCss', () => {
  it('keeps values as authored, which is the whole reason it is hand-rolled', () => {
    // lightningcss would give `pair` for display:flex and `track-list` for the
    // columns — its typed model is what these rules need to see through.
    const [rule] = scanCss('.row { display: flex; grid-template-columns: 1fr 2fr; }');
    expect(rule?.declarations).toEqual([
      { property: 'display', value: 'flex' },
      { property: 'grid-template-columns', value: '1fr 2fr' },
    ]);
  });

  it('records enclosing at-rule conditions, and unwinds them again', () => {
    const rules = scanCss('@media (min-width: 48rem) { .a { color: red } } .b { color: blue }');
    expect(rules.map((r) => [r.selector, r.conditions])).toEqual([
      ['.a', ['@media (min-width: 48rem)']],
      ['.b', []],
    ]);
  });

  it('is not desynced by a brace inside a string', () => {
    const rules = scanCss('.q::after { content: "}"; color: red } .r { color: blue }');
    expect(rules.map((r) => r.selector)).toEqual(['.q::after', '.r']);
  });

  it('survives a truncated fragment rather than throwing', () => {
    expect(() => scanCss('.a { color: red')).not.toThrow();
  });
});

describe('extractStyleBlocks', () => {
  it('reports the line the block opens on, so findings point into the real file', () => {
    const src = [
      '---',
      'const x = 1;',
      '---',
      '<div />',
      '<style>',
      '.a { color: red }',
      '</style>',
    ].join('\n');
    expect(extractStyleBlocks(src)[0]?.line).toBe(5);
  });
});

describe('the centred-track rule', () => {
  it('catches a hand-rolled centered container', () => {
    const [f] = lintCss(
      at('a.css', '.wrap { max-inline-size: var(--width-measure); margin-inline: auto; }'),
      'css',
    );
    expect(f?.severity).toBe('suggestion');
    expect(f?.reason).toContain('`.centered`');
    expect(f?.suggestion).toContain('breakout');
  });

  it('also catches the max-width spelling', () => {
    expect(
      lintCss(at('a.css', '.w { max-width: var(--width-spotlight); margin: 0 auto; }'), 'css'),
    ).toHaveLength(1);
  });

  it('stays quiet on a max-width that is not a framework track', () => {
    // Someone capping a figure at 40rem is not reinventing `.centered`.
    expect(lintCss(at('a.css', '.fig { max-width: 40rem; margin-inline: auto; }'), 'css')).toEqual(
      [],
    );
  });

  it('stays quiet without the centring half', () => {
    expect(lintCss(at('a.css', '.w { max-inline-size: var(--width-measure); }'), 'css')).toEqual(
      [],
    );
  });
});

describe('the split rule', () => {
  const twoCol = (cols: string, bp = '48rem') =>
    `@media (min-width: ${bp}) { .g { display: grid; grid-template-columns: ${cols}; } }`;

  it('names the ratio and the format-correct spelling', () => {
    expect(lintCss(at('a.css', twoCol('1fr 2fr')), 'css')[0]?.suggestion).toContain('md-split-1-2');
    expect(lintCss(at('a.css', twoCol('1fr 2fr')), 'tailwind')[0]?.suggestion).toContain(
      '@md:split-1-2',
    );
  });

  it('maps the breakpoint from the query width', () => {
    expect(lintCss(at('a.css', twoCol('3fr 1fr', '64rem')), 'css')[0]?.suggestion).toContain(
      'lg-split-3-1',
    );
  });

  it('does not suggest a split-1-1, because there is no such class', () => {
    // `.split` is equal by default — a ratio class only exists for uneven
    // splits. Suggesting `split-1-1` would be this file committing the exact
    // defect `lint.ts` exists to report.
    expect(lintCss(at('a.css', twoCol('1fr 1fr')), 'css')).toEqual([]);
  });

  it('stays quiet outside a min-width query', () => {
    // An unconditional two-column grid is a layout, not a responsive split.
    expect(
      lintCss(at('a.css', '.g { display: grid; grid-template-columns: 1fr 2fr; }'), 'css'),
    ).toEqual([]);
  });
});

describe('the flex-row rule', () => {
  it('catches display:flex + align-items:center', () => {
    const [f] = lintCss(at('a.css', '.row { display: flex; align-items: center; }'), 'css');
    expect(f?.suggestion).toContain('items-center');
  });

  it('points at Tailwind in the tailwind format, where the framework drops those names', () => {
    expect(
      lintCss(at('a.css', '.row { display: flex; align-items: center; }'), 'tailwind')[0]
        ?.suggestion,
    ).toContain("Tailwind's own");
  });

  it('stays quiet on a column, which is not the same pattern', () => {
    expect(
      lintCss(
        at('a.css', '.col { display: flex; flex-direction: column; align-items: center; }'),
        'css',
      ),
    ).toEqual([]);
  });
});

describe('lintCss', () => {
  it('reads <style> blocks and offsets their line numbers', () => {
    const src = [
      '<div />',
      '<style>',
      '.row { display: flex; align-items: center; }',
      '</style>',
    ].join('\n');
    expect(lintCss(at('a.astro', src), 'css')[0]?.line).toBe(3);
  });

  it('reports every finding as a suggestion, never an error', () => {
    // The exit-code contract depends on this: a reuse hint must not fail CI.
    const css = [
      '.wrap { max-inline-size: var(--width-measure); margin-inline: auto; }',
      '.row { display: flex; align-items: center; }',
    ].join('\n');
    const findings = lintCss(at('a.css', css), 'css');
    expect(findings.length).toBeGreaterThan(1);
    for (const f of findings) expect(f.severity).toBe('suggestion');
  });
});

/**
 * The generated stylesheet lands INSIDE the consumer's source tree — the `css`
 * format writes `styles.css` to `src/styles` by default — so it is squarely
 * inside what `--src` scans. Linting it is the worst false positive this tool
 * can produce: the bundle contains the framework's real implementations of these
 * very patterns, so it reports `.split` as reinventing `.split`.
 *
 * Caught for real on first run against `apps/docs`.
 */
describe('generated output', () => {
  const banner = '/*! GENERATED by @getvitops/generator — do not edit by hand. */';

  it('is skipped, so the framework is not accused of reinventing itself', () => {
    const css = `${banner}\n.row { display: flex; align-items: center; }`;
    expect(lintCss(at('src/styles/styles.css', css), 'css')).toEqual([]);
  });

  it('is matched on the banner, not on a path — the out dir is configurable', () => {
    const css = `${banner}\n.row { display: flex; align-items: center; }`;
    expect(lintCss(at('some/other/place.css', css), 'css')).toEqual([]);
    // …and a file that merely mentions the word is still linted.
    const authored =
      '/* generated content goes here */\n.row { display: flex; align-items: center; }';
    expect(lintCss(at('a.css', authored), 'css')).toHaveLength(1);
  });
});
