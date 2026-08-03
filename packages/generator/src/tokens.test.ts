import { LIGHTNESS_LADDER, contrastLc, hexToOklch } from '@getvitops/utils/color';
import { describe, expect, it } from 'vitest';
import { build } from './generate.ts';
import { defaultConfig } from './index.ts';
import { roleHue, roleKind } from './shared.ts';
import {
  checkContrast,
  expandPalette,
  functionalRole,
  ladderWarnings,
  monotonicityErrors,
  NUMERIC_STEPS,
  tokenClass,
  tokenVar,
} from './tokens.ts';

const SEEDS = { pine: '#4A9075', slate: '#5B6472', rust: '#B23A32', cobalt: '#3B5BB5' };
const ladderOf = (step: string) => LIGHTNESS_LADDER[Number(step) as keyof typeof LIGHTNESS_LADDER];

describe('expandPalette (seeded)', () => {
  const expanded = expandPalette(
    Object.fromEntries(Object.entries(SEEDS).map(([k, seed]) => [k, { seed }])),
  );

  it('generates all 11 numeric steps with tinted extremes', () => {
    for (const [name, hue] of Object.entries(expanded)) {
      for (const s of NUMERIC_STEPS) expect(hue.numeric?.[s], `${name}-${s}`).toBeTruthy();
      const light = hexToOklch(hue.numeric!['50']!);
      const dark = hexToOklch(hue.numeric!['950']!);
      expect(light.l, `${name}-50 near-white`).toBeGreaterThanOrEqual(0.96);
      expect(dark.l, `${name}-950 near-black`).toBeLessThanOrEqual(0.23);
      // chroma tapers toward the ends (tinted neutrals, not saturated)
      const mid = hexToOklch(hue.numeric!['500']!);
      expect(light.c).toBeLessThan(Math.max(mid.c, 0.03));
      expect(dark.c).toBeLessThan(Math.max(mid.c, 0.03));
    }
  });

  /**
   * The whole point of the fixed ladder: a step means the same lightness in every
   * hue, so one contrast table can serve all of them. Only the step an author
   * pinned is allowed to deviate.
   */
  it('puts every UNANCHORED step on the shared lightness ladder', () => {
    for (const [name, hue] of Object.entries(expanded)) {
      const anchored = new Set(Object.keys(hue.deviations ?? {}));
      for (const s of NUMERIC_STEPS) {
        if (anchored.has(s)) continue;
        const l = hexToOklch(hue.numeric![s]!).l;
        // Gamut mapping nudges lightness slightly on out-of-gamut steps; that is
        // the only slack allowed here.
        expect(Math.abs(l - ladderOf(s)), `${name}-${s}`).toBeLessThan(0.02);
      }
    }
  });

  it('reproduces the seed byte-for-byte at its natural step', () => {
    const pine = expandPalette({ pine: { seed: SEEDS.pine } }).pine!;
    expect(Object.values(pine.numeric!).map((h) => h.toLowerCase())).toContain(
      SEEDS.pine.toLowerCase(),
    );
  });

  it('scale lightness is strictly monotonic (50 lightest … 950 darkest)', () => {
    for (const [name, hue] of Object.entries(expanded)) {
      const Ls = NUMERIC_STEPS.map((s) => hexToOklch(hue.numeric![s]!).l);
      for (let i = 1; i < Ls.length; i++)
        expect(Ls[i]!, `${name} step ${NUMERIC_STEPS[i]}`).toBeLessThan(Ls[i - 1]!);
    }
  });

  it('warns when a pinned colour sits well off the ladder, but still builds', () => {
    // #4A9075 is L 0.600 and lands on step 500 (ladder 0.65) — a 0.05 deviation.
    const warnings = ladderWarnings(expandPalette({ pine: { seed: SEEDS.pine } }));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/step 500/);
    expect(warnings[0]).toMatch(/darker/);
  });

  it('stays quiet for a seed that already sits on a ladder step', () => {
    // oklch L 0.65 is exactly the ladder's step 500.
    expect(ladderWarnings(expandPalette({ x: { seed: 'oklch(65% 0.12 250)' } }))).toEqual([]);
  });
});

