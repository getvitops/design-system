import { describe, expect, it } from 'vitest';
import { defaultConfig } from './index.ts';
import { jsonSchema, validate } from './schema.ts';
import { siteJsonSchema } from './site.ts';

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

describe('site-config JSON Schema descriptions', () => {
  it('describes every top-level field', () => {
    const props = (siteJsonSchema as unknown as Node).properties ?? {};
    expect(Object.keys(props).length).toBeGreaterThan(30);
    for (const [key, node] of Object.entries(props))
      expect(node.description, `${key} needs a description`).toBeTruthy();
  });
});
