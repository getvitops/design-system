/**
 * Pure, parameterized port of the Vitops design-system generator.
 *
 * `generate({ input, format, outDir })` reads a consumer's `design-system.json`,
 * validates it, and emits consumer-ready output for the chosen format into
 * `outDir`. Unlike the original CWD-bound script it mutates no shared state: every
 * generated token layer is built in memory and either bundled (css/bricks) or
 * inlined (tailwind) before writing.
 *
 * Framework-static assets (the hand-written CSS partials, the Bricks PHP + loader,
 * and the pre-built JS bundles) live under `assets/` in this package and are read /
 * copied from there — they are the same for every consumer.
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { transform } from 'lightningcss';
import { pickOn } from '@getvitops/utils/color';
import { validate, type DesignSystem } from './schema.ts';
import { generateDocs } from './docs.ts';
import { emitDesignMd } from './design-md.ts';
import { generateLegal } from './legal/index.ts';
import { buildIconSprite } from './icons-sprite.ts';
import { resolveInput, resolveConfig, type Config } from './config.ts';
import { generateIconInclude, resolveIcon } from '@getvitops/utils';
import { checkHighContrast, contrastMoreCss, highContrastRole } from './contrast-more.ts';

import {
  build as buildCore,
  type Built,
  type BuildOptions,
  type Format,
  type StylesheetFormat,
  type TwCtx,
  type TypographyRole,
  blockSet,
  decls,
  STATE_DEFAULT,
  BREAKPOINTS,
  gapUtilities,
  hueOnTokens,
  hueSchemeTokens,
  roleSchemeTokens,
  roleColorUtilities,
  toneTintRule,
  CSS_LAYERS,
  layerForPartial,
  wcagRatioMode,
} from './build.ts';
import { DARK_SEL, SYSTEM_DARK_SEL, TW_CLASH, layoutDecls } from './shared.ts';
import { tokenVar } from './tokens.ts';

export {
  toneTintRule,
  hueOnTokens,
  hueSchemeTokens,
  roleSchemeTokens,
  roleColorUtilities,
  BREAKPOINTS,
  CSS_LAYERS,
  CHUNK_LAYER,
  layerForPartial,
  wcagRatioMode,
  type ColorUtility,
  type BuildOptions,
  type Format,
  type StylesheetFormat,
} from './build.ts';

/** The Bricks palette/variable ids: a short sha-256 of the key, stable across releases. */
const nodeHash = (key: string) => createHash('sha256').update(key).digest('hex').slice(0, 6);

/**
 * Exported for tests only (see `BuildOptions`). Binds the two Node-only pieces the pure
 * `build()` in `build.ts` takes by injection.
 */
export function build(
  ds: DesignSystem,
  format: Format,
  assetsDir: string,
  buildOpts: BuildOptions = {},
): Built {
  return buildCore(ds, format, assetsDir, { hash: nodeHash, emitTailwind, ...buildOpts });
}

export interface GenerateOptions {
  /**
   * The config to build from — a path, or an already-parsed object.
   *
   * **Either kind is accepted.** A bare `design-system.json`, or the larger
   * `Config` that embeds one (commonly `company.json` / `vitops.json`), in
   * which case the design system is `designSystem.themes[theme]` with its
   * `extends` chain resolved. The two are told apart by shape, not by filename —
   * see `isConfig`.
   *
   * Passing a site config here also supplies `site`, so the site-level facts
   * generation depends on (`designSystem.defaultColorScheme`, the legal
   * documents, the icon sprite) don't need the same path declared twice. Each of
   * those is still gated on a field in that config, so nothing new appears
   * unless the config asks for it.
   */
  input: string | DesignSystem | Config;
  /** Output target. Default: 'tailwind'. */
  format?: Format;
  /** Directory to write outputs into. Default: 'dist'. */
  outDir?: string;
  /** Override the framework asset root (advanced/testing). */
  assetsDir?: string;
  /**
   * Which `designSystem.themes` entry to build. Default: the config's
   * `defaultTheme`, else `default`. An error on a bare `design-system.json`,
   * which holds one design system and no themes map.
   */
  theme?: string;
  /**
   * Environment whose A/B variant applies to the site config, wherever it came
   * from (`input` or `site`). Default: `'production'`.
   */
  siteEnv?: string;
  /**
   * The site config, when it is a *different* file from `input` — enabling
   * legal-document output into `<outDir>/legal/*.html` and supplying
   * `designSystem.defaultColorScheme`.
   *
   * Redundant when `input` is already a site config; set both and this one wins.
   */
  site?: string | Config;
  /**
   * Emit the `prefers-color-scheme: dark` block (see `BuildOptions`).
   *
   * Normally this comes from the site config's `designSystem.defaultColorScheme: "system"`, which
   * is where the fact belongs. This is the escape hatch for consumers with a
   * `design-system.json` and no site config at all: requiring a whole
   * `Config` — which must carry a full `designSystem` — to set one boolean
   * would be out of proportion. Set explicitly, it wins over the site config.
   */
  systemColorScheme?: boolean;
  /**
   * `tailwind` format only: directories (or globs) Tailwind should scan for class names, written
   * as `@source` lines after `@import "tailwindcss"`. Paths are relative to the emitted
   * `tailwind.css`. Tailwind v4 does not scan `node_modules`, so a utility used only by a package's
   * own renderer (`font-display` in `vitops_stats`) is otherwise never generated — silently.
   * Ignored by the css and bricks formats, which ship every framework class.
   */
  sources?: string[];
}

export interface GenerateResult {
  format: Format;
  outDir: string;
  written: string[];
}

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ASSETS = join(HERE, '..', 'assets');