describe('role kinds', () => {
  const expanded = expandPalette({ pine: { seed: SEEDS.pine }, slate: { seed: SEEDS.slate } });

  it('gives a surface role a bare bg and the full text scale', () => {
    const fr = functionalRole('surface', 'slate', expanded.slate!, 'surface');
    expect(fr.light).toHaveProperty('bg');
    expect(fr.light).toHaveProperty('bg-muted');
    expect(fr.light).toHaveProperty('bg-x-muted');
    expect(fr.light).toHaveProperty('text-xx-muted');
    expect(fr.light).toHaveProperty('border-bold');
  });

  it('gives a chromatic role tints and solids but NO bare bg', () => {
    const fr = functionalRole('danger', 'pine', expanded.pine!, 'chromatic');
    expect(fr.light).not.toHaveProperty('bg');
    expect(fr.light).toHaveProperty('bg-muted');
    expect(fr.light).toHaveProperty('bg-x-muted');
    expect(fr.light).toHaveProperty('bg-solid');
    expect(fr.light).toHaveProperty('bg-solid-x-bold');
    // de-emphasised coloured text can't hold contrast off a white surface, so it
    // deliberately doesn't exist — soften with weight/size instead.
    expect(fr.light).not.toHaveProperty('text-muted');
  });

  it('names tokens with the target inside, so the two axes cannot collide', () => {
    expect(tokenVar('danger', 'bg-muted')).toBe('--color-bg-danger-muted');
    expect(tokenVar('danger', 'text-muted')).toBe('--color-text-danger-muted');
    expect(tokenVar('danger', 'text-on')).toBe('--color-text-on-danger');
    expect(tokenVar('surface', 'text-on-bold')).toBe('--color-text-on-surface-bold');
    expect(tokenVar('surface', 'bg')).toBe('--color-bg-surface');
    // the class name is the token name minus the prefix — one vocabulary
    expect(tokenClass('danger', 'bg-solid-bold')).toBe('bg-danger-solid-bold');
  });
});

describe('the contrast contract', () => {
  const expanded = expandPalette({ pine: { seed: SEEDS.pine }, slate: { seed: SEEDS.slate } });
  const numericOf = (h: string) => expanded[h]!.numeric!;

  it.each([
    ['neutral', 'surface'],
    ['surface', 'surface'],
    ['ui-primary', 'chromatic'],
  ] as const)('%s (%s) meets its targets in both appearances', (role, kind) => {
    const hue = role === 'ui-primary' ? 'pine' : 'slate';
    const fr = functionalRole(role, hue, expanded[hue]!, kind);
    expect(checkContrast(fr, numericOf)).toEqual([]);
  });

  it('holds for every role in the scaffolded config', () => {
    // The block above uses synthetic seeds. This one covers what `vitops init`
    // actually hands a consumer — every role, every background plane, both
    // appearances — so a palette edit can't quietly ship an unreadable pairing.
    const ds = defaultConfig();
    const pal = expandPalette(ds.colors.palette);
    const numeric = (h: string) => pal[h]!.numeric!;
    const resolve = (v: string) => {
      const m = /^var\(--color-([a-z0-9-]+)-(\d+)\)$/.exec(v);
      return m ? numeric(m[1] as string)[m[2] as never]! : v;
    };
    const roles = Object.entries(ds.colors.roles).map(([role, spec]) =>
      functionalRole(role, roleHue(spec), pal[roleHue(spec)]!, roleKind(spec)),
    );
    // Chromatic text is checked against the page it sits on, not just its own
    // tint — that is where coloured text actually appears.
    const sfc = roles.find((r) => r.role === 'surface')!;
    const planes = (['bg', 'bg-muted', 'bg-x-muted'] as const).flatMap((k) => [k]);
    const surfaceBg = {
      light: planes.map((k) => resolve(sfc.light[k] as string)),
      dark: planes.map((k) => resolve(sfc.dark[k] as string)),
    };
    expect(roles.flatMap((fr) => checkContrast(fr, numeric, surfaceBg))).toEqual([]);
  });

  it('re-points tokens in dark mode while the solid family stays stable', () => {
    const fr = functionalRole('neutral', 'slate', expanded.slate!, 'surface');
    expect(fr.light.bg).not.toBe(fr.dark.bg);
    expect(fr.light.text).not.toBe(fr.dark.text);
    // The extremes genuinely invert: the lightest background in light mode is the
    // boldest text in dark. (`text` itself sits one step in from the extreme so it
    // isn't maximum-contrast glare, so the mirror shows up on `text-bold`.)
    expect(fr.light.bg).toBe(fr.dark['text-bold']);
    expect(fr.light['text-bold']).toBe(fr.dark['bg-muted']);
    // A filled button must not change identity when the appearance flips.
    expect(fr.light['bg-solid']).toBe(fr.dark['bg-solid']);
    expect(fr.light['bg-solid-bold']).toBe(fr.dark['bg-solid-bold']);
    expect(fr.light['text-on']).toBe(fr.dark['text-on']);
  });
});

