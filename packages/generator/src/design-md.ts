/**
 * `DESIGN.md` emitter — the `design` format.
 *
 * DESIGN.md (google-labs-code/design.md, alpha) is a single plain-text file that
 * gives AI coding agents a persistent, structured understanding of a visual
 * identity: YAML front matter carrying the tokens, then a prose body carrying the
 * *why*. It is the agent-facing sibling of `tokens.json` — where that file is a
 * verbatim dump for programmatic consumers, this one is curated for a reader.
 *
 * Three impedance mismatches between our schema and the spec, resolved the same
 * way every time (and stated in the prose so the file is self-describing):
 *
 *  • **Fluid sizes are `clamp()`**; a spec `Dimension` is a bare number + px/em/rem.
 *    → Emit the scale's **max** rem as the canonical size and say in the prose that
 *      the real token is fluid. A `clamp()` string would fail every consumer's parse.
 *  • **Dark mode has no first-class representation.** → `colors` carries the LIGHT
 *    values; the Colors prose explains that the framework flips functionally at
 *    runtime, so an agent that uses the role tokens gets dark mode for free and
 *    should never hand-pick a dark value.
 *  • **A role is not a ramp alias.** Functional tokens resolve to a ramp step, so
 *    they are emitted as `{colors.<hue>-<step>}` **references** rather than
 *    flattened hexes — that keeps the role → ramp lineage visible in the file,
 *    which is the one thing a flattened export destroys. `on-solid` is the
 *    exception: it is a computed contrast literal with no step behind it.
 */
import type { DesignSystem } from './schema.ts';
import { DARK_SEL, type RoleSpec, roleHue } from './shared.ts';
import { tokenClass, type ExpandedHue, type FunctionalRole } from './tokens.ts';

/** Structural view of `generate.ts`'s ScaleStep (kept local to avoid a cycle). */
interface Step {
  name: string;
  value: string;
  max: string;
}

export interface DesignMdCtx {
  ds: DesignSystem;
  expandedPalette: Record<string, ExpandedHue>;
  scaleRoles: FunctionalRole[];
  typeSteps: Step[];
  spaceSteps: Step[];
  shadows: Record<string, string> | undefined;
}

interface PatternItem {
  group?: string;
  overrides?: Record<string, string>;
  element?: string;
  class?: string;
  fill?: boolean;
  default_role?: string;
  base?: Record<string, string>;
  states?: Record<string, Record<string, unknown>>;
  roles?: string[];
}

// ── minimal YAML writer ───────────────────────────────────────────────────────
// Hand-rolled rather than pulled in as a dependency: the generator emits a fixed,
// known shape (scalars two levels deep), and every string is double-quoted so
// nothing here has to reason about YAML's plain-scalar edge cases — `#RRGGBB`
// starting a comment, `{colors.x}` reading as a flow mapping, `2xl` as a key.
const q = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
/** Keys are quoted only when they would not survive as a plain scalar. */
const key = (k: string) => (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(k) ? k : q(k));
const scalar = (v: string | number) => (typeof v === 'number' ? String(v) : q(v));

const yamlMap = (name: string, entries: [string, string | number][], indent = ''): string =>
  entries.length === 0
    ? ''
    : `${indent}${name}:\n` +
      entries.map(([k, v]) => `${indent}  ${key(k)}: ${scalar(v)}`).join('\n') +
      '\n';

// ── value resolution ──────────────────────────────────────────────────────────
/** `var(--x)` → `x`, else undefined. Tolerates a fallback: `var(--x, y)` → `x`. */
const varName = (v: string): string | undefined => {
  const m = /^var\(\s*--([a-z0-9-]+)\s*(?:,[^)]*)?\)$/i.exec(v.trim());
  return m ? (m[1] as string) : undefined;
};

/** A spec `Dimension` is a number plus px / em / rem — nothing else parses. */
const isDimension = (v: string) => /^-?(?:\d+\.?\d*|\.\d+)(?:px|em|rem)$/.test(v.trim());