function emitTailwind(ctx: TwCtx): string {
  const {
    ds,
    expandedPalette,
    scaleRoles,
    shadows,
    typeSteps,
    spaceSteps,
    typography,
    roleDecls,
    twTypeTokensCss,
    twPatternTokensCss,
    patternsCss,
    assetsDir,
    utilities,
  } = ctx;
  const cssDir = join(assetsDir, 'css');
  const nl = (arr: string[]) => arr.filter(Boolean).join('\n');
  const parts: string[] = [
    `/* GENERATED for Tailwind v4 (Astro) — do not edit by hand.\n` +
      `   Class reference: npx vitops docs classes  ·  All topics: npx vitops docs\n` +
      `   Fonts below are STACKS ONLY — this file loads no webfonts. Load them with\n` +
      `   Astro's fonts: config and point the token at the family's cssVariable. */`,
  ];
  parts.push(`@import "tailwindcss";`);
  // Tailwind v4 skips node_modules; the integration names the packages whose renderers use classes.
  for (const src of ctx.sources) parts.push(`@source ${JSON.stringify(src)};`);
  parts.push('');

  const theme: string[] = [];
  theme.push(`  /* Hue scales → bg-<hue>-<step> text-* border-* (numeric, 50…950) */`);
  for (const [name, hue] of Object.entries(expandedPalette))
    for (const [n, hex] of Object.entries(hue.numeric))
      theme.push(`  --color-${name}-${n}: ${hex};`);
  theme.push(`\n  /* Fonts → font-* (stacks only; no @font-face is emitted — see header) */`);
  for (const [name, stack] of Object.entries(ds.fonts ?? {}))
    theme.push(`  --font-${name}: ${stack};`);
  theme.push(`\n  /* Fluid type scale → text-* */`);
  for (const s of typeSteps) theme.push(`  --text-${s.name}: ${s.value};`);
  // Fluid space steps are NOT put in Tailwind's --spacing-* namespace: named
  // spacing keys shadow the size scales (e.g. `max-w-7xl` would resolve to
  // var(--spacing-7xl) ≈ 6rem and collapse layouts). They ship as --space-*
  // (matching the css format) in a plain :root below; use var(--space-<name>)
  // or the TW4 arbitrary form p-(--space-md). Numeric spacing (p-4 …) keeps
  // Tailwind's default --spacing multiplier.
  theme.push(`\n  /* Drop-shadows → shadow-* */`);
  for (const [name, value] of Object.entries(shadows ?? {}))
    theme.push(`  --shadow-${name}: ${value};`);
  theme.push(`\n  /* Container breakpoints → @sm:/@md:/@lg:/@xl: */`);
  for (const [name, val] of BREAKPOINTS) theme.push(`  --container-${name}: ${val};`);
  parts.push(`@theme {\n${theme.join('\n')}\n}\n`);
  // Split shadows (`{ box, drop }`): the drop-shadow() form is a plain token, not
  // an @theme one — `--shadow-*` there would mint a `shadow-<name>-drop` utility.
  const dropTokens = Object.entries(ds.shadows ?? {}).flatMap(([n, v]) =>
    typeof v !== 'string' && v.drop != null ? [`  --shadow-${n}-drop: ${v.drop};`] : [],
  );
  if (dropTokens.length)
    parts.push(
      `/* drop-shadow() forms of split shadows */\n:root {\n${dropTokens.join('\n')}\n}\n`,
    );

  {
    const layoutVars = layoutDecls(ds.layout);
    if (Object.keys(layoutVars).length)
      parts.push(`/* Layout tokens (from \`layout\`) */\n:root {\n${decls(layoutVars)}\n}\n`);
  }

  if (spaceSteps.length)
    parts.push(
      `/* Fluid space scale — var(--space-<name>) or p-(--space-<name>) */\n:root {\n` +
        spaceSteps.map((s) => `  --space-${s.name}: ${s.value};`).join('\n') +
        `\n}\n`,
    );

  // Role tokens go in a plain :root block, NOT @theme — including the emphasis
  // stops, despite those living in the --color-* namespace. The @utility set
  // below is the public API.
  //
  // This is load-bearing, not stylistic. Measured against tailwindcss@4.3.3:
  // when a token is in @theme AND an @utility of the derived name exists,
  // Tailwind merges both into one rule with the @theme declaration LAST, and it
  // does so regardless of source order. Putting `--color-<role>-<stop>` in
  // @theme would therefore silently substitute the stop for the plane on the
  // five colliding classes — including `text-<role>-muted` (step 800 → 300) and
  // `text-<role>-x-muted` (600 → 100), i.e. exactly the tokens tokens.ts's contrast
  // test guarantees are readable. Raw hue scales are safe in @theme because no
  // @utility competes for those names.
  if (scaleRoles.length) {
    let fn = '';
    for (const fr of scaleRoles)
      for (const [t, val] of Object.entries(fr.light)) fn += `  ${tokenVar(fr.role, t)}: ${val};\n`;
    const focus = scaleRoles.find((r) => r.role === 'ui-primary') ?? scaleRoles[0];
    if (focus) fn += `  --color-border-focus: ${focus.light['bg-solid']};\n`;
    // Same precondition as the css path: only a surface-kind role has the bare
    // `bg` token these two declarations read.
    const surface = scaleRoles.find((r) => r.role === 'surface' && 'bg' in r.light);
    if (surface) {
      fn += `  --surface-glass: color-mix(in oklch, var(--color-bg-surface) 72%, transparent);\n`;
      fn += `  --overlay: color-mix(in oklch, var(--color-${surface.hue}-950) 45%, transparent);\n`;
    }
    for (const line of hueOnTokens(expandedPalette)) fn += `  ${line}\n`;
    for (const line of [...hueSchemeTokens(expandedPalette), ...roleSchemeTokens(scaleRoles)])
      fn += `  ${line}\n`;
    if (ctx.darkOnly) fn = `  color-scheme: dark;\n${fn}`;
    parts.push(`/* Role tokens (the public API) */\n:root {\n${fn}}\n`);
    if (ds.colors.tint) parts.push(toneTintRule(ds.colors.tint));
  }

  parts.push(
    `/* ── Framework tokens (consumed by the inlined components) ── */\n` +
      `${twTypeTokensCss}\n${twPatternTokensCss}`,
  );

  // Dark appearance: the automatic functional flip (solid stays mode-stable).
  let darkBlock = '';
  for (const fr of scaleRoles)
    for (const [t, val] of Object.entries(fr.dark))
      if (fr.light[t] !== val) darkBlock += `  ${tokenVar(fr.role, t)}: ${val};\n`;
  {
    const surface = scaleRoles.find((r) => r.role === 'surface');
    if (surface && !ctx.darkOnly)
      darkBlock += `  --overlay: color-mix(in oklch, var(--color-${surface.hue}-950) 60%, transparent);\n`;
  }
  if (darkBlock) {
    parts.push(
      `/* Functional role tokens (dark) */\n${DARK_SEL} {\n  color-scheme: dark;\n${darkBlock}}\n`,
    );
    // Same opt-in OS-preference block as the css/bricks path — see the comment
    // there. Emitted unlayered here for the same reason the rest of this format
    // is: Tailwind owns the layering, and role tokens must stay out of `@theme`.
    if (ctx.systemColorScheme)
      parts.push(
        `/* Functional role tokens (dark) — OS preference, no explicit choice */\n` +
          `@media (prefers-color-scheme: dark) {\n  ${SYSTEM_DARK_SEL} {\n` +
          `    color-scheme: dark;\n${darkBlock.replace(/^ {2}/gm, '    ')}  }\n}\n`,
      );
  }

  if (ctx.contrastMoreCss) parts.push(ctx.contrastMoreCss);

  parts.push(
    `/* State variant for the active flip (hover/focus-visible are built in). */\n` +
      `@custom-variant is-active (&.is-active, &[data-active]);\n`,
  );

  // `typography.headings` — the bare-element → role bindings, the same rules the
  // css/bricks path emits into typography-headings.css. This format used to
  // emit only the `@utility font-<role>` half, so a Tailwind consumer's <h1>
  // and <body> got no role styling at all: no family, no size, no text-wrap.
  //
  // Tailwind's `base` layer, deliberately. It puts these behind BOTH `@utility
  // font-<role>` (utilities layer) and the patterns (components layer),
  // matching css/bricks, where `typography-headings.css` is its own chunk
  // mapped to `vitops.base` for exactly this reason — a DEFAULT for an
  // unstyled element must outrank nothing, not even beat a pattern on
  // specificity, since layers decide before specificity ever gets asked.
  // Emitted unlayered, an `h1` rule here would beat every Tailwind utility.
  {
    const roles = (typography?.roles ?? {}) as Record<string, TypographyRole>;
    const bindings = Object.entries(typography?.headings ?? {}).filter(([, r]) => roles[r]);
    if (bindings.length)
      parts.push(
        `/* Bare-element type roles (typography.headings) */\n@layer base {\n` +
          bindings
            .map(
              ([tag, role]) =>
                `  ${tag} {\n${decls(roleDecls(role, roles[role] as TypographyRole), '    ')}\n  }`,
            )
            .join('\n') +
          `\n}\n`,
      );
  }

  const util: string[] = [];
  if (scaleRoles.length) {
    util.push(`/* Role colour utilities (the public API) */`);
    // Same source as the css/bricks formats — the two used to diverge because
    // this path re-parsed the other's generated strings and only ever ran the
    // functional half. See roleColorUtilities().
    for (const { cls, prop, value } of roleColorUtilities(scaleRoles, utilities))
      util.push(`@utility ${cls} {\n  ${prop}: ${value};\n}`);
    if (scaleRoles.some((r) => r.role === 'surface' && 'bg' in r.light))
      util.push(
        `@utility glass {\n  background-color: var(--surface-glass);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n}`,
      );
  }
  util.push(`/* Typography roles */`);
  for (const [role, spec] of Object.entries(
    (typography?.roles ?? {}) as Record<string, TypographyRole>,
  ))
    util.push(`@utility font-${role} {\n${decls(roleDecls(role, spec))}\n}`);
  util.push(`\n/* Animation effects (pair with .transition or a driver) */`);
  const asStr = (v: string | number) => String(v);
  for (const [name, e] of Object.entries(ds.animations?.effects ?? {})) {
    const d: Record<string, string> = { '--_anim': e.kf };
    for (const [k, v] of Object.entries(e.css ?? {})) d[k] = asStr(v);
    for (const [k, v] of Object.entries(e.vars ?? {})) d[`--${k}`] = asStr(v);
    util.push(`@utility ${name} {\n${decls(d)}\n}`);
    // No `kf` filter — see the css path. `flip-size-grow` is as real as
    // `flip-fade-in`; both rest on `.transition`, which covers height behind
    // `@supports (interpolate-size: allow-keywords)`.
    const props = new Set<string>();
    for (const k of Object.keys(e.vars ?? {})) {
      const m = /^(.*)-(from|to)$/.exec(k);
      if (m) props.add(m[1] as string);
    }
    const flip = Object.fromEntries(
      [...props].map((p) => [`--t-${p}`, `var(--${p}-to, ${STATE_DEFAULT[p]})`]),
    );
    util.push(`@utility flip-${name} {\n${decls(flip)}\n}`);
  }
  util.push(`\n/* Split — internal fractions (pair split with a ratio) */`);
  // The `.split` PATTERN itself is not here — it is emitted into `@layer
  // components` with the rest of the structure, so `flex-col` beats it by layer
  // exactly as it does in css/bricks. Only its modifiers are utilities.
  //
  // That placement costs `@md:split`, and nothing recovers it. Measured against
  // tailwindcss@4.3.3: `@utility` throws "`@utility` cannot be nested" inside
  // `@layer`, AND inside a file pulled in with `@import … layer(…)` — the layer
  // clause is itself a nesting context. A `@custom-variant` doesn't help either:
  // a variant applied to a components-layer class emits nothing, because variants
  // attach to utility candidates only. `md-flex-row` says "become a row at md" in
  // every format, so the loss is a bare `<bp>-split` that had no unique job.
  //
  // `order`, not `row-reverse`, so the swap applies on whichever axis the split
  // is currently on — which is the point: it decides which panel comes FIRST,
  // and that is mostly a question about the stacked state. `reading-flow` keeps
  // focus order with the visual order where supported; until that is broad,
  // only one of the two panels should hold focusable content (WCAG 2.4.3).
  util.push(
    `@utility split-reverse {\n  reading-flow: flex-visual;\n  & > :first-child { order: 1; }\n}`,
  );
  const RATIOS: [number, number][] = [
    [1, 1],
    [1, 2],
    [2, 1],
    [1, 3],
    [3, 1],
    [1, 4],
    [4, 1],
    [2, 3],
    [3, 2],
  ];
  for (const [a, b] of RATIOS)
    util.push(
      `@utility split-${a}-${b} {\n  flex-direction: row;\n  --_split-a: ${a};\n  --_split-b: ${b};\n}`,
    );
  // Not derivable from `@theme`: the fluid space steps are deliberately kept out
  // of Tailwind's `--spacing-*` namespace (see the note above the `:root` block),
  // so `gap-md` has to be an explicit utility here. Verified against
  // tailwindcss@4.3.3 to win over the built-in functional `gap-*` and to accept
  // variants (`@md:gap-md`), which is why no per-breakpoint classes are emitted.
  const gaps = gapUtilities(spaceSteps);
  if (gaps.length) {
    util.push(`\n/* Gap — the fluid space scale (var(--space-<name>)) */`);
    for (const { cls, prop, value } of gaps)
      util.push(`@utility ${cls} {\n  ${prop}: ${value};\n}`);
  }
  util.push(`\n/* Track placement (inside .centered) */`);
  for (const track of ['measure', 'breakout', 'spotlight', 'fullbleed'])
    util.push(`@utility ${track} {\n  grid-column: ${track};\n}`);

  // `layout.css` is skipped wholesale in this format and a subset re-emitted
  // above, which left these two families missing from tailwind ENTIRELY — not
  // dropped via TW_CLASH, just never re-emitted. Unlike the `<bp>-` classes they
  // have no Tailwind equivalent to fall back on, and unlike a misspelt class
  // `vitops lint` cannot flag them, because they are not anchored to the
  // consumer's config. A consumer who used them got silence and no styling.
  util.push(`\n/* Auto-fit grid — column count is content-driven, unlike .split */`);
  util.push(
    `@utility grid-auto {\n  display: grid;\n  gap: var(--grid-gap, 1rem);\n` +
      `  grid-template-columns: repeat(auto-fit, minmax(var(--grid-min, 13rem), 1fr));\n` +
      // Was missing here while layout.css carried it, so in THIS format a
      // `<ul class="grid-auto">` inside `.rhythm` kept the `li + li` margin: the
      // grid stretched the row to the tallest and the first cell alone looked
      // vertically offset — the exact symptom layout.css warns about.
      `  &:is(ul, ol) > li + li { margin-block-start: 0; }\n}`,
  );
  // Public escape hatch (mirrors layout-utilities.css's `.no-rhythm`): a consumer's
  // own gap-based list can opt out of `.rhythm`'s ambient `li + li` margin the same
  // way `grid-auto` does above, without the framework needing to know its class name.
  util.push(`\n/* Opt out of ambient .rhythm item spacing (mirrors layout-utilities.css) */`);
  util.push(`@utility no-rhythm {\n  & > li + li { margin-top: 0; }\n}`);
  util.push(
    `\n/* Opt-in flex stack (mirrors layout-utilities.css) */\n@utility rhythm-flex {\n  display: flex;\n  flex-direction: column;\n  align-items: flex-start;\n  & > :is(${blockSet}) { align-self: stretch; }\n}`,
  );
  // Applied to the SECOND element of a pair, to override the rhythm it inherited.
  util.push(`\n/* Vertical-rhythm overrides (mirrors layout.css) */`);
  for (const pair of [
    'h-p',
    'p-p',
    'p-h',
    'h-h',
    'p-list',
    'list-p',
    'li-li',
    'text-media',
    'media-text',
  ])
    util.push(
      `@utility m-${pair} {\n  margin-top: calc(var(--rhythm-base) * var(--rhythm-${pair}));\n}`,
    );
  for (const [name, mult] of [
    ['0', null],
    ['xs', '0.25'],
    ['s', '0.5'],
    ['m', '1'],
    ['l', '1.5'],
    ['xl', '2'],
  ] as const)
    util.push(
      `@utility m-${name} {\n  margin-top: ${mult == null ? '0' : `calc(var(--rhythm-base) * ${mult})`};\n}`,
    );
  parts.push(util.join('\n') + '\n');

  // Structure mirrors layout.css (kept literal for parity with the original emitter).
  parts.push(`/* ── Structure (mirrors src/css/layout.css) ── */
:root {
  --rhythm-scale: 1;
  --rhythm-base: calc(1rlh * var(--rhythm-scale));
  --rhythm-h-p: 0.4;
  --rhythm-p-p: 0.9;
  --rhythm-p-h: 1.6;
  --rhythm-h-h: 0.6;
  --rhythm-p-list: 0.5;
  --rhythm-list-p: 0.9;
  --rhythm-li-li: 0.3;
  --rhythm-text-media: 1.2;
  --rhythm-media-text: 1.2;
  --rhythm-block: 2;
  --rhythm-block-action: 1.6;
  --width-measure: 65ch;
  --width-breakout: 90ch;
  --width-spotlight: 120ch;
  --gutter: clamp(1rem, 4cqi, 3rem);
}

body {
  container-type: inline-size;
  /* Named so \`patterns/scroll-target.css\`'s \`@container body (…)\` queries
     resolve — .toc-layout/.toc-sidebar/.toc-inline. Those partials are inlined
     into this bundle verbatim, so dropping the name (as this literal did) left
     the TOC permanently in its narrow layout in the tailwind format only. */
  container-name: body;
}

/* Class-level structure rules live in \`components\` so track/spacing utilities
   (@layer utilities — later in the layer order) can override them; unlayered
   CSS would beat ALL layered utilities regardless of specificity (e.g.
   \`.centered > *\` pinning children to \`measure\` over \`.spotlight\`). */
@layer components {
.rhythm {
  display: flow-root;
}
.rhythm > * + * {
  margin-top: calc(var(--rhythm-base) * var(--rhythm-p-p));
}
.rhythm > :where(h1, h2, h3, h4, h5, h6) + p {
  margin-top: calc(var(--rhythm-base) * var(--rhythm-h-p));
}
.rhythm > p + :where(h1, h2, h3, h4, h5, h6) {
  margin-top: calc(var(--rhythm-base) * var(--rhythm-p-h));
}
.rhythm > :where(h1, h2, h3, h4, h5, h6) + :where(h1, h2, h3, h4, h5, h6) {
  margin-top: calc(var(--rhythm-base) * var(--rhythm-h-h));
}
.rhythm > p + :where(ul, ol) {
  margin-top: calc(var(--rhythm-base) * var(--rhythm-p-list));
}
.rhythm > :where(ul, ol) + p {
  margin-top: calc(var(--rhythm-base) * var(--rhythm-list-p));
}
.rhythm :where(ul, ol) > li + li {
  margin-top: calc(var(--rhythm-base) * var(--rhythm-li-li));
}
.rhythm > :where(p, h1, h2, h3, h4, h5, h6, ul, ol) + :where(figure, img, picture, video) {
  margin-top: calc(var(--rhythm-base) * var(--rhythm-text-media));
}
.rhythm > :where(figure, img, picture, video) + :where(p, h1, h2, h3, h4, h5, h6, ul, ol) {
  margin-top: calc(var(--rhythm-base) * var(--rhythm-media-text));
}

/* Block-level children are a block gap apart, not a paragraph apart: a card row, a stats list, an
   accordion or a form under a lead sat flush at the prose spacing. \`:is()\` takes its most specific
   argument (0-1-1), so this beats the paragraph-to-list pairs above (0-1-2 would not tie it).
   Classless \`ul\`/\`ol\` stay prose. A form's own \`.rhythm\` holds \`div\` fields, which are not listed,
   so its tight field spacing is untouched. */
.rhythm > * + :is(wc-cards, ul[class], ol[class], details, form, table, figure, .accordion, .section__body) {
  margin-top: calc(var(--rhythm-base) * var(--rhythm-block));
}
/* A row of buttons after the lead. */
.rhythm > * + p.cluster {
  margin-top: calc(var(--rhythm-base) * var(--rhythm-block-action));
}
/* A bare link is inline, and an inline box ignores \`margin-top\`, so it sat flush under the
   paragraph above. Buttons (\`.cta\`, \`.btn\`) are inline-flex and already space.
   Not on a \`<p>\`: it holds only phrasing content, so its links are inline text and blockifying
   them breaks the sentence onto one line per link. */
.rhythm:not(p) > :where(a:not(.cta, .btn)) {
  display: block;
  inline-size: fit-content;
}

.centered {
  --_measure: min(var(--width-measure), 100% - var(--gutter) * 2);
  --_breakout: minmax(0, calc((var(--width-breakout) - var(--width-measure)) / 2));
  --_spotlight: minmax(0, calc((var(--width-spotlight) - var(--width-breakout)) / 2));
  position: relative;
  display: grid;
  grid-template-columns:
    [fullbleed-start] minmax(var(--gutter), 1fr)
    [spotlight-start] var(--_spotlight)
    [breakout-start] var(--_breakout)
    [measure-start] var(--_measure) [measure-end]
    var(--_breakout) [breakout-end]
    var(--_spotlight) [spotlight-end]
    minmax(var(--gutter), 1fr) [fullbleed-end];
}
.centered > * {
  grid-column: measure;
}

.region {
  padding-block: clamp(
    var(--region-space-min, 3rem),
    var(--region-space, 8vh),
    var(--region-space-max, 8rem)
  );
}

/* \`.split\` is a PATTERN, so it belongs here rather than in an \`@utility\` — that
   is what makes \`flex-col\` beat it by layer instead of by a source-order race
   whose winner depends on Tailwind's property-based sort of custom utilities.
   Its ratio/reversal modifiers stay utilities. Mirrors layout.css, where each
   rule's rationale is written out; in short: \`min-inline-size: 0\` because a flex
   item's automatic minimum is its min-content size; the ratio as a flex BASIS
   rather than a grow factor, because grow shares out only the free space and a
   child's padding is not part of it; scoped to a two-child split because a ratio
   is a pair contract and a middle child with no basis would collapse to zero;
   \`box-sizing: border-box\` because a basis only sizes the border box on a
   border-box item (Tailwind's preflight sets it, the other formats' reset does). */
.split {
  display: flex;
  flex-direction: row;
}
.split > * {
  flex: 1;
  box-sizing: border-box;
  min-inline-size: 0;
}
.split > :first-child {
  flex-grow: var(--_split-a, 1);
}
.split > :last-child {
  flex-grow: var(--_split-b, 1);
}
.split > :first-child:nth-last-child(2) {
  flex-basis: ${splitBasis('--_split-a')};
}
.split > :nth-child(2):last-child {
  flex-basis: ${splitBasis('--_split-b')};
}
/* Stacks the pair below md of the nearest container, in every format (mirrors layout.css). */
.split-responsive {
  @container (width < 48rem) {
    flex-direction: column;
    --_flex-direction: column;
    & > *,
    & > :first-child,
    & > :last-child,
    & > :first-child:nth-last-child(2),
    & > :nth-child(2):last-child {
      flex: 0 0 auto;
      inline-size: 100%;
    }
  }
}
}
`);

  // Same layering rationale as the structure block above. Guarded on existence
  // like componentPartialOrder below: `assets/**` is a gitignored build artifact
  // that `vp test` does not produce, so an unguarded read makes the tailwind
  // format untestable in a clean checkout — which is how an 87-class vocabulary
  // gap between css and tailwind went unnoticed. The token layer still emits.
  const animPath = join(cssDir, 'animation.css');
  const animEngine = existsSync(animPath) ? readFileSync(animPath, 'utf8') : '';
  if (animEngine)
    parts.push(
      `/* ── Animation engine (animation.css) ── */\n@layer components {\n${animEngine}\n}`,
    );
  // Patterns live in Tailwind's `components` layer so single-purpose utilities
  // (@layer utilities — declared later in the layer order) override them, e.g.
  // `.text-on-ui-primary` beating the link pattern's element-level `a { color }`.
  // Unlayered CSS would win over ALL layered utilities regardless of specificity.
  parts.push(`/* ── Component patterns ── */\n@layer components {\n${patternsCss}\n}`);

  // Component + structural partials: the full framework library, minus the
  // Tailwind-owned utility layer. Sourced live from the CSS partials (in index.css
  // cascade order) so this never goes stale, then run through stripForTailwind
  // (dropping the TW_CLASH names Tailwind provides itself).
  const droppedClashes = new Set<string>();
  let droppedVariantBlocks = 0;
  /**
   * Is this `@container (min-width: …)` block a PRE-EXPANDED VARIANT block —
   * i.e. only `.sm-*`/`.md-*`/`.lg-*`/`.xl-*` utility classes, which Tailwind
   * regenerates on demand as `@md:`?
   *
   * Anything else in a container query is component *behaviour*, not a variant,
   * and dropping it breaks the component. `sitenav.css` is the case that caught
   * this: its `@container (min-width: 48rem) { .sitenav--bp-md { … } }` is what
   * switches the nav to its desktop layout, and blanket-dropping every
   * container block meant the tailwind format shipped a nav stuck in mobile.
   */
  const isVariantBlock = (raw: string): boolean => {
    const open = raw.indexOf('{');
    const body = raw.slice(open + 1, raw.lastIndexOf('}'));
    const selectors: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (ch === '{') {
        if (depth === 0) selectors.push(body.slice(start, i));
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) start = i + 1;
      }
    }
    const names = selectors
      .flatMap((s) => s.split(','))
      .map((s) => s.replace(/\/\*[\s\S]*?\*\//g, '').trim())
      .filter(Boolean);
    return names.length > 0 && names.every((n) => /^\.(sm|md|lg|xl)-/.test(n));
  };
  const stripForTailwind = (css: string): string => {
    const kept: string[] = [];
    let depth = 0;
    let start = 0;
    let preludeEnd = -1;
    for (let i = 0; i < css.length; i++) {
      const ch = css[i];
      if (ch === '/' && css[i + 1] === '*') {
        const end = css.indexOf('*/', i + 2);
        i = end === -1 ? css.length : end + 1;
        continue;
      }
      if (ch === '"' || ch === "'") {
        i += 1;
        while (i < css.length && css[i] !== ch) i += css[i] === '\\' ? 2 : 1;
        continue;
      }
      if (ch === '{') {
        if (depth === 0) preludeEnd = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const raw = css.slice(start, i + 1).trim();
          const prelude = css
            .slice(start, preludeEnd)
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .trim();
          const clash = /^\.([A-Za-z0-9_-]+)/.exec(prelude);
          const name = clash?.[1] as string | undefined;
          if (/^@container\s*\(\s*min-width:/.test(prelude) && isVariantBlock(raw))
            droppedVariantBlocks++;
          else if (name && TW_CLASH.has(name) && !CLASH_KEEP.has(name)) droppedClashes.add(name);
          else if (raw) kept.push(raw);
          start = i + 1;
        }
      }
    }
    return kept.join('\n\n');
  };

  const partials = componentPartialOrder(cssDir);
  const componentCss = partials
    .map((rel) => {
      const css = readFileSync(join(cssDir, rel), 'utf8');
      return `/* ── ${rel} ── */\n${stripForTailwind(css)}`;
    })
    .join('\n\n');
  // Same layering rationale as the patterns block above. `componentPartialOrder`
  // already returns [] when assets are absent, so this is empty in that case.
  if (componentCss)
    parts.push(
      `/* ── Component + structural partials (Tailwind-clashing utilities dropped) ── */\n` +
        `/* Dropped ${droppedVariantBlocks} pre-expanded breakpoint block(s) — write @sm:/@md:/@lg:/@xl: instead.\n` +
        `   Dropped ${droppedClashes.size} clashing utilit(ies) Tailwind provides itself:\n` +
        `   ${[...droppedClashes].sort().join(' ') || '(none)'} */\n` +
        `@layer components {\n${componentCss}\n}`,
    );

  return nl(parts) + '\n';
}

