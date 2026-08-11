import { describe, expect, it } from 'vitest';
import { build } from './generate.ts';
import { defaultConfig, validate } from './index.ts';
import type { DesignSystem } from './schema.ts';

/**
 * The `design-manifest.json` contract, as consumed by `<wc-theme-editor>`
 * (@getvitops/core/editor). The editor is the only reader, it fetches the file at
 * runtime, and it fails *silently* on a shape mismatch — the previous iteration
 * read `colors.named` against a manifest that has always emitted `colors.palette`
 * and rendered nothing at all for months. These assertions are the tripwire.
 *
 * A nonexistent assetsDir is fine for `format: 'css'`: `build()` assembles the
 * generated layers in memory and the framework partials are only read later.
 */
const manifestOf = (ds: DesignSystem = defaultConfig()) =>
  JSON.parse(build(ds, 'css', '/nonexistent-assets').designManifest) as {
    colors: {
      ramps: string[];
      steps: string[];
      palette: Record<string, Record<string, string>>;
      roles: { name: string; ramp: string; kind: 'surface' | 'chromatic' }[];
      roleTokens: Record<
        string,
        {
          chromatic: { light: Record<string, string>; dark: Record<string, string> };
          surface: { light: Record<string, string>; dark: Record<string, string> };
        }
      >;
    };
    typography: {
      roles: string[];
      hooks: Record<string, { prop: string; key: string }>;
      specs: Record<string, Record<string, string | number>>;
    };
    patterns: {
      radii: Record<string, string>;
      items: { name: string; wrappable: { sfx: string; prop: string }[] }[];
    };
    reverseIndex: Record<string, string>;
  };

