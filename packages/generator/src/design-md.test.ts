import { describe, expect, it } from 'vitest';
import { build } from './generate.ts';
import { defaultConfig } from './index.ts';
import { DARK_SEL } from './shared.ts';
import type { DesignSystem } from './schema.ts';

/**
 * The `design` format's contract with google-labs-code/design.md (alpha).
 *
 * These assertions exist because the failure mode is silent: a DESIGN.md that
 * parses but carries a `clamp()` where a `Dimension` belongs, or a `{colors.x}`
 * that resolves to nothing, still *looks* like a design system to a reader and
 * is worthless to a consumer. Nothing in the build validates it — the spec's own
 * CLI is not a dependency — so the invariants are pinned here.
 *
 * A nonexistent assetsDir is deliberate (as in the sibling tests): `build()`
 * assembles everything in memory, and `packages/generator/assets/**` is a
 * gitignored build artifact that `vp test` does not produce.
 */
const ASSETS = '/nonexistent-assets';
const md = (ds: DesignSystem = defaultConfig()) => build(ds, 'design', ASSETS).designMd;

/** Split the file into its YAML front matter and its markdown body. */
function split(doc: string): { fm: string; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(doc);
  if (!m) throw new Error('no front matter');
  return { fm: m[1] as string, body: m[2] as string };
}

/** Every `key: value` pair under a top-level front-matter block, at any depth. */
function blockEntries(fm: string, name: string): [string, string][] {
  const lines = fm.split('\n');
  const start = lines.findIndex((l) => l === `${name}:`);
  if (start === -1) return [];
  const out: [string, string][] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const kv = /^\s+("?)([^":]+)\1:\s*(.+)$/.exec(line);
    if (kv) out.push([kv[2] as string, (kv[3] as string).replace(/^"|"$/g, '')]);
  }
  return out;
}

const DIMENSION = /^-?(?:\d+\.?\d*|\.\d+)(?:px|em|rem)$/;

