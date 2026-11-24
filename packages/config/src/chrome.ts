import * as z from '@zod/mini';
import { desc } from './desc.ts';
import type { ScrollState } from './scroll-states.ts';

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
export const MASTHEAD_SURFACES = ['solid', 'glass', 'transparent'] as const;
export const MASTHEAD_LAYOUTS = ['full', 'inset', 'floating'] as const;
export const MASTHEAD_WIDTHS = ['full', 'content'] as const;
export const NAV_BREAKPOINTS = ['sm', 'md', 'lg', 'xl'] as const;
export const NAV_COMPACT_MODES = ['drawer', 'dropdown'] as const;
export const NAV_DRAWER_SIDES = ['start', 'end'] as const;

export type MastheadPosition = (typeof MASTHEAD_POSITIONS)[number];
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
});

export const MastheadStateElevationSchema = z.union([z.literal(false), MastheadElevationSchema]);

/**
 * What a masthead looks like in one scroll state: any of these REPLACE the settled value while the
 * state holds; anything omitted stays as settled. Shadow and border can be removed or restyled
 * (`elevation: false`); a border the settled look does not have is not added.
 */
export const MastheadStateSchema = z.strictObject({
  layout: desc(
    z.optional(z.enum(MASTHEAD_LAYOUTS)),
    'Layout in this state, e.g. `full` at the top and `inset` once scrolled (set the settled `layout` to `inset`). Animated.',
  ),
  height: desc(
    z.optional(z.string()),
    'Row height in this state. Same length grammar as the settled `height`. Animated.',
  ),
  inset: desc(
    z.optional(z.string()),
    'Gap to the viewport edge in this state (only meaningful for an `inset`/`floating` layout). Animated.',
  ),
  surface: desc(
    z.optional(z.enum(MASTHEAD_SURFACES)),
    'Surface in this state, e.g. `transparent` over a hero.',
  ),
  elevation: desc(
    z.optional(MastheadStateElevationSchema),
    '`false` removes the shadow and border; `{ shadow }` swaps the shadow.',
  ),
  hidden: desc(
    z.optional(z.boolean()),
    'Slide the bar off-screen. Never while it has focus or a menu inside it is open. `atStart: { hidden: true }` also needs a page that can scroll, so a short page keeps the bar.',
  ),
});

/** One optional entry per `SCROLL_STATES` member (spelled out so the inferred type stays exact). */
export const MastheadStatesSchema = z.strictObject({
  atStart: z.optional(MastheadStateSchema),
  atEnd: z.optional(MastheadStateSchema),
  scrollingToEnd: z.optional(MastheadStateSchema),
  scrollingToStart: z.optional(MastheadStateSchema),
});
// Fails to compile when `SCROLL_STATES` and the schema's keys diverge.
type StateKey = keyof z.infer<typeof MastheadStatesSchema>;
const _statesMatch: [StateKey] extends [ScrollState]
  ? [ScrollState] extends [StateKey]
    ? true
    : never
  : never = true;
void _statesMatch;

export const MastheadSchema = z.strictObject({
  position: desc(
    z.optional(z.enum(MASTHEAD_POSITIONS)),
    '`static` scrolls away; `sticky` stays in flow and pins to the top; `fixed` is out of flow and overlays the first section (for a masthead over a hero). A masthead with `states` that change its size, layout or visibility is promoted to `fixed`, because on a sticky bar a size change would reflow the page at the threshold. Default `static`.',
  ),
  surface: desc(
    z.optional(z.enum(MASTHEAD_SURFACES)),
    '`solid`, `glass` (blurred + tinted via `--surface-glass`) or `transparent`. Default `solid`. For a bar that is clear at the top and solid after, set `states.atStart.surface: transparent`.',
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
  states: desc(
    z.optional(MastheadStatesSchema),
    'How the masthead looks in each scroll state, as partial overrides of the settled look: `atStart` (page at the top), `atEnd`, `scrollingToEnd` (scrolling down), `scrollingToStart` (scrolling up); later states win. Animated. Uses `scroll-state()`; a browser without it (Firefox today) keeps the settled look. E.g. `{ "atStart": { "layout": "full", "height": "6rem", "surface": "transparent" }, "scrollingToEnd": { "hidden": true } }` with a settled `layout: inset`.',
  ),
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

export const BackToTopSchema = z.strictObject({
  label: desc(z.optional(z.string()), 'Accessible name and text. Default `Back to top`.'),
  target: desc(
    z.optional(z.string()),
    'In-page anchor to scroll to, e.g. `#top` (default) or `#main`.',
  ),
});

export const ChromeSchema = z.strictObject({
  masthead: desc(
    z.optional(MastheadSchema),
    'The top bar: position, scroll behaviour, surface, layout, elevation.',
  ),
  nav: desc(z.optional(ChromeNavSchema), 'How the masthead navigation behaves at each width.'),
  backToTop: desc(
    z.optional(z.union([z.boolean(), BackToTopSchema])),
    'A floating back-to-top link, rendered by `<SiteFooter>`, visible once the page has scrolled. `true` for defaults. A browser without `scroll-state()` (Firefox today) shows it always.',
  ),
});

export type MastheadConfig = z.infer<typeof MastheadSchema>;
export type BackToTopConfig = z.infer<typeof BackToTopSchema>;
export type ChromeNavConfig = z.infer<typeof ChromeNavSchema>;
export type ChromeConfig = z.infer<typeof ChromeSchema>;