/**
 * Partials the tailwind format does NOT inline, because it re-creates them by
 * hand: the engine (`global.css` — Tailwind's preflight covers the reset;
 * `animation.css` — read directly and wrapped in `@layer components`), and the
 * two layout partials, whose utilities are re-emitted as `@utility` and whose
 * structure is re-emitted in the `@layer components` literal.
 *
 * **Every partial mapped to `vitops.utilities` must be listed here.** Inlining a
 * utility family lands it in tailwind's `@layer components`, the exact inversion
 * the layer split exists to remove — and it fails SILENTLY, because each of those
 * classes already exists as an `@utility` that wins on layer anyway. You would get
 * ~30 dead rules and no test failure. `format-parity.test.ts` asserts the
 * implication structurally rather than spot-checking the output.
 *
 * The implication is one-way: `layout.css` is skipped while sitting in
 * `vitops.components`, because its structure is re-emitted by hand.
 */
/**
 * Framework COMPONENTS whose class name collides with a Tailwind utility, and
 * which must therefore survive the `TW_CLASH` strip.
 *
 * The clash test matches a rule's leading `.<name>`, which is right for a
 * single-purpose utility (Tailwind ships its own) and wrong for a pattern that
 * merely shares the name. `patterns/sticky.css` opens `.sticky { … }` and was
 * being deleted from the tailwind bundle WHOLESALE — the `--_sticky-offset`
 * wiring, the z-index, and every `&.sticky--bottom`/`--inline-start` variant —
 * so a consumer writing `class="sticky sticky--bottom"` got bare
 * `position: sticky` and nothing else.
 *
 * `table` is here for the same reason but was never actually hit: `table.css`'s
 * prelude is `table,\n.table`, which doesn't start with `.`, so the regex missed
 * it by luck. Listing it makes that explicit rather than accidental.
 */
