/**
 * Pure decisions behind `<Masthead />` and the `<SiteNav />` options: merge `site.chrome` with a
 * per-layout override, and turn the result into classes, custom properties and `SiteNav` props.
 * Kept out of the `.astro` file so it is asserted without rendering (the `sitenav.ts` split). It
 * imports the schema's literal lists as values from `@getvitops/config` (a zod-free-at-runtime
 * leaf for these constants) and nothing from the generator, so it cannot drag it into a Worker bundle.
 */
import {
  MASTHEAD_BEHAVIORS,
  MASTHEAD_LAYOUTS,
  MASTHEAD_POSITIONS,
  MASTHEAD_SURFACES,
  MASTHEAD_WIDTHS,
  NAV_BREAKPOINTS,
  NAV_COMPACT_MODES,
  NAV_DRAWER_SIDES,
  type ChromeNavConfig,
  type MastheadBehavior,
  type MastheadConfig,
  type MastheadLayout,
  type MastheadPosition,
  type MastheadSurface,
  type MastheadWidth,
} from '@getvitops/config';
import type { NavBreakpoint, NavCompactMode, NavDrawerSide } from './sitenav.ts';

/** A masthead override: any `site.chrome.masthead` field, plus `elevation` merged key-by-key. */
export type MastheadOptions = MastheadConfig;

export interface ResolvedMasthead {
  position: MastheadPosition;
  behavior: MastheadBehavior;
  surface: MastheadSurface;
  tone: string | undefined;
  layout: MastheadLayout;
  width: MastheadWidth;
  shadow: string | undefined;
  border: boolean;
  elevateOnScroll: boolean;
  height: string | undefined;
  inset: string | undefined;
}

/**
 * What `resolveMasthead` needs from a config — a whole `Config`, or just `{ site: { chrome } }`.
 * Deliberately loose: a plain `import site from './site.json'` types every enum as `string`, which
 * the strict `ChromeConfig` would reject (the same trap `resolveOrganizationName` fell into). The
 * values are checked at runtime instead, with the names of the allowed ones in the error.
 */