/**
 * Only these reach a `Color` slot. `inherit` / `currentColor` / `initial` are
 * valid CSS in a pattern's `base` and meaningless as a token value, so a
 * component that says `color: inherit` emits no `textColor` at all rather than
 * an unresolvable one.
 */
const isColorLiteral = (v: string) =>
  /^#[0-9a-f]{3,8}$/i.test(v.trim()) ||
  /^(?:rgba?|hsla?|hwb|oklch|oklab|lch|lab|color-mix)\(/i.test(v.trim()) ||
  /^(?:transparent|white|black)$/i.test(v.trim());

export function emitDesignMd(ctx: DesignMdCtx): string {
  const { ds, expandedPalette, scaleRoles, typeSteps, spaceSteps, shadows } = ctx;
  const meta = ds.meta ?? {};
  const name = meta.name ?? 'Design System';
  const roleMap = ds.colors.roles as Record<string, RoleSpec>;
  const patterns = ds.patterns ?? {};
  const pDefaults = (patterns.defaults ?? {}) as Record<string, string>;
  const pRadii = (patterns.radii ?? {}) as Record<string, string>;
  const pGroups = (patterns.groups ?? {}) as Record<string, Record<string, string>>;
  const pItems = (patterns.items ?? {}) as Record<string, PatternItem>;

  // ── colors ─────────────────────────────────────────────────────────────────
  // Raw ramps first (they are what everything else references), then the
  // functional role tokens as refs into them, then the spec's recommended names
  // as refs into those. Three layers, each one hop from the last.
  const ramps: [string, string][] = [];
  for (const [hue, expanded] of Object.entries(expandedPalette))
    for (const [step, hex] of Object.entries(expanded.numeric)) ramps.push([`${hue}-${step}`, hex]);

  const rampNames = new Set(ramps.map(([k]) => k));
  /** `var(--color-<hue>-<step>)` → `{colors.<hue>-<step>}`; literals pass through. */
  const rampRef = (value: string): string => {
    const v = varName(value);
    const bare = v?.startsWith('color-') ? v.slice('color-'.length) : undefined;
    return bare && rampNames.has(bare) ? `{colors.${bare}}` : value;
  };

  const roleTokens: [string, string][] = [];
  for (const fr of scaleRoles)
    for (const [token, value] of Object.entries(fr.light))
      // Flattened as the utility class name (`bg-surface`, `text-on-danger`) —
      // the same string an agent would write in markup, so the brief and the
      // markup vocabulary are one thing rather than two.
      roleTokens.push([tokenClass(fr.role, token), rampRef(value)]);

  const colorNames = new Set([...rampNames, ...roleTokens.map(([k]) => k)]);
  /** Recommended-name alias, emitted only when the role behind it exists. */
  const aliasAs = (as: string, token: string): [string, string][] =>
    colorNames.has(token) ? [[as, `{colors.${token}}`]] : [];
  // The spec's non-normative recommended names (`primary`, `on-primary`,
  // `error`, …). Ours are role-scoped, so nothing here is a new value — each is
  // a one-hop reference, which is exactly what makes a generic DESIGN.md
  // consumer (and the linter's `primary`-must-exist rule) work against a
  // vocabulary that never uses those words.
  const interop: [string, string][] = [
    ...aliasAs('primary', 'bg-ui-primary-solid'),
    ...aliasAs('on-primary', 'text-on-ui-primary'),
    ...aliasAs('secondary', 'bg-ui-secondary-solid'),
    ...aliasAs('on-secondary', 'text-on-ui-secondary'),
    ...aliasAs('tertiary', 'bg-ui-accent-solid'),
    ...aliasAs('on-tertiary', 'text-on-ui-accent'),
    ...aliasAs('neutral', 'bg-neutral'),
    ...aliasAs('surface', 'bg-surface'),
    ...aliasAs('on-surface', 'text-surface'),
    ...aliasAs('error', 'bg-danger-solid'),
    ...aliasAs('on-error', 'text-on-danger'),
  ];

  // ── typography ─────────────────────────────────────────────────────────────
  const fonts = (ds.fonts ?? {}) as Record<string, string>;
  const families = (ds.typography?.families ?? {}) as Record<string, string>;
  /** `display` → `var(--font-display)` → the actual stack. */
  const fontStack = (family: string | undefined): string | undefined => {
    if (!family) return undefined;
    const declared = families[family];
    if (declared == null) return fonts[family];
    const v = varName(declared);
    const bare = v?.startsWith('font-') ? v.slice('font-'.length) : undefined;
    return (bare && fonts[bare]) ?? declared;
  };
  const textMax = new Map(typeSteps.map((s) => [s.name, s.max]));
  /** `var(--text-3xl)` → that step's MAX rem (a clamp() is not a Dimension). */
  const typeSize = (size: string | number | undefined): string | undefined => {
    if (size == null) return undefined;
    const raw = String(size);
    const v = varName(raw);
    const bare = v?.startsWith('text-') ? v.slice('text-'.length) : undefined;
    const resolved = bare != null ? textMax.get(bare) : raw;
    return resolved != null && isDimension(resolved) ? resolved : undefined;
  };

  const typoRoles = (ds.typography?.roles ?? {}) as Record<
    string,
    Record<string, string | number | undefined>
  >;
  const typography: [string, [string, string | number][]][] = [];
  for (const [role, spec] of Object.entries(typoRoles)) {
    const props: [string, string | number][] = [];
    const stack = fontStack(spec.family as string | undefined);
    if (stack) props.push(['fontFamily', stack]);
    const size = typeSize(spec.size);
    if (size) props.push(['fontSize', size]);
    if (spec.weight != null) props.push(['fontWeight', Number(spec.weight)]);
    const lh = spec['line-height'];
    if (lh != null) {
      const n = Number(lh);
      props.push(['lineHeight', Number.isFinite(n) ? n : String(lh)]);
    }
    const tracking = spec.tracking;
    if (tracking != null && isDimension(String(tracking)))
      props.push(['letterSpacing', String(tracking)]);
    if (props.length) typography.push([role, props]);
  }

  // ── rounded ────────────────────────────────────────────────────────────────
  // DEFAULT + the named radii + one entry per pattern GROUP, because a component
  // references its group's radius (`{rounded.control}`), not a bare literal —
  // the group alias layer is the whole point of the cascade.
  //
  // A spec `Dimension` is a number plus px/em/rem, so a bare `0` is rejected
  // even though it is perfectly good CSS: normalise it to `0px`, which is the
  // same value in every context a radius is used. A radius that is genuinely not
  // a Dimension (`50%`, for a circle) cannot be normalised and is dropped from
  // the map rather than emitted as an error — `unroundable` carries it into the
  // Shapes prose so it is stated, not lost.
  const unroundable: [string, string][] = [];
  const asDimension = (v: string): string | undefined => {
    const t = v.trim();
    if (isDimension(t)) return t;
    return /^-?0+(?:\.0+)?$/.test(t) ? '0px' : undefined;
  };
  const rounded: [string, string][] = [];
  const pushRadius = (name: string, value: string) => {
    const dim = asDimension(value);
    if (dim) rounded.push([name, dim]);
    else unroundable.push([name, value]);
  };
  if (pDefaults.br) pushRadius('DEFAULT', pDefaults.br);
  for (const [n, v] of Object.entries(pRadii)) pushRadius(n, v);
  const roundedNames = new Set(rounded.map(([k]) => k));
  /** `var(--br-default)` → `{rounded.DEFAULT}`, `var(--br-circle, 50%)` → `{rounded.circle}`. */
  const roundedRef = (value: string): string => {
    const v = varName(value);
    const bare = v?.startsWith('br-') ? v.slice('br-'.length) : undefined;
    if (bare === 'default') return '{rounded.DEFAULT}';
    return bare && roundedNames.has(bare) ? `{rounded.${bare}}` : value;
  };
  for (const [group, props] of Object.entries(pGroups)) {
    if (props.br == null) continue;
    const ref = roundedRef(props.br);
    if (ref !== props.br) rounded.push([group, ref]);
    else pushRadius(group, props.br);
  }
  const roundedAll = new Set(rounded.map(([k]) => k));

  // ── spacing ────────────────────────────────────────────────────────────────
  // Max rem again: the emitted `--space-*` tokens are fluid clamps.
  const spacing: [string, string][] = [];
  if (ds.spaceScale?.base) spacing.push(['base', ds.spaceScale.base]);
  for (const s of spaceSteps)
    if (!spacing.some(([k]) => k === s.name)) spacing.push([s.name, s.max]);

  // ── components ─────────────────────────────────────────────────────────────
  /** Walk a pattern's geometry cascade: overrides → group → defaults. */
  const cascade = (p: PatternItem, prop: string): string | undefined =>
    p.overrides?.[prop] ?? (p.group ? pGroups[p.group]?.[prop] : undefined) ?? pDefaults[prop];

  /** A colour-ish CSS value → a `{colors.x}` ref, a literal, or nothing. */
  const colorValue = (value: string | undefined): string | undefined => {
    if (value == null) return undefined;
    const v = varName(value);
    if (v != null) {
      if (colorNames.has(v)) return `{colors.${v}}`;
      const bare = v.startsWith('color-') ? v.slice('color-'.length) : undefined;
      if (bare && colorNames.has(bare)) return `{colors.${bare}}`;
      return undefined;
    }
    return isColorLiteral(value) ? value.trim() : undefined;
  };

  /**
   * Resolve a `base` declaration that goes through the group alias layer
   * (`var(--br-card-group)` → the card's `br` cascade), and turn the result into
   * a `{rounded.*}` ref where one exists.
   */
  const geometry = (
    p: PatternItem,
    pname: string,
    baseProp: string,
    token: string,
  ): string | undefined => {
    const declared = p.base?.[baseProp];
    if (declared == null) return undefined;
    const v = varName(declared);
    if (v !== `${token}-${pname}-group`) return declared;
    const resolved = cascade(p, token);
    if (resolved == null) return undefined;
    if (token !== 'br') return resolved;
    const ref = roundedRef(resolved);
    if (ref !== resolved) return ref;
    // A bare literal here came from the group's own `br` — and the group IS a
    // `rounded` entry — UNLESS the pattern overrode it, in which case the value
    // is this pattern's alone and pointing at the group would be a lie.
    return p.overrides?.br == null && p.group && roundedAll.has(p.group)
      ? `{rounded.${p.group}}`
      : resolved;
  };

  const components: [string, [string, string][]][] = [];
  const roleVariants: string[] = [];
  for (const [pname, p] of Object.entries(pItems)) {
    if (!p.base) continue;
    const base = p.base;
    // Mirrors generate.ts's fill inference exactly — a component whose fill is
    // guessed differently here would describe colours the CSS never sets.
    const fills =
      p.fill ??
      (pname === 'button' ||
        pname === 'badge' ||
        base['background-color'] != null ||
        base['background'] != null);
    const props: [string, string][] = [];
    if (fills) {
      const bg =
        colorValue(base['background-color']) ??
        colorValue(base['background']) ??
        (p.default_role ? colorValue(`var(--color-bg-${p.default_role}-solid)`) : undefined);
      if (bg) props.push(['backgroundColor', bg]);
    }
    const fg =
      colorValue(base['color']) ??
      (fills && p.default_role ? colorValue(`var(--color-text-on-${p.default_role})`) : undefined);
    if (fg) props.push(['textColor', fg]);
    // A radius that didn't survive into `rounded` (a `50%` circle) would emit
    // either a broken reference or a non-Dimension literal here, so the property
    // is dropped instead; the Shapes prose names those patterns.
    const br = geometry(p, pname, 'border-radius', 'br');
    const brRef = /^\{rounded\.([^}]+)\}$/.exec(br ?? '');
    if (brRef && roundedAll.has(brRef[1] as string)) props.push(['rounded', br as string]);
    else if (br && asDimension(br)) props.push(['rounded', asDimension(br) as string]);
    else if (br) {
      // The Shapes prose wants the value, not the plumbing: `var(--br-circle,
      // 50%)` is how the cascade spells it, `50%` is what the reader needs.
      const named = varName(br);
      const bare = named?.startsWith('br-') ? named.slice('br-'.length) : undefined;
      unroundable.push([pname, (bare ? pRadii[bare] : undefined) ?? br]);
    }
    const pad = geometry(p, pname, 'padding', 'p');
    if (pad) props.push(['padding', pad]);
    if (props.length) components.push([pname, props]);

    // A hover that carries `step` intensifies the pattern's own colour; that is
    // a real variant an agent must reproduce, so it gets its own entry (the
    // spec's `-hover` sibling-key convention).
    const hover = p.states?.hover;
    const dr = p.default_role;
    if (hover && typeof hover.step === 'number' && dr) {
      const strong = hover.step >= 1;
      const hv = fills
        ? colorValue(`var(--color-bg-${dr}-${strong ? 'solid-bold' : 'solid'})`)
        : colorValue(`var(--color-text-${dr}${strong ? '-bold' : ''})`);
      if (hv) components.push([`${pname}-hover`, [[fills ? 'backgroundColor' : 'textColor', hv]]]);
    }
    if (p.roles?.length)
      roleVariants.push(
        `\`${pname}\` → ${p.roles.map((r) => `\`.${p.class ?? pname}-${r}\``).join(', ')}`,
      );
  }

  // ── front matter ───────────────────────────────────────────────────────────
  const fm: string[] = ['---', 'version: alpha', `name: ${q(name)}`];
  if (meta.description) fm.push(`description: ${q(meta.description)}`);
  fm.push('colors:');
  fm.push('  # Raw hue ramps — 11 OKLCH steps each, tinted near-white → tinted near-black.');
  for (const [k, v] of ramps) fm.push(`  ${key(k)}: ${scalar(v)}`);
  fm.push('  # Functional role tokens (LIGHT values). These are the public API: use these,');
  fm.push('  # not the raw steps, and dark mode resolves itself. See "## Colors" below.');
  for (const [k, v] of roleTokens) fm.push(`  ${key(k)}: ${scalar(v)}`);
  if (interop.length) {
    fm.push("  # Aliases for the spec's recommended names — references, not new values.");
    for (const [k, v] of interop) fm.push(`  ${key(k)}: ${scalar(v)}`);
  }
  if (typography.length) {
    fm.push('typography:');
    for (const [role, props] of typography) {
      fm.push(`  ${key(role)}:`);
      for (const [k, v] of props) fm.push(`    ${k}: ${scalar(v)}`);
    }
  }
  fm.push(yamlMap('rounded', rounded).trimEnd());
  fm.push(yamlMap('spacing', spacing).trimEnd());
  if (components.length) {
    fm.push('components:');
    for (const [cname, props] of components) {
      fm.push(`  ${key(cname)}:`);
      for (const [k, v] of props) fm.push(`    ${k}: ${scalar(v)}`);
    }
  }
  fm.push('---');

  return `${fm.filter(Boolean).join('\n')}\n\n# ${name}\n\n${prose({
    ctx,
    name,
    meta,
    roleMap,
    ramps,
    rounded,
    unroundable,
    roleVariants,
    typography: typography.map(([r]) => r),
  })}`;
}

// ── prose body ────────────────────────────────────────────────────────────────
/**
 * Section order is normative (Overview → Colors → Typography → Layout →
 * Elevation → Shapes → Components → Do's and Don'ts); a consumer that parses
 * sections positionally breaks if they are reordered.
 *
 * Every section interpolates live config, so this cannot drift into describing a
 * system the generator no longer emits — the same discipline `docs.ts` follows.
 */
function prose(a: {
  ctx: DesignMdCtx;
  name: string;
  meta: { name?: string | undefined; description?: string | undefined };
  roleMap: Record<string, RoleSpec>;
  ramps: [string, string][];
  rounded: [string, string][];
  unroundable: [string, string][];
  roleVariants: string[];
  typography: string[];
}): string {
  const { ctx, name, meta, roleMap, rounded, unroundable, roleVariants } = a;
  const { ds, expandedPalette, scaleRoles, typeSteps, spaceSteps, shadows } = ctx;
  const hues = Object.keys(expandedPalette);
  const roles = Object.keys(roleMap);
  const shadowNames = Object.keys(shadows ?? {});
  const typeNames = typeSteps.map((s) => s.name);
  const spaceNames = spaceSteps.map((s) => s.name);
  const bodyRole = ds.typography?.headings?.body ?? 'body';
  const s = (list: string[]) => list.map((x) => `\`${x}\``).join(', ');

  const overview =
    meta.description ??
    `${name} is a variable-driven design system: an OKLCH colour engine, fluid ` +
      `modular type and space scales, and a small set of component patterns, all ` +
      `expressed as CSS custom properties with utility classes over them.`;

  return `## Overview

${overview}

Every value in this document is generated from a single \`design-system.json\` and
emitted as CSS custom properties plus utility classes. **Prefer the class vocabulary
over hand-written CSS** — \`vitops docs classes\` prints the full list, and \`vitops lint\`
reports classes that resolve to nothing.

The token names below are the contract. Reach for a raw ramp step only when no
functional role expresses what you mean.

> Most tokens here are consumed by **utility classes**, not by the \`components\` block —
> \`bg-<role>\`, \`text-<role>-muted\` and friends are the API. \`design.md lint\` reports
> those as \`orphaned-tokens\`; that rule assumes a component-only system and does not
> apply. Everything else it reports is worth reading.

## Colors

${hues.length} hue${hues.length === 1 ? '' : 's'} (${s(hues)}), each generated as an 11-step
OKLCH scale from a seed — step \`50\` is a tinted near-white, \`950\` a tinted near-black,
with chroma damped toward both ends so the extremes read as neutral rather than washed.

${roles.length} semantic **roles** map onto those hues:

${roles.map((r) => `- \`${r}\` → \`${roleHue(roleMap[r] as RoleSpec)}\``).join('\n')}

