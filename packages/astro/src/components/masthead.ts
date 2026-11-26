/**
 * Pure decisions behind `<Masthead />` and the `<SiteNav />` options: merge `site.chrome` with a
 * per-layout override, and turn the result into classes, custom properties and `SiteNav` props.
 * Kept out of the `.astro` file so it is asserted without rendering (the `sitenav.ts` split). It
 * imports the schema's literal lists as values from `@getvitops/config` (a zod-free-at-runtime
 * leaf for these constants) and nothing from the generator, so it cannot drag it into a Worker bundle.
 */
import type { OrganizationLike } from './footer.ts';
import {
  MASTHEAD_LAYOUTS,
  MASTHEAD_POSITIONS,
  MASTHEAD_SURFACES,
  MASTHEAD_WIDTHS,
  NAV_BREAKPOINTS,
  NAV_COMPACT_MODES,
  NAV_DRAWER_SIDES,
  SCROLL_STATES,
  scrollStateSlug,
  type ChromeNavConfig,
  type MastheadConfig,
  type MastheadLayout,
  type MastheadPosition,
  type MastheadSurface,
  type MastheadWidth,
  type ScrollState,
} from '@getvitops/config';
import type { NavBreakpoint, NavCompactMode, NavDrawerSide } from './sitenav.ts';

/** A masthead override: any `site.chrome.masthead` field, plus `elevation` merged key-by-key. */
export type MastheadOptions = MastheadConfig;

/** One scroll state's overrides, validated. Anything omitted stays as the settled look. */
export interface ResolvedMastheadState {
  layout?: MastheadLayout;
  height?: string;
  inset?: string;
  surface?: MastheadSurface;
  /** `false` removes the shadow and border; an object swaps the shadow / border colour. */
  elevation?: false | { shadow?: string; border?: boolean };
  hidden?: boolean;
}

export interface ResolvedMasthead {
  position: MastheadPosition;
  surface: MastheadSurface;
  tone: string | undefined;
  layout: MastheadLayout;
  width: MastheadWidth;
  shadow: string | undefined;
  border: boolean;
  height: string | undefined;
  inset: string | undefined;
  /** Per-scroll-state overrides; a state with nothing to say is absent. */
  states: Partial<Record<ScrollState, ResolvedMastheadState>>;
}

/**
 * What `resolveMasthead` needs from a config — a whole `Config`, or just `{ site: { chrome } }`.
 * Deliberately loose: a plain `import site from './vitops.json'` types every enum as `string`, which
 * the strict `ChromeConfig` would reject (the same trap `resolveOrganizationName` fell into). The
 * values are checked at runtime instead, with the names of the allowed ones in the error.
 */