const CLASH_KEEP: ReadonlySet<string> = new Set(['sticky', 'table']);

export const TAILWIND_SKIP: ReadonlySet<string> = new Set([
  'global.css',
  'animation.css',
  'layout.css',
  'layout-utilities.css',
  // Everything left here after the reveal family moved to patterns/reveal.css is
  // either a TW_CLASH name (display, sr-only, text-wrap) or a pre-expanded
  // variant block, so the strip already emptied it — reading it was pure waste,
  // and leaving it out made the invariant above look violated when it wasn't.
  'utilities.css',
]);

/**
 * The component/structural CSS partials to inline into the Tailwind bundle, in
 * index.css cascade order. Everything the aggregator imports EXCEPT `TAILWIND_SKIP`
 * and the generated token layer (Tailwind builds its own via @theme).
 */
function componentPartialOrder(cssDir: string): string[] {
  const indexPath = join(cssDir, 'index.css');
  const order: string[] = [];
  const seen = new Set<string>();
  const text = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';
  for (const m of text.matchAll(/@import\s+['"]\.\/([^'"]+)['"]/g)) {
    const rel = m[1] as string;
    if (rel.startsWith('generated/')) continue;
    if (TAILWIND_SKIP.has(rel)) continue;
    if (!seen.has(rel) && existsSync(join(cssDir, rel))) {
      seen.add(rel);
      order.push(rel);
    }
  }
  // Fallback: if no index.css, inline utilities + every pattern partial.
  if (!order.length) {
    if (existsSync(join(cssDir, 'utilities.css'))) order.push('utilities.css');
    const pdir = join(cssDir, 'patterns');
    if (existsSync(pdir))
      for (const f of readdirSync(pdir).sort()) if (f.endsWith('.css')) order.push(`patterns/${f}`);
  }
  return order;
}