A role is **not** an alias for a ramp. It resolves to tokens named
\`<target>-<role>[-<variant>]\`, where target is one of \`bg\` \`text\` \`icon\` \`border\`. The
target is part of the name on purpose: \`bg-danger-muted\` and \`text-danger-muted\` are
different tokens, so there is no ambiguity about which one a name refers to. **The token
name is also the utility class name** — write \`class="bg-danger-muted"\` and you are using
\`--color-bg-danger-muted\`.

Variants are ordinal: \`xx-muted\` < \`x-muted\` < \`muted\` < (bare) < \`bold\` < \`x-bold\`.
\`bold\` means *more emphatic in the current appearance*, not darker.

Roles come in two kinds, and the kind decides which tokens exist:

- **surface** (page and panel colours) — \`bg-<role>\` is the card/panel, \`bg-<role>-muted\`
  the page behind it, \`bg-<role>-x-muted\` a well. Full text scale, \`border-<role>-bold\`
  as the contrast-guaranteed boundary.
- **chromatic** (signal colours) — backgrounds are either *tints*
  (\`bg-<role>-x-muted\` / \`-muted\`) or *solids*
  (\`bg-<role>-solid\` / \`-solid-bold\` / \`-solid-x-bold\`). **There is no bare \`bg-<role>\`**:
  say how loud you mean. \`text-on-<role>\` is the guaranteed-contrast foreground for the
  solid family.

**Dark mode is automatic, and this file only lists the light values.** The spec has no
way to express a second appearance, so do not try to reconstruct one: the framework
re-points each token at a different ramp step under \`${DARK_SEL}\`, so \`bg-<role>\`
becomes dark and \`text-<role>\` becomes light on their own. The solid family and
\`text-on-<role>\` stay mode-stable by design, so a filled button keeps its identity.
**An agent that styles with the role tokens gets dark mode for free; one that flattens
them to hexes breaks it.**

Contrast is enforced at build time, not by convention — a violation fails the build.
Text is held to APCA Lc 75 on a role's primary background and Lc 60 on its secondary
planes; icons and the surface boundary to Lc 45; and chromatic text is checked against
the *surface* planes it actually sits on, not just its own tints. Pairing
\`text-<role>\` with \`bg-<role>\`, or \`text-on-<role>\` with \`bg-<role>-solid\`, is always
safe. Pairing a raw ramp step with another raw ramp step is not.

## Typography

Font stacks are named, and roles consume the name rather than the stack — so swapping a
typeface is one edit:

${Object.entries((ds.fonts ?? {}) as Record<string, string>)
  .map(([n, stack]) => `- **${n}** — \`${stack}\``)
  .join('\n')}

