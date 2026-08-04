import { describe, expect, it } from 'vitest';
import { defaultConfig } from './index.ts';
import { jsonSchema, validate } from './schema.ts';
import { configJsonSchema } from './config.ts';

interface Node {
  description?: string;
  properties?: Record<string, Node>;
  additionalProperties?: Node | boolean;
  anyOf?: Node[];
}

describe('design-system JSON Schema descriptions', () => {
  const props = (jsonSchema as unknown as Node).properties ?? {};

  it('describes every top-level field', () => {
    for (const [key, node] of Object.entries(props)) {
      if (key === '$schema') continue;
      expect(node.description, `${key} needs a description`).toBeTruthy();
    }
  });

  it('propagates nested descriptions through toJSONSchema', () => {
    const palette = props.colors?.properties?.palette;
    expect(palette?.description).toContain('Palette hues');
    const rampVariants = (palette?.additionalProperties as Node)?.anyOf ?? [];
    expect(rampVariants.length).toBe(2);
    for (const v of rampVariants) expect(v.description).toBeTruthy();
  });

  it('gives the shared Scale schema distinct per-use-site descriptions', () => {
    // Proves .check(z.describe(…)) cloned rather than mutated the shared node.
    expect(props.typeScale?.description).toContain('TYPE');
    expect(props.spaceScale?.description).toContain('SPACE');
    expect(props.typeScale?.description).not.toEqual(props.spaceScale?.description);
  });

  it('leaves runtime validation behaviour unchanged', () => {
    expect(validate(defaultConfig()).ok).toBe(true);
    // Minimal config: only `colors` is required.
    const minimal = validate({
      colors: { palette: { brand: { seed: '#2e9b73' } }, roles: { neutral: 'brand' } },
    });
    expect(minimal.ok).toBe(true);
    expect(validate({}).ok).toBe(false);
  });
});

describe('config JSON Schema descriptions', () => {
  /**
   * The top level is three sections, so a top-level-only check would assert
   * almost nothing. The fields that need describing live one level down — and
   * they are the ones `vitops docs config` renders.
   */
  it('describes all three sections', () => {
    const props = (configJsonSchema as unknown as Node).properties ?? {};
    expect(Object.keys(props).sort()).toEqual(['designSystem', 'organization', 'site']);
    for (const [key, node] of Object.entries(props))
      expect(node.description, `${key} needs a description`).toBeTruthy();
  });

  it('describes every field of the site and organization sections', () => {
    const props = (configJsonSchema as unknown as Node).properties ?? {};
    for (const section of ['site', 'organization'] as const) {
      const fields = props[section]?.properties ?? {};
      expect(Object.keys(fields).length, `${section} should have fields`).toBeGreaterThan(4);
      for (const [key, node] of Object.entries(fields))
        expect(node.description, `${section}.${key} needs a description`).toBeTruthy();
    }
  });

  /**
   * The descriptions ARE the authoring documentation — `vitops docs authoring`
   * renders them, and editors show them as hovers. A top-level-only check stopped
   * covering `defaultTheme` / `defaultColorScheme` the moment they moved inside
   * `designSystem`, which is exactly when an undescribed field is easiest to ship.
   */
  it('describes every field of the designSystem block', () => {
    const ds = ((configJsonSchema as unknown as Node).properties ?? {}).designSystem;
    expect(ds?.description, 'the designSystem block itself needs a description').toBeTruthy();
    const props = ds?.properties ?? {};
    expect(Object.keys(props)).toEqual(
      expect.arrayContaining(['themes', 'defaultTheme', 'defaultColorScheme']),
    );
    for (const [key, node] of Object.entries(props))
      expect(node.description, `designSystem.${key} needs a description`).toBeTruthy();
  });
});

/**
 * Runtime validation and the published JSON Schema derive from the same zod
 * schema, but they used to disagree: `toJSONSchema` emits
 * `additionalProperties: false`, while a plain `z.object` *strips* unknown keys
 * at runtime. So an editor honouring `$schema` flagged what `vitops validate`
 * called `✓ valid` — and the config that slipped through was one whose extra
 * keys were being silently discarded at generate time.
 *
 * The `{ seed, tones }` case is the expensive one: it fails both `Ramp` branches,
 * so the raw union error is a bare "Invalid input" that names neither key.
 */
describe('validate() is as strict as the published schema', () => {
  const withHue = (hue: unknown) => ({
    colors: { palette: { brand: hue }, roles: { neutral: 'brand' } },
  });
  const failure = (input: unknown) => {
    const r = validate(input);
    expect(r.ok, 'expected this config to be rejected').toBe(false);
    if (r.ok) throw new Error('unreachable');
    return r.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(' | ');
  };

  it('rejects a hue that is both seeded and fixed, and says which to drop', () => {
    const msg = failure(withHue({ seed: '#2e9b73', tones: {} }));
    expect(msg).toContain('colors.palette.brand');
    expect(msg).toMatch(/not both/);
    // The reason it matters, not just that it's invalid.
    expect(msg).toContain('ignored at generate time');
  });

  it('rejects an unknown key on a hue and names it', () => {
    expect(failure(withHue({ seed: '#2e9b73', anchor: {} }))).toContain('"anchor"');
  });

  it('rejects an unknown key anywhere else and names it', () => {
    const msg = failure({ ...withHue({ seed: '#2e9b73' }), spaceScale: { base: '1rem', nope: 1 } });
    expect(msg).toContain('spaceScale');
    expect(msg).toContain('"nope"');
  });

  it('still accepts both legitimate hue forms', () => {
    expect(validate(withHue({ seed: '#2e9b73' })).ok).toBe(true);
    expect(validate(withHue({ seed: '#2e9b73', anchors: { 600: '#1f6b50' } })).ok).toBe(true);
    expect(validate(withHue({ tones: ['#eafaf3', '#2e9b73', '#0d3b2b'] })).ok).toBe(true);
  });
});