// ── CSS bundling (css + bricks formats) ───────────────────────────────────────

/**
 * A `.split` child's flex basis. The ratio is a BASIS rather than a grow factor
 * because grow shares out only the FREE space, which a child's padding is not
 * part of — so a padded column came out wider than its sibling by exactly its
 * horizontal padding. Must stay character-identical to layout.css; the parity
 * suite matches this expression against both.
 */
export const splitBasis = (v: '--_split-a' | '--_split-b'): string =>
  `calc(var(${v}, 1) / (var(--_split-a, 1) + var(--_split-b, 1)) * 100%)`;

/**
 * Assemble the full stylesheet by resolving index.css's @import order against the
 * static partials (from assets) and the freshly generated token partials (in
 * memory), then minify with lightningcss. No @import survives, so no disk
 * resolution / shared `generated/` dir is needed.
 *
 * Each chunk is wrapped in a cascade layer. This is what lets a single-purpose
 * utility override a component pattern — `class="card bg-danger-muted"` — which
 * previously depended on source order and so silently did nothing here while
 * working in the tailwind format, where Tailwind's own layers already ordered
 * them correctly.
 *
 * Consequence worth knowing: unlayered CSS beats ALL layered CSS regardless of
 * specificity, so a consumer's own stylesheet now wins over the framework by
 * default. That is deliberate — it is the override story every layered
 * framework ships — but it means an unlayered *reset* will beat framework
 * component rules it used to lose to. Such a reset belongs in a layer declared
 * before `vitops.base` (see the `<style>` block in this repo's index.html).
 */