export interface ChromeSource {
  site?: { chrome?: { masthead?: Record<string, any>; nav?: Record<string, any> } };
  /** Read by `<SiteFooter>` (contact column, logo) and `<Masthead>` (logo); see `footer.ts`. */
  organization?: OrganizationLike;
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

/** The 9.0 alpha moved scroll behaviour into `states`; each old spelling says where it went. */
const MOVED_SCROLL_FIELDS: Record<string, string> = {
  'behavior: "reveal-on-scroll"': 'states.atStart.hidden: true',
  'behavior: "hide-on-scroll"': 'states.scrollingToEnd.hidden: true',
  'surface: "transparent-until-scrolled"':
    'surface (the settled one) + states.atStart.surface: "transparent"',
  'elevation.onScroll': 'states.atStart.elevation: false',
};

function rejectMovedFields(masthead: Record<string, any>): void {
  const found: string[] = [];
  if (masthead.behavior === 'reveal-on-scroll') found.push('behavior: "reveal-on-scroll"');
  else if (masthead.behavior === 'hide-on-scroll') found.push('behavior: "hide-on-scroll"');
  else if (masthead.behavior !== undefined && masthead.behavior !== 'always')
    found.push(`behavior: "${String(masthead.behavior)}"`);
  if (masthead.surface === 'transparent-until-scrolled')
    found.push('surface: "transparent-until-scrolled"');
  if (masthead.elevation?.onScroll !== undefined) found.push('elevation.onScroll');
  if (masthead.behavior === 'always') found.push('behavior: "always"');
  if (!found.length) return;
  const moves = found
    .map(
      (f) => `  ${f} → ${MOVED_SCROLL_FIELDS[f] ?? 'remove it (the settled look is the default)'}`,
    )
    .join('\n');
  throw new Error(
    `site.chrome.masthead: scroll behaviour is now described by \`states\`, one partial look per scroll state (atStart, atEnd, scrollingToEnd, scrollingToStart). These moved:\n${moves}`,
  );
}

function resolveState(raw: Record<string, any>, field: string): ResolvedMastheadState {
  const known = ['layout', 'height', 'inset', 'surface', 'elevation', 'hidden'];
  for (const k of Object.keys(raw))
    if (!known.includes(k))
      throw new Error(`site.chrome ${field}: unknown field "${k}" (one of ${known.join(', ')}).`);
  const out: ResolvedMastheadState = {};
  const layout = oneOf(raw.layout, MASTHEAD_LAYOUTS, `${field}.layout`);
  if (layout) out.layout = layout;
  for (const k of ['height', 'inset'] as const) {
    const v = raw[k];
    if (v === undefined) continue;
    if (typeof v !== 'string' || !isSafeLength(v))
      throw new Error(`site.chrome ${field}.${k}: "${String(v)}" is not a plain CSS length.`);
    out[k] = v;
  }
  const surface = oneOf(raw.surface, MASTHEAD_SURFACES, `${field}.surface`);
  if (surface) out.surface = surface;
  if (raw.elevation !== undefined) {
    if (raw.elevation === false) out.elevation = false;
    else {
      const { shadow, border, ...rest } = raw.elevation as Record<string, any>;
      if (Object.keys(rest).length)
        throw new Error(`site.chrome ${field}.elevation: unknown field "${Object.keys(rest)[0]}".`);
      if (shadow !== undefined && !SHADOW.test(shadow))
        throw new Error(`site.chrome ${field}.elevation.shadow "${shadow}" is not a shadow name.`);
      out.elevation = {
        ...(shadow !== undefined ? { shadow } : {}),
        ...(border !== undefined ? { border: Boolean(border) } : {}),
      };
    }
  }
  if (raw.hidden !== undefined) out.hidden = Boolean(raw.hidden);
  return out;
}

export function resolveMasthead(
  config: ChromeSource | undefined,
  override: MastheadOptions = {},
): ResolvedMasthead {
  const base: MastheadConfig = config?.site?.chrome?.masthead ?? {};
  rejectMovedFields(base as Record<string, any>);
  rejectMovedFields(override as Record<string, any>);
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

  const rawStates = { ...base.states } as Record<string, Record<string, any> | undefined>;
  for (const [k, v] of Object.entries(override.states ?? {}))
    rawStates[k] = { ...rawStates[k], ...v };
  const states: Partial<Record<ScrollState, ResolvedMastheadState>> = {};
  for (const key of Object.keys(rawStates)) {
    if (!(SCROLL_STATES as readonly string[]).includes(key))
      throw new Error(
        `site.chrome masthead.states: "${key}" is not one of ${SCROLL_STATES.join(' | ')}.`,
      );
    const resolved = resolveState(rawStates[key] ?? {}, `masthead.states.${key}`);
    if (Object.keys(resolved).length) states[key as ScrollState] = resolved;
  }

  // A state that hides the bar at the start, or changes its size or layout, implies `fixed`: a
  // sticky bar keeps its space in flow, so hiding it leaves an empty band over the hero and a size
  // change would reflow the page at the threshold, flipping the state back and forth.
  const needsFixed = Object.entries(states).some(
    ([key, st]) =>
      st.height !== undefined ||
      st.layout !== undefined ||
      st.inset !== undefined ||
      (key === 'atStart' && st.hidden === true),
  );
  const resolvedPosition = needsFixed ? 'fixed' : position;
  // Nothing to hide when the bar scrolls away with the page anyway.
  if (resolvedPosition === 'static')
    for (const [key, st] of Object.entries(states)) {
      delete st.hidden;
      if (!Object.keys(st).length) delete states[key as ScrollState];
    }

  return {
    position: resolvedPosition,
    surface: oneOf(pick('surface'), MASTHEAD_SURFACES, 'masthead.surface') ?? 'solid',
    tone,
    layout: oneOf(pick('layout'), MASTHEAD_LAYOUTS, 'masthead.layout') ?? 'full',
    width: oneOf(pick('width'), MASTHEAD_WIDTHS, 'masthead.width') ?? 'content',
    shadow: elevation.shadow,
    border: elevation.border ?? false,
    height,
    inset,
    states,
  };
}

/** Modifier classes on `.masthead`. */
export function mastheadClass(m: ResolvedMasthead): string[] {
  return [
    'masthead',
    ...(m.position !== 'static' ? [`masthead--${m.position}`] : []),
    ...(Object.keys(m.states).length ? ['masthead--states'] : []),
    m.surface !== 'solid' ? `masthead--${m.surface}` : '',
    m.layout !== 'full' ? `masthead--${m.layout}` : '',
    ...(m.shadow ? ['masthead--shadow'] : []),
    ...(m.border ? ['masthead--border'] : []),
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
  parts.push(...mastheadStateDecls(m));
  return parts.length ? parts.join('; ') : undefined;
}

/**
 * One state's overrides as `--masthead-<state>-<prop>` declarations, the hooks `masthead.css` reads
 * inside the matching `scroll-state()` query. Written on the ELEMENT (not `:root`) because several
 * values reference element-level properties (`--_masthead-base`, `--tone-border`), which a `:root`
 * declaration could not resolve. Enum fields expand to the properties they stand for: a `full`
 * layout is zero inset and radius, `transparent` is a clear background with no blur.
 */
export function mastheadStateDecls(m: ResolvedMasthead): string[] {
  const out: string[] = [];
  for (const state of SCROLL_STATES) {
    const st = m.states[state];
    if (!st) continue;
    const p = `--masthead-${scrollStateSlug(state)}`;
    if (st.height) out.push(`${p}-height: ${st.height}`);
    if (st.layout) {
      const inset = st.inset ?? m.inset ?? '0.75rem';
      out.push(`${p}-inset: ${st.layout === 'full' ? '0px' : inset}`);
      out.push(
        `${p}-radius: ${
          st.layout === 'full'
            ? '0px'
            : st.layout === 'inset'
              ? 'var(--br-control, 0.375rem)'
              : 'var(--br-panel, 1rem)'
        }`,
      );
    } else if (st.inset) out.push(`${p}-inset: ${st.inset}`);
    if (st.surface) {
      const solid = 'var(--masthead-bg, var(--_masthead-base))';
      out.push(
        `${p}-bg: ${
          st.surface === 'glass'
            ? `color-mix(in oklch, ${solid} var(--masthead-glass-opacity, 72%), transparent)`
            : st.surface === 'transparent'
              ? 'transparent'
              : solid
        }`,
      );
      out.push(
        `${p}-blur: ${st.surface === 'glass' ? 'blur(var(--masthead-blur, 12px))' : 'none'}`,
      );
    }
    if (st.elevation === false) {
      out.push(`${p}-shadow: none`, `${p}-border-color: transparent`);
    } else if (st.elevation) {
      if (st.elevation.shadow) out.push(`${p}-shadow: var(--shadow-${st.elevation.shadow})`);
      if (st.elevation.border !== undefined)
        out.push(
          `${p}-border-color: ${
            st.elevation.border ? 'var(--tone-border, var(--color-border-surface))' : 'transparent'
          }`,
        );
    }
    if (st.hidden !== undefined) out.push(`${p}-hidden: ${st.hidden ? 1 : 0}`);
  }
  return out;
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

/** `site.chrome.backToTop` resolved: `undefined` when off, else the label and target. */
export function resolveBackToTop(
  config: ChromeSource | undefined,
): { label: string; target: string } | undefined {
  const v = (config?.site?.chrome as { backToTop?: unknown } | undefined)?.backToTop;
  if (!v) return undefined;
  const o = typeof v === 'object' ? (v as { label?: string; target?: string }) : {};
  const target = o.target ?? '#top';
  if (!/^#[A-Za-z][\w-]*$/.test(target))
    throw new Error(`site.chrome backToTop.target: "${target}" must be an in-page "#anchor".`);
  return { label: o.label ?? 'Back to top', target };
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