export interface ChromeSource {
  site?: { chrome?: { masthead?: Record<string, any>; nav?: Record<string, any> } };
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T | undefined {
  if (value === undefined) return undefined;
  if (!allowed.includes(value as T))
    throw new Error(
      `site.chrome ${field}: "${String(value)}" is not one of ${allowed.join(' | ')}.`,
    );
  return value as T;
}

const LENGTH_FUNCTIONS = new Set(['calc', 'clamp', 'min', 'max']);
const LENGTH_UNITS = new Set([
  'px',
  'rem',
  'em',
  'ch',
  '%',
  'vw',
  'vh',
  'vi',
  'vb',
  'svw',
  'svh',
  'dvw',
  'dvh',
  'lvw',
  'lvh',
  'cqw',
  'cqh',
  'cqi',
  'cqb',
]);

/**
 * A CSS length written into a `<style>` — so a closed grammar, not a blocklist. Numbers must carry
 * a unit from `LENGTH_UNITS` (or be a bare `0`), functions are limited to `calc|clamp|min|max`,
 * parentheses must balance, and nothing else is admitted: no `var()`, `url()`, `;`, braces or quotes.
 * `4rem`, `clamp(3.5rem, 8cqi, 4.5rem)` and `min(100%, 80rem)` pass; `4rem;}body{…` does not.
 */
export function isSafeLength(value: string): boolean {
  if (!/^[0-9a-z%.,+\-*/() ]+$/.test(value)) return false;
  let depth = 0;
  for (const ch of value) {
    if (ch === '(') depth++;
    else if (ch === ')' && --depth < 0) return false;
  }
  if (depth !== 0) return false;
  // Every identifier directly before `(` must be an allowed function.
  for (const [, name] of value.matchAll(/([a-z]+)\(/g))
    if (!LENGTH_FUNCTIONS.has(name!)) return false;
  // Strip the function names, then every remaining word must be a number+unit or a lone operator.
  const rest = value.replace(/[a-z]+\(/g, '(');
  const tokens = rest.split(/[\s,()+*/]+|(?<=\d)-(?=\d)|\s-\s/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((t) => {
    if (t === '0' || t === '-') return true;
    const m = /^-?(?:\d+\.?\d*|\.\d+)([a-z%]*)$/.exec(t);
    return m !== null && m[1] !== undefined && LENGTH_UNITS.has(m[1]);
  });
}
const ROLE = /^[a-z][a-z0-9-]*$/;
const SHADOW = /^[a-z0-9][a-z0-9-]*$/;

export function resolveMasthead(
  config: ChromeSource | undefined,
  override: MastheadOptions = {},
): ResolvedMasthead {
  const base: MastheadConfig = config?.site?.chrome?.masthead ?? {};
  const pick = <K extends keyof MastheadConfig>(k: K): MastheadConfig[K] =>
    override[k] !== undefined ? override[k] : base[k];
  const elevation = { ...base.elevation, ...override.elevation };

  const position = oneOf(pick('position'), MASTHEAD_POSITIONS, 'masthead.position') ?? 'static';
  const height = pick('height');
  if (height !== undefined && !isSafeLength(height))
    throw new Error(
      `Masthead: height "${height}" is not a plain CSS length (e.g. "4rem" or "clamp(3.5rem, 8cqi, 4.5rem)").`,
    );
  const inset = pick('inset');
  if (inset !== undefined && !isSafeLength(inset))
    throw new Error(
      `Masthead: inset "${inset}" is not a plain CSS length (e.g. "0.75rem" or "clamp(0.5rem, 2cqi, 1.5rem)").`,
    );
  const tone = pick('tone');
  if (tone !== undefined && !ROLE.test(tone.replace(/:solid$/, '')))
    throw new Error(`Masthead: tone "${tone}" must be a role name, optionally "<role>:solid".`);
  if (elevation.shadow !== undefined && !SHADOW.test(elevation.shadow))
    throw new Error(`Masthead: elevation.shadow "${elevation.shadow}" is not a shadow name.`);

  return {
    position,
    // Nothing to hide when the bar scrolls away with the page anyway.
    behavior:
      position === 'static'
        ? 'always'
        : (oneOf(pick('behavior'), MASTHEAD_BEHAVIORS, 'masthead.behavior') ?? 'always'),
    surface: oneOf(pick('surface'), MASTHEAD_SURFACES, 'masthead.surface') ?? 'solid',
    tone,
    layout: oneOf(pick('layout'), MASTHEAD_LAYOUTS, 'masthead.layout') ?? 'full',
    width: oneOf(pick('width'), MASTHEAD_WIDTHS, 'masthead.width') ?? 'content',
    shadow: elevation.shadow,
    border: elevation.border ?? false,
    elevateOnScroll: elevation.onScroll ?? false,
    height,
    inset,
  };
}

/** Modifier classes on `.masthead`. */
export function mastheadClass(m: ResolvedMasthead): string[] {
  const scrollOnly = m.elevateOnScroll;
  return [
    'masthead',
    ...(m.position !== 'static' ? [`masthead--${m.position}`] : []),
    ...(m.behavior === 'hide-on-scroll' ? ['masthead--hide-on-scroll'] : []),
    m.surface !== 'solid' ? `masthead--${m.surface}` : '',
    m.layout !== 'full' ? `masthead--${m.layout}` : '',
    ...(m.shadow
      ? ['masthead--shadow', ...(scrollOnly ? ['masthead--shadow-on-scroll'] : [])]
      : []),
    ...(m.border
      ? ['masthead--border', ...(scrollOnly ? ['masthead--border-on-scroll'] : [])]
      : []),
    ...(m.tone ? ['tone'] : []),
  ].filter(Boolean);
}

/**
 * The `.tone` custom properties for a role, as a `style` string. Each is a `var()` chain that
 * degrades to the surface role, so a role the site never defined is a neutral bar, not a
 * transparent one. `<role>:solid` fills with the role's solid and its computed foreground.
 */
export function mastheadStyle(m: ResolvedMasthead): string | undefined {
  const parts: string[] = [];
  if (m.tone) {
    const solid = m.tone.endsWith(':solid');
    const r = m.tone.replace(/:solid$/, '');
    parts.push(
      solid
        ? `--tone-bg: var(--color-bg-${r}-solid, var(--color-bg-${r}, var(--color-bg-surface)))`
        : `--tone-bg: var(--color-bg-${r}, var(--color-bg-${r}-muted, var(--color-bg-surface)))`,
      solid
        ? `--tone-fg: var(--color-text-on-${r}, var(--color-text-surface))`
        : `--tone-fg: var(--color-text-${r}, var(--color-text-surface))`,
      `--tone-border: var(--color-border-${r}, var(--color-border-surface))`,
    );
  }
  if (m.shadow) parts.push(`--masthead-shadow: var(--shadow-${m.shadow})`);
  return parts.length ? parts.join('; ') : undefined;
}

/**
 * Page-level rule for a custom height and inset — `--header-offset` reads both from `:root`, and
 * the vars inherit down to the masthead. The inset is written only for a layout that has one (a
 * full-width bar sits flush) and then always, defaulted to the same `0.75rem` the element falls
 * back to, since `--header-offset` adds `--masthead-inset` unconditionally.
 */
export function mastheadRootCss(m: ResolvedMasthead): string | undefined {
  const decls = [
    m.height ? `--masthead-height:${m.height}` : '',
    // Always written for an inset layout, defaulted, so `--header-offset` and the element agree.
    m.layout !== 'full' ? `--masthead-inset:${m.inset ?? '0.75rem'}` : '',
  ].filter(Boolean);
  return decls.length ? `:root{${decls.join(';')}}` : undefined;
}

/** `<SiteNav>` props from `site.chrome.nav`, with an optional override. */
export interface ResolvedNavOptions {
  breakpoint?: NavBreakpoint;
  mobileBreakpoint?: NavBreakpoint;
  megaBreakpoint?: NavBreakpoint;
  depth?: number;
  megaDepth?: number;
  compact?: NavCompactMode;
  drawerSide?: NavDrawerSide;
}

export function resolveNavOptions(
  config: ChromeSource | undefined,
  override: ChromeNavConfig = {},
): ResolvedNavOptions {
  const m = stripUndefined({ ...config?.site?.chrome?.nav, ...stripUndefined(override) });
  return stripUndefined({
    breakpoint: oneOf(m.breakpoint, NAV_BREAKPOINTS, 'nav.breakpoint'),
    mobileBreakpoint: oneOf(m.mobileBreakpoint, NAV_BREAKPOINTS, 'nav.mobileBreakpoint'),
    megaBreakpoint: oneOf(m.megaBreakpoint, NAV_BREAKPOINTS, 'nav.megaBreakpoint'),
    depth: m.depth,
    megaDepth: m.megaDepth,
    compact: oneOf(m.compact, NAV_COMPACT_MODES, 'nav.compact'),
    drawerSide: oneOf(m.drawerSide, NAV_DRAWER_SIDES, 'nav.drawerSide'),
  }) as ResolvedNavOptions;
}

function stripUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}
