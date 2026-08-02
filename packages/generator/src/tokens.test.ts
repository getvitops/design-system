import { LIGHTNESS_LADDER, contrastLc, hexToOklch } from '@getvitops/utils/color';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from './index.ts';
import { roleHue, roleKind } from './shared.ts';
import {
  checkContrast,
  expandPalette,
  functionalRole,
  ladderWarnings,
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