describe('fixed-tone kits', () => {
  it('uses authored tones verbatim, adds only tinted endpoints', () => {
    const tones = ['#29634D', '#4A9075', '#94C4AF'];
    const hue = expandPalette({ brand: { tones } }).brand!;
    const values = Object.values(hue.numeric!);
    for (const t of tones) expect(values).toContain(t);
    expect(hue.sparse).toBe(true);
    expect(hexToOklch(hue.numeric!['50']!).l).toBeGreaterThanOrEqual(0.96);
    expect(hexToOklch(hue.numeric!['950']!).l).toBeLessThanOrEqual(0.23);
    // nothing else invented: authored (3) + endpoints (2)
    expect(values).toHaveLength(5);
  });

  it('tokens snap to available tones and still pass contrast', () => {
    const hue = expandPalette({ brand: { tones: ['#94C4AF', '#4A9075', '#29634D'] } }).brand!;
    const fr = functionalRole('brand-primary', 'brand', hue, 'chromatic');
    expect(checkContrast(fr, () => hue.numeric!)).toEqual([]);
  });

  /**
   * A kit thin enough that snapping can't cover every tier is REPORTED, not
   * silently shipped. Two tones leaves the dark-mode icon tier snapping onto the
   * near-black endpoint, which no amount of interpolation can rescue — the honest
   * answer is "add a mid tone", and the contract is what says so.
   */
  it('reports a kit too thin to cover the non-text tier', () => {
    const hue = expandPalette({ brand: { tones: ['#29634D', '#4A9075'] } }).brand!;
    const failures = checkContrast(
      functionalRole('brand-primary', 'brand', hue, 'chromatic'),
      () => hue.numeric!,
    );
    expect(failures.join('\n')).toMatch(/icon Lc .* < 45/);
  });

  /**
   * Two tones landing on one step used to overwrite silently: the palette still
   * built and the tone the author cared about was simply gone. The record form is
   * the way to say which step each belongs to, so the error points at it.
   */
  it('refuses two tones that claim the same step', () => {
    expect(() => expandPalette({ brand: { tones: ['#1877F2', '#0F62FE'] } })).toThrow(
      /both map to step 600/,
    );
  });

  it('accepts the same two tones when the author keys them explicitly', () => {
    const hue = expandPalette({ brand: { tones: { '600': '#1877F2', '700': '#0F62FE' } } }).brand!;
    expect(hue.numeric!['600']).toBe('#1877F2');
    expect(hue.numeric!['700']).toBe('#0F62FE');
  });
});

describe('invalid hues', () => {
  it('rejects a palette entry without seed or tones', () => {
    expect(() => expandPalette({ navy: { base: '#1A2230' } })).toThrow(/seed.*tones|tones.*seed/i);
  });
});

describe('contrast engine sanity', () => {
  it('APCA Lc between tinted endpoints is far above the text target', () => {
    const hue = expandPalette({ slate: { seed: SEEDS.slate } }).slate!.numeric!;
    expect(contrastLc(hue['950']!, hue['50']!)).toBeGreaterThan(90);
  });
});

/**
 * Endpoint chroma is a CEILING, not a target.
 *
 * The interpolation factor reaches exactly 1 at steps 50 and 950 for every anchor
 * position, so as a target it pinned both ends to the constants unconditionally —
 * seeds at chroma 0.001, 0.002, 0.05 and 0.2 all produced a byte-identical step
 * 50. There was therefore no seed that yielded a plain neutral, and chroma 0 was
 * the worst case: colorjs returns NaN hue for a true achromatic colour, which
 * `hexToOklch` collapses to 0, so the "neutral" came out pink.
 */