function bundleCss(
  generated: Record<string, string>,
  assetsDir: string,
  minify: boolean,
): { code: string; map: string | undefined } {
  const cssDir = join(assetsDir, 'css');
  const indexPath = join(cssDir, 'index.css');
  const index = readFileSync(indexPath, 'utf8');
  const chunks: string[] = [];
  for (const line of index.split('\n')) {
    const m = /@import\s+['"]\.\/([^'"]+)['"]/.exec(line);
    if (!m) continue;
    const rel = m[1] as string;
    const body = rel.startsWith('generated/')
      ? (generated[rel.slice('generated/'.length)] ?? '')
      : readFileSync(join(cssDir, rel), 'utf8');
    if (!body.trim()) continue;
    chunks.push(`@layer ${layerForPartial(rel)} {\n${body}\n}`);
  }
  // `/*!` rather than `/*`: lightningcss strips ordinary comments when
  // minifying, and both the css and bricks bundles are minified — so a plain
  // banner would never reach the file anyone actually opens. Whoever opens this
  // is looking for a class name; point them at the live reference.
  const banner =
    `/*! GENERATED by @getvitops/generator — do not edit by hand.\n` +
    `    Class reference: npx vitops docs classes  ·  All topics: npx vitops docs */\n`;
  // Declare the order up front so it is explicit rather than an artifact of
  // which chunk happened to appear first.
  const merged = banner + `@layer ${CSS_LAYERS.join(', ')};\n` + chunks.join('\n');
  const res = transform({
    filename: 'styles.css',
    code: Buffer.from(merged),
    minify,
    sourceMap: minify,
  });
  return {
    code: res.code.toString(),
    map: res.map ? res.map.toString() : undefined,
  };
}

