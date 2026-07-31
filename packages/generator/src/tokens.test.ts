import { contrastLc, hexToOklch } from '@getvitops/utils/color';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from './index.ts';
import { checkContrast, expandPalette, functionalRole, NUMERIC_STEPS } from './tokens.ts';

const SEEDS = { pine: '#4A9075', slate: '#5B6472', rust: '#B23A32', cobalt: '#3B5BB5' };

describe('expandPalette (seeded)', () => {
  const expanded = expandPalette(
    Object.fromEntries(Object.entries(SEEDS).map(([k, seed]) => [k, { seed }])),
  );

  it('generates all 11 numeric steps with anchored tinted extremes', () => {
    for (const [name, hue] of Object.entries(expanded)) {
      for (const s of NUMERIC_STEPS) expect(hue.numeric?.[s], `${name}-${s}`).toBeTruthy();
      const light = hexToOklch(hue.numeric!['50']!);
      const dark = hexToOklch(hue.numeric!['950']!);
      expect(light.l, `${name}-50 near-white`).toBeGreaterThanOrEqual(0.93);
      expect(dark.l, `${name}-950 near-black`).toBeLessThanOrEqual(0.18);
      // chroma tapers toward the ends (tinted neutrals, not saturated)
      const mid = hexToOklch(hue.numeric!['500']!);
      expect(light.c).toBeLessThan(Math.max(mid.c, 0.03));
      expect(dark.c).toBeLessThan(Math.max(mid.c, 0.03));
    }
  });

  it('keeps the seed tone (verbatim anchor) at its natural step', () => {
    const pine = expanded.pine!.numeric!;
    const seedL = hexToOklch(SEEDS.pine).l;
    const closest = NUMERIC_STEPS.map((s) => hexToOklch(pine[s]!)).reduce((a, b) =>
      Math.abs(a.l - seedL) < Math.abs(b.l - seedL) ? a : b,
    );
    expect(Math.abs(closest.l - seedL)).toBeLessThan(0.03);
  });

  it('scale lightness is strictly monotonic (50 lightest … 950 darkest)', () => {
    const pine = expanded.pine!.numeric!;
    const Ls = NUMERIC_STEPS.map((s) => hexToOklch(pine[s]!).l);
    for (let i = 1; i < Ls.length; i++)
      expect(Ls[i]!, `step ${NUMERIC_STEPS[i]}`).toBeLessThan(Ls[i - 1]!);
  });
});

describe('functional tokens', () => {
  const expanded = expandPalette({ pine: { seed: SEEDS.pine }, slate: { seed: SEEDS.slate } });
  const numericOf = (h: string) => expanded[h]!.numeric!;

  it.each(['neutral', 'ui-primary', 'surface'])(
    '%s meets contrast targets (both modes)',
    (role: string) => {
      const hue = role === 'ui-primary' ? 'pine' : 'slate';
      const fr = functionalRole(role, hue, expanded[hue]!);
      expect(checkContrast(fr, numericOf)).toEqual([]);
    },
  );

  it('meets those targets for every role in the scaffolded config', () => {
    // The block above uses synthetic seeds. This one covers what `vitops init`
    // actually hands a consumer — every role, every background plane, both
    // appearances — so a palette edit can't quietly ship an unreadable pairing.
    const ds = defaultConfig();
    const pal = expandPalette(ds.colors.palette);
    const numeric = (h: string) => pal[h]!.numeric!;
    const failures = Object.entries(ds.colors.roles).flatMap(([role, hue]) =>
      checkContrast(functionalRole(role, hue as string, pal[hue as string]!), numeric),
    );
    expect(failures).toEqual([]);
  });

  it('dark mode flips bg/text ends; solid stays mode-stable', () => {
    const fr = functionalRole('neutral', 'slate', expanded.slate!)!;
    expect(fr.light.bg).not.toBe(fr.dark.bg);
    expect(fr.light.text).not.toBe(fr.dark.text);
    expect(fr.light.bg).toBe(fr.dark.text); // ends swap
    expect(fr.light.solid).toBe(fr.dark.solid);
    expect(fr.light['on-solid']).toBe(fr.dark['on-solid']);
  });
});

describe('fixed-tone kits', () => {
  it('uses authored tones verbatim, adds only tinted endpoints', () => {
    const tones = ['#29634D', '#4A9075', '#94C4AF'];
    const hue = expandPalette({ brand: { tones } }).brand!;
    const values = Object.values(hue.numeric!);
    for (const t of tones) expect(values).toContain(t);
    expect(hue.sparse).toBe(true);
    // endpoints exist and are near-white/near-black
    expect(hexToOklch(hue.numeric!['50']!).l).toBeGreaterThanOrEqual(0.93);
    expect(hexToOklch(hue.numeric!['950']!).l).toBeLessThanOrEqual(0.18);
    // nothing else invented: authored (3) + endpoints (2)
    expect(values).toHaveLength(5);
  });

  it('functional tokens snap to available tones and still pass contrast', () => {
    const hue = expandPalette({ brand: { tones: ['#29634D', '#4A9075'] } }).brand!;
    const fr = functionalRole('brand-primary', 'brand', hue)!;
    const failures = checkContrast(fr, () => hue.numeric!);
    expect(failures).toEqual([]);
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