Type is a fluid modular scale: ${typeNames.length} steps (${s(typeNames)}) built from a
${ds.typeScale?.base ?? '1rem'} base at a ${ds.typeScale?.ratio ?? 1.2} ratio${
    ds.typeScale?.fluid
      ? `, interpolating between a ${ds.typeScale.fluid.minRatio} ratio at ${ds.typeScale.fluid.minVw} viewport width and the full ratio at ${ds.typeScale.fluid.maxVw}`
      : ''
  }. **The \`fontSize\` values in the front matter are the maximum (desktop) sizes** — the
real tokens are \`clamp()\` expressions, which the spec's \`Dimension\` type cannot hold.
Never hard-code the emitted number; use the scale (\`--text-<step>\`) or the role class.

Each typography role is a class (\`.font-<role>\`): ${s(a.typography.map((t) => `font-${t}`))}.
Roles also carry properties this format has no slot for — \`text-transform\`,
\`text-wrap\`, and a \`color\` — so **apply the role class rather than copying its
front-matter properties**, or uppercase eyebrows and balanced headings silently
disappear. Base page text is bound to the \`${bodyRole}\` role, so prose inherits it.

## Layout & Spacing

Spacing is its own fluid modular scale: ${spaceNames.length} steps (${s(spaceNames)}) from a
${ds.spaceScale?.base ?? '1rem'} base at a ${ds.spaceScale?.ratio ?? 1.25} ratio. As with type,
the front-matter values are the maxima and the live tokens are fluid.

Layout is composed from utilities rather than bespoke CSS:

- \`.centered\` — track-based centering: content sits in a centred measure while
  full-bleed children can still break out. Use it instead of \`margin-inline: auto\`.
- \`.rhythm\` — vertical rhythm between flow children, so sibling spacing is one
  decision rather than per-element margins.
- \`.flex\` / \`.split-<a>-<b>\` / \`.grid\` — the structural families, with container-query
  variants prefixed \`sm-\` / \`md-\` / \`lg-\` / \`xl-\` (30 / 48 / 64 / 80rem).
  \`.split\` is a two-column pair. Stack it with \`.flex-col\` and let a
  breakpoint-prefixed ratio un-stack it (\`split flex-col md-split-1-2\`);
  \`.split-reverse\` swaps the two panels. Reversing puts visual order out of step
  with DOM order, so keep focusable content in only one panel.

Breakpoints are **container** queries, not viewport media queries: a component
responds to the space it is given, so the same markup works in a sidebar and a full-width
section.

## Elevation & Depth

${
  shadowNames.length
    ? `Depth comes from ${shadowNames.length} named shadow${shadowNames.length === 1 ? '' : 's'} (${s(shadowNames)}), applied as \`--shadow-<name>\` tokens or \`.drop-shadow-<name>\` utilities:

${shadowNames.map((n) => `- \`${n}\` — \`${(shadows ?? {})[n]}\``).join('\n')}