describe('design-manifest: colours', () => {
  it('keys the palette as `palette` (not `named`) with bare numeric steps', () => {
    const m = manifestOf();
    expect(Object.keys(m.colors.palette).length).toBeGreaterThan(0);
    expect(m.colors.steps).toContain('500');
    // No 'base' step: the redesign replaced named steps with the 11 numeric ones,
    // and an editor branching on 'base' silently produces vars nothing reads.
    expect(m.colors.steps).not.toContain('base');
    for (const hue of m.colors.ramps) expect(m.colors.palette[hue]).toBeDefined();
  });

  it('ships a token set per hue and role KIND, in both appearances', () => {
    const m = manifestOf();
    for (const hue of m.colors.ramps) {
      const entry = m.colors.roleTokens[hue];
      expect(entry, `roleTokens.${hue}`).toBeDefined();
      for (const kind of ['chromatic', 'surface'] as const)
        for (const scheme of ['light', 'dark'] as const) {
          const tokens = Object.keys(entry?.[kind][scheme] ?? {});
          // Everything a role remap has to rewrite, whichever kind it is.
          for (const t of ['bg-muted', 'border', 'text', 'bg-solid', 'text-on'])
            expect(tokens, `${hue}.${kind}.${scheme}`).toContain(t);
          // The kinds are genuinely different shapes — that is why there are two.
          if (kind === 'surface') expect(tokens).toContain('bg');
          else expect(tokens).not.toContain('bg');
        }
    }
  });

  it('gives `text-on` as a literal, since it is computed and not derivable', () => {
    const m = manifestOf();
    const hue = m.colors.ramps[0] as string;
    // Every other token is a var() ref into the hue; text-on is a contrast pick,
    // so a client that assumed "all values are var(--color-…)" would break here.
    expect(m.colors.roleTokens[hue]?.chromatic.light['bg-muted']).toMatch(/^var\(--color-/);
    expect(m.colors.roleTokens[hue]?.chromatic.light['text-on']).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('carries each role kind so the editor picks the right set on a remap', () => {
    // The editor used to infer this from `role === 'surface'`, which silently did
    // the wrong thing for any other surface-kind role (`neutral`, or a consumer's
    // own `canvas`). It travels with the role now.
    const m = manifestOf();
    const byName = new Map(m.colors.roles.map((r) => [r.name, r.kind]));
    expect(byName.get('surface')).toBe('surface');
    expect(byName.get('neutral')).toBe('surface');
    expect(byName.get('danger')).toBe('chromatic');
  });
});

describe('design-manifest: reverseIndex', () => {
  it('maps each palette step to its own anchor, not the hue seed', () => {
    const m = manifestOf();
    const hue = m.colors.ramps[0] as string;
    // Mapping every step to `…seed` is lossy twice: a step's hex would re-seed the
    // whole ramp, and two edits to one hue would collapse to a single value.
    expect(m.reverseIndex[`--color-${hue}-700`]).toBe(`colors.palette.${hue}.anchors.700`);
    const paths = m.colors.steps.map((s) => m.reverseIndex[`--color-${hue}-${s}`]);
    expect(new Set(paths).size).toBe(m.colors.steps.length);
  });

  it('never lets a radius and a pattern claim the same --br-* var', () => {
    const m = manifestOf();
    const items = new Set(m.patterns.items.map((i) => i.name));
    for (const name of Object.keys(m.patterns.radii)) {
      if (!items.has(name)) continue;
      // The pattern's BASE_HOOK is the documented override, so it must win — the
      // radius path being written last would make the hook unreachable.
      expect(m.reverseIndex[`--br-${name}`]).toBe(`patterns.items.${name}.base.border-radius`);
    }
  });

  it('drops the dead `interaction` block', () => {
    // Hardcoded literal with no schema key, no reverseIndex entry and no CSS var.
    expect(manifestOf()).not.toHaveProperty('interaction');
  });
});

describe('design-manifest: patch round-trip', () => {
  /** The editor's mapping: overrides → deep-set reverseIndex paths → a patch. */
  const deepSet = (obj: Record<string, unknown>, path: string, value: string) => {
    const keys = path.split('.');
    let node = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i] as string;
      if (typeof node[k] !== 'object' || node[k] == null) node[k] = {};
      node = node[k] as Record<string, unknown>;
    }
    node[keys[keys.length - 1] as string] = value;
  };
  const merge = (base: unknown, patch: unknown): unknown => {
    const isPlain = (v: unknown): v is Record<string, unknown> =>
      typeof v === 'object' && v !== null && !Array.isArray(v);
    if (!isPlain(base) || !isPlain(patch)) return patch;
    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(patch)) out[k] = merge(base[k], v);
    return out;
  };

  it('produces a patch that still validates when merged into source', () => {
    const ds = defaultConfig();
    const m = manifestOf(ds);
    const hue = m.colors.ramps[0] as string;
    const otherHue = (m.colors.ramps[1] ?? hue) as string;

    const patch: Record<string, unknown> = {};
    // One of each kind the editor emits: a palette step, a role remap, a pattern
    // default, and a component geometry override.
    deepSet(patch, m.reverseIndex[`--color-${hue}-500`] as string, '#123456');
    deepSet(patch, `colors.roles.${m.colors.roles[0]?.name}`, otherHue);
    deepSet(patch, m.reverseIndex['--br-default'] as string, '0.75rem');
    const item = m.patterns.items.find((i) => i.wrappable.length) as {
      name: string;
      wrappable: { sfx: string }[];
    };
    deepSet(patch, m.reverseIndex[`--${item.wrappable[0]?.sfx}-${item.name}`] as string, '2rem');

    const result = validate(merge(ds, patch));
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('regenerates cleanly from the merged config', () => {
    const ds = defaultConfig();
    const m = manifestOf(ds);
    const hue = m.colors.ramps[0] as string;
    // L 0.652 — on the step-500 rung, so the anchor moves the colour without
    // inverting the ramp. (A dark placeholder like #123456 is L 0.319, which
    // belongs around step 900; pinning it at 500 makes 600 lighter than 500 and
    // the build now rejects it. That is the check working, not the fixture.)
    const merged = merge(ds, {
      colors: { palette: { [hue]: { anchors: { '500': '#e0663a' } } } },
    }) as DesignSystem;
    // The anchor has to actually move the ramp, or "save to source" would appear
    // to work and change nothing.
    expect(manifestOf(merged).colors.palette[hue]?.['500']).toBe('#e0663a');
  });
});

describe('design-manifest: typography', () => {
  /**
   * The editor renders one control per `typography.hooks` entry for every role,
   * and `buildPatch` saves a control only if `reverseIndex` has its var. Anything
   * missing here previews live and is then silently dropped on "Save to source" —
   * the worst failure mode the editor has, because the preview says it worked.
   */
  it('reverse-indexes every hook of every role, not just the declared ones', () => {
    const m = manifestOf();
    for (const role of m.typography.roles)
      for (const [sfx, { key }] of Object.entries(m.typography.hooks))
        expect(m.reverseIndex[`--${role}-${sfx}`]).toBe(`typography.roles.${role}.${key}`);
  });

  it('indexes a hook the role leaves undeclared', () => {
    const ds = defaultConfig();
    // `body` declares no tracking — its `--body-ls` control must still be savable.
    expect(ds.typography?.roles?.body?.tracking).toBeUndefined();
    expect(manifestOf(ds).reverseIndex['--body-ls']).toBe('typography.roles.body.tracking');
  });
});

describe('validate: token-namespace warnings', () => {
  it('warns when a radius is named after a pattern', () => {
    const ds = defaultConfig();
    ds.patterns!.radii = { ...ds.patterns?.radii, badge: '4px' };
    ds.patterns!.items = {
      badge: { class: 'badge', base: { padding: '0.2em' } },
    };
    const result = validate(ds);
    expect(result.ok).toBe(true);
    expect(result.warnings.join('\n')).toContain('--br-badge');
  });

  it('stays quiet for a clean config', () => {
    const ds = defaultConfig();
    ds.patterns!.radii = { circle: '50%' };
    expect(validate(ds).warnings).toEqual([]);
  });
});