describe('DESIGN.md front matter', () => {
  it('is emitted only by the design format', () => {
    expect(build(defaultConfig(), 'css', ASSETS).designMd).toBe('');
    expect(build(defaultConfig(), 'tailwind', ASSETS).designMd).toBe('');
    expect(md()).toMatch(/^---\nversion: alpha\n/);
  });

  it('takes its name and description from `meta`', () => {
    const ds = { ...defaultConfig(), meta: { name: 'Acme', description: 'Loud and cheap.' } };
    const doc = md(ds);
    expect(doc).toContain('name: "Acme"');
    expect(doc).toContain('description: "Loud and cheap."');
    // The name also titles the document.
    expect(doc).toContain('\n# Acme\n');
    // …and without `meta`, the file is still valid rather than half-written.
    expect(md()).toContain('name: "Design System"');
  });

  it('emits every ramp step as a literal and every role token as a reference', () => {
    const colors = new Map(blockEntries(split(md()).fm, 'colors'));
    const ds = defaultConfig();
    for (const hue of Object.keys(ds.colors.palette))
      expect(colors.get(`${hue}-500`)).toMatch(/^#[0-9a-f]{6}$/i);
    for (const role of Object.keys(ds.colors.roles)) {
      // Flattened as the utility class name, so the brief and the markup
      // vocabulary are one thing. Each points at a ramp step.
      expect(colors.get(`text-${role}`)).toMatch(/^\{colors\.[a-z]+-\d+\}$/);
      expect(colors.get(`bg-${role}-muted`)).toMatch(/^\{colors\.[a-z]+-\d+\}$/);
      // `text-on-<role>` is the one exception: a computed contrast literal with
      // no step behind it, so a reference would be a lie.
      expect(colors.get(`text-on-${role}`)).toMatch(/^#[0-9a-f]{3,8}$/i);
    }
  });

  it('resolves every {colors.*} / {rounded.*} reference to a defined token', () => {
    const { fm } = split(md());
    const defined = {
      colors: new Set(blockEntries(fm, 'colors').map(([k]) => k)),
      rounded: new Set(blockEntries(fm, 'rounded').map(([k]) => k)),
      spacing: new Set(blockEntries(fm, 'spacing').map(([k]) => k)),
      typography: new Set(blockEntries(fm, 'typography').map(([k]) => k)),
    };
    const refs = [...fm.matchAll(/\{(colors|rounded|spacing|typography)\.([^}]+)\}/g)];
    expect(refs.length).toBeGreaterThan(0);
    for (const [, group, token] of refs)
      expect({ ref: `{${group}.${token}}`, defined: true }).toEqual({
        ref: `{${group}.${token}}`,
        defined: defined[group as keyof typeof defined].has(token as string),
      });
  });

  it('emits sizes as Dimensions, never as the fluid clamp() they really are', () => {
    const { fm } = split(md());
    expect(fm).not.toContain('clamp(');
    expect(fm).not.toContain('var(--');
    for (const [, v] of blockEntries(fm, 'spacing')) expect(v).toMatch(DIMENSION);
    for (const [, v] of blockEntries(fm, 'rounded'))
      if (!v.startsWith('{')) expect(v).toMatch(DIMENSION);
    // fontSize is nested a level deeper, so pick it out of the raw block.
    for (const [k, v] of blockEntries(fm, 'typography'))
      if (k === 'fontSize') expect(v).toMatch(DIMENSION);
  });

  it('drops a radius the spec cannot express rather than emitting a bad Dimension', () => {
    const ds = defaultConfig();
    ds.patterns = {
      ...ds.patterns,
      radii: { ...ds.patterns?.radii, circle: '50%' },
    } as DesignSystem['patterns'];
    const doc = md(ds);
    const rounded = new Map(blockEntries(split(doc).fm, 'rounded'));
    expect(rounded.has('circle')).toBe(false);
    // Dropped from the tokens, but stated in the prose — never silently lost.
    expect(split(doc).body).toContain('`circle` — `50%`');
    // A bare `0` IS expressible; it just needs a unit.
    expect([...rounded.values()].filter((v) => !v.startsWith('{'))).not.toContain('0');
  });

  it("describes a component's colours the way the CSS actually sets them", () => {
    const doc = split(md()).fm;
    // `cta` fills: default_role → solid, paired with on-solid.
    expect(doc).toMatch(
      / {2}cta:\n(?: {4}.+\n)*? {4}backgroundColor: "\{colors\.bg-ui-primary-solid\}"/,
    );
    expect(doc).toMatch(/ {2}cta:\n(?: {4}.+\n)*? {4}textColor: "\{colors\.text-on-ui-primary\}"/);
    // A hover carrying `step` is a real variant, emitted under the spec's
    // sibling-key convention.
    expect(doc).toMatch(
      / {2}cta-hover:\n {4}backgroundColor: "\{colors\.bg-ui-primary-solid-bold\}"/,
    );
    // `btn` sets `fill: false` and `color: inherit`, so it must claim neither.
    const btn = /( {2}btn:\n(?: {4}.+\n)*)/.exec(doc)?.[1] ?? '';
    expect(btn).not.toContain('backgroundColor');
    expect(btn).not.toContain('textColor');
  });
});

describe('DESIGN.md prose body', () => {
  it('keeps the spec section order', () => {
    const headings = [...split(md()).body.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(headings).toEqual([
      'Overview',
      'Colors',
      'Typography',
      'Layout & Spacing',
      'Elevation & Depth',
      'Shapes',
      'Components',
      "Do's and Don'ts",
    ]);
  });

  it('names the live dark selector rather than a hard-coded copy of it', () => {
    expect(split(md()).body).toContain(DARK_SEL);
  });

  it('describes the config it was given, not a remembered one', () => {
    const ds = defaultConfig();
    ds.colors.palette = { only: { seed: '#123456' } };
    ds.colors.roles = Object.fromEntries(
      Object.keys(ds.colors.roles).map((r) => [r, 'only']),
    ) as typeof ds.colors.roles;
    const body = split(md(ds)).body;
    expect(body).toContain('1 hue (`only`)');
    expect(body).toContain('- `ui-primary` → `only`');
  });
});