Each value is deliberately a **single layer with no spread and no \`inset\`**: the same
token feeds both \`box-shadow\` (pattern geometry) and \`filter: drop-shadow()\` (the
utilities), and \`drop-shadow()\` rejects all three, which would drop the whole filter.`
    : `This system is flat: no shadow tokens are defined. Convey hierarchy with the
surface planes (\`surface-bg\` / \`surface-bg-muted\` / \`surface-bg-bold\`) and borders.`
}

Surfaces stack tonally as well: \`surface-bg-bold\` is the *raised* plane in both
appearances, so a card on a page reads as lifted without any shadow at all.

## Shapes

Corner radii resolve through a cascade rather than being set per component:
\`--br-<pattern>\` (your override hook) → \`--br-<pattern>-group\` → the group's radius →
\`--br-default\`. Overriding one variable restyles every pattern in that tier.

${rounded.map(([k, v]) => `- \`${k}\` — \`${v}\``).join('\n')}

Change a group's radius to restyle a whole tier; change \`DEFAULT\` to restyle everything
that has not opted out.
${
  unroundable.length
    ? `
**Not in the front matter above**, because the spec's \`Dimension\` type only holds
px / em / rem — these are real radii in the system and have to be applied as CSS:

${unroundable.map(([k, v]) => `- \`${k}\` — \`${v}\``).join('\n')}`
    : ''
}

## Components

Patterns are classes, not components — apply them to whatever element is semantically
correct. Two tiers of button exist and the distinction is intent, not looks:

- **\`.cta\`** is *persuasion* — filled, bolder, more padding, lifts on hover. Usually on an
  \`<a>\`, because a call to action usually navigates.
- **\`.btn\`** is *affordance* — it only says "this is interactive". It is emitted at zero
  specificity for both \`<button>\` and \`.btn\`, so a bare \`<button>\` gets it with no class
  and **any** explicit class overrides it.

${
  roleVariants.length
    ? `Role variants are systematic rather than enumerated above. A filled pattern's variant sets
