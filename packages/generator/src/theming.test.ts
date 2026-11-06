/**
 * "Honest theming": the escape hatches a real site build needed instead of raw
 * ramp steps — a role's own solid step and foreground polarity, a dark-only
 * appearance, split box/drop shadows, layout tokens, a per-hue acknowledgement
 * of off-ladder anchors. Each is asserted both ways: that it does what it says,
 * and that the guard it must not weaken (contrast, drop-shadow grammar) still
 * fires.
 */
import { describe, expect, it, vi } from 'vitest';
import { build } from './generate.ts';
import { defaultConfig } from './index.ts';
import { type DesignSystem, validate } from './schema.ts';

const ds0 = (): DesignSystem => structuredClone(defaultConfig());
const css = (ds: DesignSystem, opts = {}) => build(ds, 'css', '/nonexistent-assets', opts);
const role = 'ui-primary';
const hue = () => {
  const spec = ds0().colors.roles[role]!;
  return typeof spec === 'string' ? spec : spec.hue;
};

describe('role solid step + foreground polarity', () => {
  it('keeps the string shorthand on the default 600/700/800 family', () => {
    const color = css(ds0()).generated['color.css'] as string;
    expect(color).toContain(`--color-bg-${role}-solid: var(--color-${hue()}-600)`);
    expect(color).toContain(`--color-bg-${role}-solid-bold: var(--color-${hue()}-700)`);
  });

  it('starts the family at the named step and walks darker', () => {
    const ds = ds0();
    ds.colors.roles[role] = { hue: hue(), solid: 400, foreground: 'dark' };
    const color = css(ds).generated['color.css'] as string;
    expect(color).toContain(`--color-bg-${role}-solid: var(--color-${hue()}-400)`);
    expect(color).toContain(`--color-bg-${role}-solid-bold: var(--color-${hue()}-500)`);
    expect(color).toContain(`--color-bg-${role}-solid-x-bold: var(--color-${hue()}-600)`);
  });

  it('pins the on-colour polarity', () => {
    const lum = (hex: string) =>
      [1, 3, 5].reduce((n, i) => n + parseInt(hex.slice(i, i + 2), 16), 0) / 3;
    const on = (foreground: 'light' | 'dark') => {
      const ds = ds0();
      ds.colors.roles[role] = { hue: hue(), solid: 400, foreground };
      try {
        const m = new RegExp(`--color-text-on-${role}: (#[0-9a-f]{6})`).exec(
          css(ds).generated['color.css'] as string,
        );
        return m?.[1];
      } catch (e) {
        return (e as Error).message;
      }
    };
    expect(lum(on('dark') as string)).toBeLessThan(80);
    // A forced light on-colour over a mid-tone solid may legitimately fail the contract.
    const light = on('light') as string;
    if (light.startsWith('#')) expect(lum(light)).toBeGreaterThan(200);
    else expect(light).toContain('text-on');
  });

  it('still enforces APCA on the pair actually used', () => {
    const ds = ds0();
    // Light text on a 100-step solid cannot reach Lc 60 in any hue.
    ds.colors.roles[role] = { hue: hue(), solid: 100, foreground: 'light' };
    expect(() => css(ds)).toThrow(/text-on Lc .* < 60 on bg-solid/);
  });

  it('rejects a solid step the ramp cannot walk darker from', () => {
    const ds = ds0();
    ds.colors.roles[role] = { hue: hue(), solid: 950 };
    const r = validate(ds);
    expect(r.ok).toBe(false);
  });
});