// ── public generate() ─────────────────────────────────────────────────────────
/**
 * Read `input` as whichever config kind it is, and return the design system to
 * build from plus the site config if that is what it was.
 *
 * The design system is validated here rather than in `resolveInput` so the error
 * can name where it came from: a theme inside a site config reports its `themes`
 * path, which is the difference between "your config is wrong" and "your config
 * is wrong *here*" when the file is a few hundred lines of company facts.
 */
function loadInput(
  input: string | DesignSystem | Config,
  opts: { theme?: string; siteEnv?: string },
): { ds: DesignSystem; config?: Config } {
  const raw = typeof input === 'string' ? JSON.parse(readFileSync(input, 'utf8')) : input;
  const resolved = resolveInput(raw, opts);
  const result = validate(resolved.designSystem);
  if (!result.ok) {
    const where =
      resolved.theme != null
        ? `design system at designSystem.themes.${resolved.theme}`
        : 'design-system.json';
    const lines = result.errors
      .slice(0, 12)
      .map((e) => `  • ${e.path.join('.') || '(root)'}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid ${where}:\n${lines}`);
  }
  for (const w of result.warnings) console.warn(`[vitops] ${w}`);
  return { ds: result.data, ...(resolved.config ? { config: resolved.config } : {}) };
}

export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const format: Format = options.format ?? 'tailwind';
  const outDir = options.outDir ?? 'dist';
  const assetsDir = options.assetsDir ?? DEFAULT_ASSETS;
  const { ds, config: embedded } = loadInput(options.input, {
    ...(options.theme != null ? { theme: options.theme } : {}),
    ...(options.siteEnv != null ? { siteEnv: options.siteEnv } : {}),
  });
  // Loaded before `build` because `designSystem.defaultColorScheme` decides what
  // the colour layer emits. (It is read again below for legal documents;
  // resolving twice would validate twice and double any warning.)
  //
  // An explicit `site` wins over one embedded in `input` — it is the more
  // specific statement, and the two are the same file in every case but the one
  // where a consumer deliberately split them.
  const config = options.site != null ? loadConfigFile(options.site, options.siteEnv) : embedded;
  const built = build(ds, format, assetsDir, {
    systemColorScheme:
      options.systemColorScheme ?? config?.designSystem?.defaultColorScheme === 'system',
    darkOnly: config?.designSystem?.defaultColorScheme === 'dark',
    wcagRatio: wcagRatioMode(config?.site?.accessibility?.level),
    contrastToggle: config?.site?.accessibility?.contrastToggle === true,
    ...(options.sources?.length ? { sources: options.sources } : {}),
  });
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  const put = (rel: string, content: string) => {
    const p = join(outDir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
    written.push(p);
  };

  if (format === 'design') {
    // Deliberately the only output: DESIGN.md conventionally lives at the repo
    // root next to AGENTS.md, not in a build directory, so this format is meant
    // to be run with `--out .` — writing a stylesheet alongside it would be
    // surprising. Compose it when you want both: `--format css,design`.
    put('DESIGN.md', built.designMd);
  } else if (format === 'tailwind') {
    put('tailwind.css', built.tailwind);
    put('tokens.json', built.tokensJson);
    // The editor reads this whatever the stylesheet format: it describes the design
    // system, not the CSS. A tailwind site mounting <wc-theme-editor> has no other source.
    put('design-manifest.json', built.designManifest);
  } else if (format === 'css') {
    const { code } = bundleCss(built.generated, assetsDir, true);
    put('styles.css', code);
    put('tokens.json', built.tokensJson);
    put('design-manifest.json', built.designManifest);
  } else {
    // bricks: bundled minified CSS + Bricks import JSON + copied JS/PHP/docs.
    const { code, map } = bundleCss(built.generated, assetsDir, true);
    put('styles.min.css', map ? code + `\n/*# sourceMappingURL=styles.min.css.map */` : code);
    if (map) put('styles.min.css.map', map);
    put('bricks-colors-named.json', built.bricksColorsNamed);
    put('bricks-colors-semantic.json', built.bricksColorsSemantic);
    put('bricks-variables.json', built.bricksVariables);
    put('tokens.json', built.tokensJson);
    // Framework-static JS bundles → outDir root (theme enqueues them).
    const jsDir = join(assetsDir, 'js');
    if (existsSync(jsDir)) {
      cpSync(jsDir, outDir, { recursive: true });
      for (const f of readdirSync(jsDir)) written.push(join(outDir, f));
    }
    // Bricks PHP elements + loader → outDir/bricks.
    const bricksSrc = join(assetsDir, 'bricks');
    if (existsSync(bricksSrc)) {
      cpSync(bricksSrc, join(outDir, 'bricks'), { recursive: true });
      written.push(join(outDir, 'bricks'));
    }
    // OKF docs bundle (generated per-config) → outDir/docs.
    const docs = generateDocs(ds, assetsDir);
    for (const [rel, content] of Object.entries(docs)) put(join('docs', rel), content);
  }

  // Legal documents → outDir/legal, as HTML fragments.
  //
  // Opt-in via `site`, and emitted for every format that emits files at all —
  // passing a site config and silently getting nothing back would be the
  // surprising behaviour. `design` is excluded because it emits DESIGN.md and
  // deliberately nothing else.
  //
  // HTML rather than markdown because this is the fragment a WordPress theme,
  // a Bricks shortcode or a plain page can include with no build step of its own.
  if (config != null && format !== 'design') {
    const legal = generateLegal(config, { output: 'html' });
    for (const [name, content] of Object.entries(legal)) put(join('legal', name), content);

    // Icon sprite → outDir/icons.svg.
    //
    // Opt-in via `icons.sprite`, because building it needs the @iconify-json/*
    // collections and most consumers render icons through their framework's own
    // integration instead. This is the path for the ones that can't: Bricks,
    // EmDash renderers, any plain HTML — `<use href="…/icons.svg#id">`, no JS.
    const icons = config.site.icons as
      | { sprite?: boolean; ui?: string; brand?: string; weight?: string; semantic?: string[] }
      | undefined;
    if (icons?.sprite) {
      const { ui, brand, weight, semantic, sprite: _sprite, ...sets } = icons;
      const include = generateIconInclude({
        ...(ui ? { ui } : {}),
        ...(brand ? { brand } : {}),
        ...(weight ? { weight } : {}),
        ...(semantic ? { semantic } : {}),
        ...sets,
      });
      // Semantic names get a set-independent alias (`icon-menu`) alongside the
      // qualified id, so markup written against a sprite survives a set swap —
      // the same guarantee `resolveIcon` gives Astro consumers.
      const aliases: Record<string, string> = {};
      for (const name of semantic ?? []) {
        try {
          aliases[`icon-${name}`] = resolveIcon(name, ui ?? 'fa7-solid', weight ? { weight } : {});
        } catch {
          // Already reported by generateIconInclude, which throws on the same input.
        }
      }
      const built = await buildIconSprite({ include, aliases });
      put('icons.svg', built.svg);
      if (built.missing.length)
        console.warn(
          `[vitops] icons.sprite: ${built.missing.length} icon(s) were not found and are ` +
            `absent from the sprite: ${built.missing.join(', ')}.`,
        );
    }
  }

  return { format, outDir, written };
}

function loadConfigFile(input: string | Config, siteEnv?: string): Config {
  const raw = typeof input === 'string' ? JSON.parse(readFileSync(input, 'utf8')) : input;
  // resolveConfig validates and throws with one issue per line.
  return resolveConfig(raw, siteEnv);
}
