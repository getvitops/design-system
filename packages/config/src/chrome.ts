import * as z from '@zod/mini';
import { desc } from './desc.ts';

/**
 * `site.chrome` — the site's page-level furniture: the **masthead** (the top bar holding brand,
 * navigation and actions) and how its navigation behaves at each width.
 *
 * Why `chrome`/`masthead` and not `header`/`banner`: `<header>` is valid inside any section or
 * article, and `banner` already means the announcement bar (`.banner`, `vitops_banner`) — and is
 * the ARIA landmark role auditors flag when written explicitly on a `<header>`.
 *
 * Read by `@getvitops/astro`'s `resolveMasthead()` / `resolveNavOptions()`; a `<Masthead>` prop
 * overrides the matching field for one layout (e.g. a transparent-over-hero landing page).
 */

export const MASTHEAD_POSITIONS = ['static', 'sticky', 'fixed'] as const;
export const MASTHEAD_BEHAVIORS = ['always', 'hide-on-scroll'] as const;
export const MASTHEAD_SURFACES = [
  'solid',
  'glass',
  'transparent',
  'transparent-until-scrolled',
] as const;
export const MASTHEAD_LAYOUTS = ['full', 'inset', 'floating'] as const;
export const MASTHEAD_WIDTHS = ['full', 'content'] as const;
export const NAV_BREAKPOINTS = ['sm', 'md', 'lg', 'xl'] as const;
export const NAV_COMPACT_MODES = ['drawer', 'dropdown'] as const;
export const NAV_DRAWER_SIDES = ['start', 'end'] as const;

export type MastheadPosition = (typeof MASTHEAD_POSITIONS)[number];
export type MastheadBehavior = (typeof MASTHEAD_BEHAVIORS)[number];
export type MastheadSurface = (typeof MASTHEAD_SURFACES)[number];
export type MastheadLayout = (typeof MASTHEAD_LAYOUTS)[number];
export type MastheadWidth = (typeof MASTHEAD_WIDTHS)[number];

export const MastheadElevationSchema = z.strictObject({
  shadow: desc(
    z.optional(z.string()),
    'A `designSystem.shadows` key (e.g. `sm`). Omit for no shadow.',
  ),
  border: desc(
    z.optional(z.boolean()),
    'A bottom border (a full outline when `layout` is not `full`).',
  ),
  onScroll: desc(
    z.optional(z.boolean()),
    'Apply the shadow/border only once the page has scrolled, so the masthead sits flush with the page at the top. Uses `scroll-state()` container queries; in a browser without them (Firefox today) the elevation is simply always on.',
  ),
});

export const MastheadSchema = z.strictObject({
  position: desc(
    z.optional(z.enum(MASTHEAD_POSITIONS)),
    '`static` scrolls away; `sticky` stays in flow and pins to the top; `fixed` is out of flow and overlays the first section (for a transparent masthead over a hero). Default `static`.',
  ),
  behavior: desc(
    z.optional(z.enum(MASTHEAD_BEHAVIORS)),
    '`hide-on-scroll` slides the masthead away while scrolling down and back on scrolling up. Ignored when `position` is `static`. It never hides while a menu inside it is open or has focus. Uses `scroll-state()`; in a browser without it (Firefox today) the masthead just stays visible. Default `always`.',
  ),
  surface: desc(
    z.optional(z.enum(MASTHEAD_SURFACES)),
    '`solid`, `glass` (blurred + tinted via `--surface-glass`), `transparent`, or `transparent-until-scrolled` (clear while the page is at the top, solid once it scrolls; a browser without `scroll-state()` shows it solid throughout). Default `solid`.',
  ),
  tone: desc(
    z.optional(z.string()),
    "A `colors.roles` key, optionally `<role>:solid`, applied as the masthead `.tone` so text contrast stays the generator's guarantee.",
  ),
  layout: desc(
    z.optional(z.enum(MASTHEAD_LAYOUTS)),
    '`full` is flush to the viewport edges; `inset` leaves a gap to them; `floating` is inset with a panel radius. Default `full`.',
  ),
  width: desc(
    z.optional(z.enum(MASTHEAD_WIDTHS)),
    "`content` keeps the masthead row on the page's `.centered` track; `full` lets it span the masthead. Default `content`.",
  ),
  elevation: desc(z.optional(MastheadElevationSchema), 'Shadow and border.'),
  height: desc(
    z.optional(z.string()),
    'CSS length for the masthead row (default `4rem`). `calc()`, `clamp()`, `min()` and `max()` are accepted, so it can be fluid: `clamp(3.5rem, 8cqi, 4.5rem)`. `cqi` resolves against the nearest size container (`body`, the same one the nav breakpoints use), `vw` against the viewport. Becomes `--masthead-height` and, when the masthead is sticky or fixed, `--header-offset` so in-page anchors land below it.',
  ),
  inset: desc(
    z.optional(z.string()),
    'Gap between a `layout: inset` or `floating` masthead and the viewport edge (default `0.75rem`). Same length grammar as `height`, e.g. `clamp(0.5rem, 2cqi, 1.5rem)`. Ignored when `layout` is `full`. Becomes `--masthead-inset` and is counted in `--header-offset`.',
  ),
});

export const ChromeNavSchema = z.strictObject({
  breakpoint: desc(
    z.optional(z.enum(NAV_BREAKPOINTS)),
    'Container width where the default `primary` menu promotes from the compact control to a navbar. Default `md`.',
  ),
  mobileBreakpoint: desc(
    z.optional(z.enum(NAV_BREAKPOINTS)),
    'Where a `primary-mobile` menu hands over to `primary`. Default = `breakpoint`.',
  ),
  megaBreakpoint: desc(
    z.optional(z.enum(NAV_BREAKPOINTS)),
    'Where a `primary-mega` menu takes over. Default `xl`.',
  ),
  depth: desc(
    z.optional(z.int().check(z.gte(1), z.lte(3))),
    'Levels in the default nav (1–3). Default 3.',
  ),
  megaDepth: desc(
    z.optional(z.int().check(z.gte(1), z.lte(3))),
    'Levels in the mega panel (1–3). Default 3.',
  ),
  compact: desc(
    z.optional(z.enum(NAV_COMPACT_MODES)),
    'What the toggle opens below its breakpoint: an edge `drawer`, or a columnar `dropdown` panel anchored under the toggle. Default `drawer`.',
  ),
  drawerSide: desc(
    z.optional(z.enum(NAV_DRAWER_SIDES)),
    'Edge the drawer slides from when `compact` is `drawer`. Default `end`.',
  ),
});

export const ChromeSchema = z.strictObject({
  masthead: desc(
    z.optional(MastheadSchema),
    'The top bar: position, scroll behaviour, surface, layout, elevation.',
  ),
  nav: desc(z.optional(ChromeNavSchema), 'How the masthead navigation behaves at each width.'),
});

export type MastheadConfig = z.infer<typeof MastheadSchema>;
export type ChromeNavConfig = z.infer<typeof ChromeNavSchema>;
export type ChromeConfig = z.infer<typeof ChromeSchema>;