\`background-color: var(--<role>-solid)\` with \`color: var(--<role>-on-solid)\`; a text
pattern's sets \`color: var(--color-<role>-bold)\`:

${roleVariants.map((r) => `- ${r}`).join('\n')}`
    : ''
}

Interaction states are generated from a small grammar — \`step\` (intensify the colour),
\`scale\`, \`lift\`, \`shadow\`, \`ring\` — so hover, active and focus-visible stay consistent
across every pattern. Focus rings are never removed, only restyled.

## Do's and Don'ts

- **Do** use functional role tokens (\`ui-primary-solid\`, \`surface-bg\`) over raw ramp steps.
- **Do** pair \`<role>-text\` with \`<role>-bg\`, and \`<role>-on-solid\` with \`<role>-solid\` —
  those pairings are contrast-tested; arbitrary ones are not.
- **Do** apply the \`.font-<role>\` classes rather than copying their font properties.
- **Do** reach for a utility class before writing CSS; run \`vitops lint\` to catch classes
  that resolve to nothing.
- **Don't** hard-code the \`fontSize\` / \`spacing\` numbers from the front matter — they are
  the maxima of fluid \`clamp()\` scales.
- **Don't** flatten role tokens to hex values: that is exactly what breaks dark mode.
- **Don't** invent a colour outside the ${hues.length} ramps${
    scaleRoles.length ? ` or the ${scaleRoles.length} roles` : ''
  }; add a hue to the config instead.
- **Don't** edit this file by hand — it is generated from \`design-system.json\`. Change the
  config and re-run \`vitops generate --format design\`.
`;
}
