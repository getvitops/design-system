/**
 * The high-contrast layer: a third appearance axis beside light/dark.
 *
 * It is **not** a theme. `designSystem.themes` entries are whole design systems; this is the same
 * role tokens re-pointed to darker (or, in dark, lighter) ladder steps, exactly the way dark mode is
 * a re-pointing. So one layer serves every trigger:
 *
 *   - `@media (prefers-contrast: more)` — the user's OS/browser asked for it.
 *   - `:root[data-contrast="more"]` — set by `<wc-contrast-toggle>` (or any script).
 *   - `:root:has(.contrast-toggle input:checked)` — the no-JS checkbox, WCAG technique G174.
 *
 * `data-contrast="standard"` opts out of the media query, so a visitor whose OS asks for more
 * contrast can still turn it off on this site.
 *
 * What it does, and why it is computed rather than a fixed table: a step that reaches 7:1 depends on
 * the hue and on the plane under it, so each text/icon token walks from its baseline step toward the
 * contrasty end of the ladder until it clears the bar on every plane it sits on. Borders collapse onto
 * the icon token ("make borders more solid"), solids walk until their `text-on` clears 7:1, and the
 * glass surface becomes opaque ("remove transparency").
 *
 * Judged twice: at the **baseline** bars (4.5 / 3) a miss is a build failure, because a layer that is
 * not itself conforming is no use as a G174 alternative; at AAA (7 / 4.5) a miss is a warning, because
 * AAA goes beyond what any law asks.
 */
import { contrastRatio } from '@getvitops/utils/color';
import { DARK_SEL, SYSTEM_DARK_SEL } from './shared.ts';
import {
  CONTRAST,
  NUMERIC_STEPS,
  checkContrast,
  tokenVar,
  type ExpandedHue,
  type FunctionalRole,
} from './tokens.ts';

type NumStep = (typeof NUMERIC_STEPS)[number];

/** The AAA bars the layer aims for. Text 7:1; non-text has no AAA, so 4.5:1 (the text AA bar). */
export const CONTRAST_MORE = { TEXT: 7, NON_TEXT: 4.5 } as const;

export type MoreTokens = Record<string, string>;
export interface HighContrastRole {
  role: string;
  /** Full token → value overrides for each appearance (only tokens the layer changes). */
  light: MoreTokens;
  dark: MoreTokens;
}

const VAR_RE = /^var\(--color-([a-z0-9-]+)-(\d+)\)$/;

/** The step a `var(--color-<hue>-<step>)` value names, or undefined for a literal. */
const stepOf = (val: string | undefined): NumStep | undefined => {
  const m = val == null ? null : VAR_RE.exec(val);
  return m ? (m[2] as NumStep) : undefined;
};

/**
 * Compute one role's high-contrast overrides.
 *
 * `surfaceBg` is the page planes (hex) per appearance, which a chromatic role's text sits on;
 * a surface role's planes are its own, as in `checkContrast`.
 */