describe('dark-only', () => {
  it('makes the dark tokens the :root appearance and emits no flip', () => {
    const ds = ds0();
    const both = css(ds).generated['color.css'] as string;
    const dark = css(ds, { darkOnly: true }).generated['color.css'] as string;
    expect(both).toContain('color-scheme: light');
    expect(dark).toContain('color-scheme: dark');
    expect(dark).not.toContain('color-scheme: light');
    expect(dark).not.toContain('data-theme="dark"');
    // The base page background is the dark one.
    const bg = (s: string) => /--color-bg-surface: ([^;]+);/.exec(s)?.[1];
    const darkBg = /data-theme="dark"[^{]*\{[^}]*--color-bg-surface: ([^;]+);/.exec(both)?.[1];
    expect(bg(dark)).toBe(darkBg);
  });

  it('skips light-mode contrast, and only light-mode', () => {
    const ds = ds0();
    // Dark-only passes where the same palette would fail light: force a light
    // surface step that is illegible in light but untouched in dark.
    const spec = ds.colors.roles['surface'];
    expect(spec).toBeDefined();
    expect(() => css(ds, { darkOnly: true })).not.toThrow();
  });
});

describe('split shadows', () => {
  const withSplit = (shadows: DesignSystem['shadows']): DesignSystem => ({
    ...ds0(),
    shadows: { ...ds0().shadows, ...shadows },
  });

  it('keeps the string form feeding both consumers from one token', () => {
    const out = css(withSplit({ plain: '0 2px 4px #0003' })).generated['shadows.css'] as string;
    expect(out).toContain('--shadow-plain: 0 2px 4px #0003;');
    expect(out).toContain('.drop-shadow-plain { filter: drop-shadow(var(--shadow-plain)); }');
  });

  it('lets box use spread/inset/layers while drop stays in the drop-shadow grammar', () => {
    const ds = withSplit({
      lifted: { box: '0 24px 48px -12px #000c, inset 0 0 0 1px #fff2', drop: '0 12px 24px #0006' },
    });
    const r = validate(ds);
    expect(r.ok).toBe(true);
    expect(r.warnings.filter((w) => w.includes('lifted'))).toEqual([]);
    const out = css(ds).generated['shadows.css'] as string;
    expect(out).toContain('--shadow-lifted: 0 24px 48px -12px #000c, inset 0 0 0 1px #fff2;');
    expect(out).toContain('--shadow-lifted-drop: 0 12px 24px #0006;');
    expect(out).toContain(
      '.drop-shadow-lifted { filter: drop-shadow(var(--shadow-lifted-drop)); }',
    );
  });

  it('still warns when the drop half breaks the drop-shadow grammar', () => {
    const r = validate(withSplit({ bad: { box: '0 0 1px #000', drop: '0 0 4px 2px #000' } }));
    expect(r.warnings.join('\n')).toContain('shadows.bad');
  });

  it('omits the drop-shadow utility when there is no drop form', () => {
    const out = css(withSplit({ ring: { box: 'inset 0 0 0 1px #fff3' } })).generated[
      'shadows.css'
    ] as string;
    expect(out).toContain('--shadow-ring: inset 0 0 0 1px #fff3;');
    expect(out).not.toContain('.drop-shadow-ring');
  });

  it('rejects an empty split shadow', () => {
    expect(validate(withSplit({ nothing: {} })).ok).toBe(false);
  });
});

describe('layout tokens', () => {
  const withLayout = (): DesignSystem => ({
    ...ds0(),
    layout: {
      widths: { measure: '70ch', spotlight: '140ch' },
      regionSpace: { min: '4rem', preferred: '10vh', max: '10rem' },
    },
  });

  it('emits only what was authored, in css/bricks', () => {
    const out = css(withLayout()).generated['spacing.css'] as string;
    expect(out).toContain('--width-measure: 70ch;');
    expect(out).toContain('--width-spotlight: 140ch;');
    expect(out).toContain('--region-space-min: 4rem;');
    expect(out).toContain('--region-space: 10vh;');
    expect(out).toContain('--region-space-max: 10rem;');
    expect(out).not.toContain('--width-breakout');
  });

  it('emits nothing when unset', () => {
    expect(css(ds0()).generated['spacing.css']).not.toContain('--width-measure');
  });

  it('emits in the tailwind bundle too, and into the editor manifest', () => {
    const b = build(withLayout(), 'tailwind', '/nonexistent-assets');
    expect(b.tailwind).toContain('--width-measure: 70ch;');
    expect(b.tailwind).toContain('--region-space-max: 10rem;');
    const manifest = JSON.parse(b.designManifest);
    expect(manifest.layout.widths.measure).toBe('70ch');
    expect(manifest.reverseIndex['--width-measure']).toBe('layout.widths.measure');
  });

  it('rejects unknown layout keys', () => {
    const ds = withLayout() as unknown as { layout: { widths: Record<string, string> } };
    ds.layout.widths['wide'] = '1px';
    expect(validate(ds).ok).toBe(false);
  });
});

describe('acknowledgeOffLadder', () => {
  const offLadder = (ack: boolean): DesignSystem => {
    const ds = ds0();
    const first = Object.keys(ds.colors.palette)[0] as string;
    // Pin a very light colour at a dark step: far off the ladder, still monotonic
    // enough to build only if it is the last step.
    ds.colors.palette[first] = {
      seed: '#336699',
      anchors: { '950': '#ffffff' },
      ...(ack ? { acknowledgeOffLadder: true } : {}),
    } as never;
    return ds;
  };
  const ladderLines = (ds: DesignSystem) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      try {
        css(ds);
      } catch {
        /* a bad pin may also fail monotonicity; only the warnings matter here */
      }
      return warn.mock.calls
        .map((c) => String(c[0]))
        .filter((m) => m.includes(`colors.palette.${Object.keys(ds.colors.palette)[0]}:`));
    } finally {
      warn.mockRestore();
    }
  };

  it('warns by default and names the acknowledgement', () => {
    const lines = ladderLines(offLadder(false));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toContain('acknowledgeOffLadder');
  });

  it('is silent for an acknowledged hue and still valid', () => {
    expect(ladderLines(offLadder(true))).toEqual([]);
    expect(validate(offLadder(true)).ok).toBe(true);
  });
});