describe('endpoint chroma', () => {
  const ramp = (seed: string) => expandPalette({ x: { seed } }).x!.numeric!;
  /** Channel spread is the direct test for "is this actually grey?". */
  const hexToRgb = (hex: string) => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
    const n = Number.parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };

  it('lets a grey seed produce an actual grey', () => {
    const grey = ramp('#808080');
    for (const step of ['50', '500', '950'] as const) {
      const { r, g, b } = hexToRgb(grey[step]!);
      expect(Math.max(r, g, b) - Math.min(r, g, b), `step ${step} is ${grey[step]}`).toBeLessThan(
        2,
      );
    }
  });

  it('no longer snaps a low-chroma seed onto the endpoint constant', () => {
    // Every seed below the ceiling used to land on the chroma-0.008 value, so
    // 0.001, 0.002 and 0.05 all produced a byte-identical #f5f9fe at step 50.
    const atCeiling = ramp('oklch(0.5 0.008 255)')['50'];
    for (const c of ['0.001', '0.002', '0.003'])
      expect(
        ramp(`oklch(0.5 ${c} 255)`)['50'],
        `chroma ${c} should stay below the ceiling`,
      ).not.toBe(atCeiling);
    // Above the ceiling it still binds, which is what leaves normal hues untouched.
    expect(ramp('oklch(0.5 0.05 255)')['50']).toBe(atCeiling);
  });

  it('scales the endpoint tint with the seed rather than flattening it', () => {
    const spread = (seed: string) => {
      const { r, g, b } = hexToRgb(ramp(seed)['50']!);
      return Math.max(r, g, b) - Math.min(r, g, b);
    };
    expect(spread('oklch(0.5 0 255)')).toBe(0);
    expect(spread('oklch(0.5 0.003 255)')).toBeGreaterThan(spread('oklch(0.5 0.001 255)'));
    expect(spread('oklch(0.5 0.008 255)')).toBeGreaterThan(spread('oklch(0.5 0.003 255)'));
  });

  it('still tints the ends of an ordinary seed', () => {
    // The ceiling only binds below it — a normal brand hue is unchanged, which is
    // why the shipped palette's tokens.json is byte-identical across this change.
    const brand = ramp('#2e9b73');
    const { r, g, b } = hexToRgb(brand['50']!);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeGreaterThan(1);
  });
});

/**
 * A ramp must darken from 50 to 950. Only pinned colours can break that — a
 * ladder-built ramp cannot invert — and nothing caught it: `ladderWarnings`
 * compares each pinned step against its OWN ladder rung, never its neighbours.
 *
 * The case below is real. Anchoring the shipped `navy` at 600 produced
 * 600 #2c3b4e (L 0.348) above 700 #4e5c6f (L 0.470), which inverts the
 * `bg-<role>-solid` → `-solid-bold` hover. The generator warned about ladder
 * deviation and said the ramp was "Legal", which is the misleading part.
 */
describe('ramp monotonicity', () => {
  const errorsFor = (hue: Record<string, unknown>) =>
    monotonicityErrors(expandPalette({ navy: hue }));

  it('catches the anchor that inverts 600 and 700', () => {
    const errors = errorsFor({ seed: '#1A2230', anchors: { 600: '#2c3b4e' } });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('colors.palette.navy');
    // Names the PAIR — a per-step message can't express the fix.
    expect(errors[0]).toContain('step 700');
    expect(errors[0]).toContain('step 600');
    // And points at the colour the AUTHOR wrote, plus where it belongs — not at
    // the unpinned neighbour, which is already exactly where it should be.
    expect(errors[0]).toContain('#2c3b4e (pinned at 600)');
    expect(errors[0]).toContain('nearest step 800');
    expect(errors[0]).not.toContain('#4e5c6f (pinned');
  });

  it('passes every hue in the shipped config', () => {
    expect(monotonicityErrors(expandPalette(defaultConfig().colors.palette))).toEqual([]);
  });

  it('accepts a sparse tones kit, comparing only the steps present', () => {
    // Absent steps must not invent inversions.
    expect(errorsFor({ tones: ['#eafaf3', '#2e9b73', '#0d3b2b'] })).toEqual([]);
  });

  it('catches tones supplied out of order', () => {
    // `claim` only rejects two tones landing on the SAME step, never the wrong order.
    expect(errorsFor({ tones: { 600: '#2c3b4e', 700: '#4e5c6f' } }).length).toBeGreaterThan(0);
  });

  it('is what stops a bad palette reaching the stylesheet', () => {
    expect(() =>
      build(
        {
          ...defaultConfig(),
          colors: {
            ...defaultConfig().colors,
            palette: {
              ...defaultConfig().colors.palette,
              navy: { seed: '#1A2230', anchors: { 600: '#2c3b4e' } },
            },
          },
        },
        'css',
        '/nonexistent-assets',
      ),
    ).toThrow(/LIGHTER/);
  });
});