export function highContrastRole(
  fr: FunctionalRole,
  hue: ExpandedHue,
  surfaceBg?: { light: string[]; dark: string[] },
): HighContrastRole {
  const have = NUMERIC_STEPS.filter((s) => hue.numeric[s] != null);
  const hex = (s: NumStep) => hue.numeric[s] as string;
  const ref = (s: NumStep) => `var(--color-${fr.hue}-${s})`;
  const resolve = (val: string): string => {
    const m = VAR_RE.exec(val);
    return m ? ((m[1] === fr.hue ? hue.numeric[m[2] as NumStep] : undefined) ?? val) : val;
  };

  const compute = (appearance: 'light' | 'dark'): MoreTokens => {
    const tokens = appearance === 'light' ? fr.light : fr.dark;
    const out: MoreTokens = {};
    // Toward the contrasty end of the ladder: darker steps on a light page, lighter on a dark one.
    const dir = appearance === 'light' ? 1 : -1;

    const ownBg = Object.keys(tokens)
      .filter((k) => k === 'bg' || k.startsWith('bg-'))
      .filter((k) => !k.startsWith('bg-solid') && !k.startsWith('bg-bold'))
      .filter((k) => !k.startsWith('bg-x-bold'));
    const planes: string[] = [
      ...(fr.kind === 'surface' ? [] : (surfaceBg?.[appearance] ?? [])),
      ...ownBg.map((k) => resolve(tokens[k] as string)),
    ];

    /** Walk from the baseline step toward contrast until `min` holds on every plane. */
    const walk = (key: string, min: number) => {
      const from = stepOf(tokens[key]);
      if (from == null || planes.length === 0) return undefined;
      const ordered = have.filter((s) => (Number(s) - Number(from)) * dir >= 0);
      ordered.sort((a, b) => (Number(a) - Number(b)) * dir);
      const hit =
        ordered.find((s) => planes.every((bg) => contrastRatio(hex(s), bg) >= min)) ??
        ordered[ordered.length - 1];
      if (hit == null) return undefined;
      out[key] = ref(hit);
      return hit;
    };

    for (const key of ['text', 'text-bold', 'text-muted']) walk(key, CONTRAST_MORE.TEXT);
    const icon = walk('icon', CONTRAST_MORE.NON_TEXT);
    walk('icon-muted', CONTRAST_MORE.NON_TEXT);
    // Borders: a surface role's `border-bold` is the guaranteed boundary; every other border is
    // decorative in the baseline and becomes as solid as the icon in this layer.
    const bold = fr.kind === 'surface' ? walk('border-bold', CONTRAST_MORE.NON_TEXT) : icon;
    if (bold != null) {
      for (const key of ['border', 'border-muted', 'border-bold'])
        if (tokens[key] != null) out[key] = ref(bold);
    }

    // The solid family: walk the fill until its `text-on` clears AAA. `text-on` stays the same
    // literal, so polarity (light text on a dark fill, or the reverse) is unchanged.
    const solidStep = stepOf(tokens['bg-solid']);
    const on = tokens['text-on'];
    if (solidStep != null && on != null) {
      const onIsLight = contrastRatio(on, '#000000') > contrastRatio(on, '#ffffff');
      const sdir = onIsLight ? 1 : -1;
      const ordered = have
        .filter((s) => (Number(s) - Number(solidStep)) * sdir >= 0)
        .sort((a, b) => (Number(a) - Number(b)) * sdir);
      const hit =
        ordered.find((s) => contrastRatio(on, hex(s)) >= CONTRAST_MORE.TEXT) ??
        ordered[ordered.length - 1];
      if (hit != null && hit !== solidStep) {
        const at = (n: number) =>
          have[Math.max(0, Math.min(have.length - 1, have.indexOf(hit) + n * sdir))] as NumStep;
        out['bg-solid'] = ref(hit);
        out['bg-solid-bold'] = ref(at(1));
        out['bg-solid-x-bold'] = ref(at(2));
      }
    }
    // Drop entries identical to the baseline: the layer is a delta, like the dark block.
    for (const [k, v] of Object.entries(out)) if (tokens[k] === v) delete out[k];
    return out;
  };

  const lightMore = compute('light');
  const darkMore = compute('dark');
  // Dark-more must restate anything light-more sets: the light-more rule also matches a dark page
  // at lower specificity, so a token it sets and dark-more does not would leak the light value.
  for (const k of Object.keys(lightMore)) if (!(k in darkMore)) darkMore[k] = fr.dark[k] as string;
  return { role: fr.role, light: lightMore, dark: darkMore };
}

/** A role with the layer applied, for checking. */
export const withHighContrast = (fr: FunctionalRole, more: HighContrastRole): FunctionalRole => ({
  ...fr,
  light: { ...fr.light, ...more.light },
  dark: { ...fr.dark, ...more.dark },
});

/**
 * Judge the layer. Returns `{ failures, warnings }`: failures are below the baseline bars (the layer
 * is not a conforming alternative), warnings are below AAA.
 */
export function checkHighContrast(
  fr: FunctionalRole,
  more: HighContrastRole,
  numericOf: Parameters<typeof checkContrast>[1],
  surfaceBg: Parameters<typeof checkContrast>[2],
  appearances: readonly ('light' | 'dark')[] | undefined,
): { failures: string[]; warnings: string[] } {
  const merged = withHighContrast(fr, more);
  const none = () => {};
  const failures = checkContrast(merged, numericOf, surfaceBg, appearances, 0, none).map(
    (m) => `high-contrast layer: ${m}`,
  );
  const warnings: string[] = [];
  checkContrast(
    merged,
    numericOf,
    surfaceBg,
    appearances,
    0,
    none,
    {
      mode: 'warn',
      onWarn: (m) => warnings.push(`high-contrast layer (AAA 7:1) not reached: ${m}`),
    },
    CONTRAST_MORE,
  );
  return { failures, warnings };
}

// ── emission ────────────────────────────────────────────────────────────────

const TRIGGERS = [
  `:root[data-contrast="more"]`,
  `:root:has(:where(.contrast-toggle input:checked))`,
];
const MEDIA_ROOT = `:root:not([data-contrast="standard"])`;
const DARK_ATTRS = DARK_SEL.split(', ').map((s) => s.replace(/^:root/, ''));
/** `:not([…light])` pair that SYSTEM_DARK_SEL appends to `:root`. */
const NOT_LIGHT = SYSTEM_DARK_SEL.slice(':root'.length);

const block = (sel: string, decls: Record<string, string>, indent = ''): string => {
  const body = Object.entries(decls)
    .map(([k, v]) => `${indent}  ${k}: ${v};`)
    .join('\n');
  return `${indent}${sel} {\n${body}\n${indent}}\n`;
};

export interface ContrastMoreCssOptions {
  /** Same switch as the dark block's OS-preference twin. */
  systemColorScheme: boolean;
  darkOnly: boolean;
  /** Hue of the page surface role, for `--overlay`; absent when there is no surface role. */
  surfaceHue?: string;
  /** Hex-free solid for the focus ring, from the focus role. */
  focus?: { light?: string; dark?: string };
}

/**
 * The CSS for the layer, for the css and tailwind formats (Bricks provides its own colour tokens, so
 * there is nothing here for it to re-point).
 *
 * Specificity is what keeps the four appearances apart, so each block is written to beat the one
 * beneath it: dark-more is the trigger *and* the dark selector together, so it outranks both
 * light-more and the plain dark block regardless of source order, and the OS-preference twin repeats
 * the same pairing under `prefers-color-scheme`.
 */
export function contrastMoreCss(
  roles: readonly HighContrastRole[],
  opts: ContrastMoreCssOptions,
): string {
  const collect = (which: 'light' | 'dark'): Record<string, string> => {
    const decls: Record<string, string> = {};
    for (const r of roles)
      for (const [k, v] of Object.entries(r[which])) decls[tokenVar(r.role, k)] = v;
    return decls;
  };
  const light = collect('light');
  const dark = collect('dark');

  // Opaque surfaces and a firmer scrim: no transparency to lose contrast through.
  const surface = opts.surfaceHue;
  const flat = (overlay: number): Record<string, string> =>
    surface
      ? {
          '--surface-glass': 'var(--color-bg-surface)',
          '--overlay': `color-mix(in oklch, var(--color-${surface}-950) ${overlay}%, transparent)`,
        }
      : {};
  const lightDecls = { ...light, ...flat(80) };
  const darkDecls = { ...dark, ...flat(88) };
  if (opts.focus?.light) lightDecls['--color-border-focus'] = opts.focus.light;
  if (opts.focus?.dark) darkDecls['--color-border-focus'] = opts.focus.dark;

  const hasLight = Object.keys(lightDecls).length > 0;
  const hasDark = Object.keys(darkDecls).length > 0;
  if (!hasLight && !hasDark) return '';

  let css = `/* High contrast — prefers-contrast: more, [data-contrast="more"], or the .contrast-toggle checkbox */\n`;
  if (hasLight) {
    css += block(TRIGGERS.join(',\n'), lightDecls);
    css += `@media (prefers-contrast: more) {\n${block(MEDIA_ROOT, lightDecls, '  ')}}\n`;
  }
  if (hasDark && !opts.darkOnly) {
    css += block(TRIGGERS.flatMap((t) => DARK_ATTRS.map((d) => `${t}${d}`)).join(',\n'), darkDecls);
    css += `@media (prefers-contrast: more) {\n${block(
      DARK_ATTRS.map((d) => `${MEDIA_ROOT}${d}`).join(',\n  '),
      darkDecls,
      '  ',
    )}}\n`;
    if (opts.systemColorScheme) {
      css += `@media (prefers-color-scheme: dark) {\n${block(
        TRIGGERS.map((t) => `${t}${NOT_LIGHT}`).join(',\n  '),
        darkDecls,
        '  ',
      )}}\n`;
      css += `@media (prefers-contrast: more) and (prefers-color-scheme: dark) {\n${block(
        `${MEDIA_ROOT}${NOT_LIGHT}`,
        darkDecls,
        '  ',
      )}}\n`;
    }
  }
  return css;
}
