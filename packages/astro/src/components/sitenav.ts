/**
 * Pure decisions behind `<SiteNav />` / `<SiteFooter />` — which menus render, to what
 * depth, at which container breakpoint, and how an item reads. Kept out of the `.astro`
 * files so they are asserted in `sitenav.test.ts` without rendering (the same split
 * `tree.ts` makes for `<Tree />`).
 *
 * The item shape is structural, not imported from `emdash`: `@getvitops/astro` has no
 * dependency on the CMS, and an EmDash `MenuItem` already satisfies it.
 */

export type NavBreakpoint = 'sm' | 'md' | 'lg' | 'xl';

/** Container breakpoints, in rem — the same four `layout.css` queries use. */
export const BREAKPOINT_REM: Record<NavBreakpoint, number> = { sm: 30, md: 48, lg: 64, xl: 80 };

const BREAKPOINT_ORDER: NavBreakpoint[] = ['sm', 'md', 'lg', 'xl'];

export interface NavItem {
  label: string;
  url?: string | null;
  target?: string;
  /**
   * EmDash menu items have no description field. The documented convention until
   * they do: **`titleAttr` is the item's description**, shown as a second line under
   * a dropdown/drawer sub-item. It is deliberately NOT emitted as a `title=""`
   * tooltip — that would announce it twice and is unreachable by keyboard/touch.
   */
  titleAttr?: string;
  /** Extra classes from the editor; passed through on the link. */
  cssClasses?: string;
  children?: NavItem[];
}

/** A menu as `getMenu()` returns it, or just its items. */
export type NavMenuInput = { items?: NavItem[] | null } | NavItem[] | null | undefined;

/** The three menu names `<SiteNav>` knows, and the tier each one is. */
export const MENU_NAMES = {
  primary: 'primary',
  mobile: 'primary-mobile',
  mega: 'primary-mega',
} as const;

/**
 * A planned link: an item whose `cssClasses` contains `draft` is kept in the menu (so it is there
 * to publish later, with its place in the order) but is not rendered, nor are its children.
 * EmDash menu items have no draft state of their own, so the editor's "CSS classes" field carries it.
 */
export function isDraft(item: NavItem): boolean {
  return /(^|\s)draft(\s|$)/.test(item.cssClasses ?? '');
}

const hasDraft = (items: NavItem[]): boolean =>
  items.some((item) => isDraft(item) || hasDraft(item.children ?? []));

/** Drop draft items at every level, returning copies; the input is never mutated. */
function withoutDrafts(items: NavItem[]): NavItem[] {
  if (!hasDraft(items)) return items; // no drafts: hand back the cached menu untouched
  return items
    .filter((item) => !isDraft(item))
    .map((item) =>
      item.children?.length ? { ...item, children: withoutDrafts(item.children) } : item,
    );
}

export function menuItems(menu: NavMenuInput): NavItem[] {
  if (!menu) return [];
  const items = Array.isArray(menu) ? menu : (menu.items ?? []);
  return withoutDrafts(items);
}

/**
 * Fetch whichever of the three header menus exist. `getMenu` is passed in rather than
 * imported, so this stays CMS-free: `loadNavMenus(getMenu)` with `emdash`'s.
 */
export async function loadNavMenus(
  getMenu: (name: string) => Promise<NavMenuInput>,
): Promise<{ primary: NavMenuInput; mobile: NavMenuInput; mega: NavMenuInput }> {
  const [primary, mobile, mega] = await Promise.all([
    getMenu(MENU_NAMES.primary),
    getMenu(MENU_NAMES.mobile),
    getMenu(MENU_NAMES.mega),
  ]);
  return { primary, mobile, mega };
}

/**
 * Cut a tree to `depth` levels (1 = top level only). Returns copies, never mutates —
 * a menu object from `getMenu()` is cached and shared across renders.
 */
export function trimDepth(items: NavItem[], depth: number): NavItem[] {
  return items.map((item) => ({
    ...item,
    children: depth > 1 ? trimDepth(item.children ?? [], depth - 1) : [],
  }));
}

/** How many levels the tree actually has (0 for an empty menu). */
export function treeDepth(items: NavItem[]): number {
  return items.reduce((max, item) => Math.max(max, 1 + treeDepth(item.children ?? [])), 0);
}

/**
 * `aria-current="page"` for the item whose URL is the current page. Trailing slashes
 * are ignored; external URLs, `#` and `mailto:`/`tel:` are never current. A query or
 * hash on the item is ignored too, so `/contact#form` still matches `/contact`.
 */
export function isCurrent(url: string | null | undefined, currentPath: string): boolean {
  if (!url || url.startsWith('#')) return false;
  // Only site-relative paths can be "this page": an absolute URL may be another origin.
  if (!url.startsWith('/') || url.startsWith('//')) return false;
  const path = url;
  const norm = (p: string) => {
    const bare = p.split(/[?#]/)[0] || '/';
    return bare.length > 1 ? bare.replace(/\/+$/, '') : bare;
  };
  return norm(path) === norm(currentPath);
}

/** A branch is current-ish (open the disclosure by default) when a descendant is current. */
export function containsCurrent(item: NavItem, currentPath: string): boolean {
  return (item.children ?? []).some(
    (c) => isCurrent(c.url, currentPath) || containsCurrent(c, currentPath),
  );
}

export interface SiteNavTier {
  kind: 'mobile' | 'default' | 'mega';
  /** Menu name this tier is read from. */
  menu: string;
  items: NavItem[];
  /** The `.sitenav--bp-*` class — where THIS nav promotes from drawer to navbar. */
  breakpoint: NavBreakpoint;
  /** Levels rendered. */
  depth: number;
  /**
   * Wrapper classes that show this tier only inside its container-width window
   * (`sitenav-tier--below-md`, `sitenav-tier--from-xl`). Empty when it is the only tier.
   */
  visibility: string[];
}

export interface SiteNavOptions {
  primary?: NavMenuInput;
  mobile?: NavMenuInput;
  mega?: NavMenuInput;
  /** Where the default nav promotes from drawer to dropdown navbar. Default `md`. */
  breakpoint?: NavBreakpoint;
  /** Where `primary-mobile` hands over to the default nav. Default = `breakpoint`. */
  mobileBreakpoint?: NavBreakpoint;
  /** Where `primary-mega` takes over from the default nav. Default `xl`. */
  megaBreakpoint?: NavBreakpoint;
  /** Levels for the default nav. Default 3 (link, dropdown, fly-out). */
  depth?: number;
  /** Levels for the mega panel. Default 3. */
  megaDepth?: number;
}

/**
 * Decide which navs render. The default menu is always the middle tier; variants are
 * opt-in by simply existing (adding a `primary-mobile` menu in the admin swaps the
 * small-screen nav with no code change). With NO `primary` menu but a variant present,
 * the variant still renders — but alone it is shown at every width rather than
 * leaving a window with no nav.
 *
 * Window arithmetic, with m = mobileBreakpoint and x = megaBreakpoint:
 *   mobile  : below m
 *   default : from m (only if mobile exists) and below x (only if mega exists)
 *   mega    : from x
 * A mega breakpoint at or below the mobile one is a configuration error and throws —
 * the default window would be empty and the page would silently lose its nav.
 */
export function selectTiers(opts: SiteNavOptions): SiteNavTier[] {
  const bp = opts.breakpoint ?? 'md';
  const mbp = opts.mobileBreakpoint ?? bp;
  const xbp = opts.megaBreakpoint ?? 'xl';
  const depth = Math.max(1, opts.depth ?? 3);
  const megaDepth = Math.max(1, opts.megaDepth ?? 3);

  const primary = menuItems(opts.primary);
  const mobile = menuItems(opts.mobile);
  const mega = menuItems(opts.mega);

  const hasMobile = mobile.length > 0;
  const hasMega = mega.length > 0;

  if (hasMobile && hasMega && BREAKPOINT_REM[xbp] <= BREAKPOINT_REM[mbp]) {
    throw new Error(
      `SiteNav: megaBreakpoint "${xbp}" must be wider than mobileBreakpoint "${mbp}" — ` +
        `otherwise the default nav has no width window to render in.`,
    );
  }

  // The default tier falls back to whichever variant exists when `primary` is empty,
  // so a site that only defined `primary-mobile` is never left with no header nav.
  const tiers: SiteNavTier[] = [];

  if (hasMobile) {
    tiers.push({
      kind: 'mobile',
      menu: MENU_NAMES.mobile,
      items: trimDepth(mobile, 1),
      // Never promotes inside its own window, but it must name a breakpoint: the hide
      // point is where the wide flag would flip, so the two can't disagree.
      breakpoint: mbp,
      depth: 1,
      visibility: primary.length || hasMega ? [`below-${mbp}`] : [],
    });
  }

  if (primary.length) {
    const visibility: string[] = [];
    if (hasMobile) visibility.push(`from-${mbp}`);
    if (hasMega) visibility.push(`below-${xbp}`);
    tiers.push({
      kind: 'default',
      menu: MENU_NAMES.primary,
      items: trimDepth(primary, depth),
      breakpoint: hasMobile ? mbp : bp,
      depth,
      visibility,
    });
  }

  if (hasMega) {
    tiers.push({
      kind: 'mega',
      menu: MENU_NAMES.mega,
      items: trimDepth(mega, megaDepth),
      breakpoint: xbp,
      depth: megaDepth,
      // With no default tier the mega menu must cover the narrow widths itself, so it
      // is only windowed when something else renders below it.
      visibility: primary.length || hasMobile ? [`from-${xbp}`] : [],
    });
  }

  // A lone tier is never windowed. (Guards the arithmetic above if branches change.)
  if (tiers.length === 1) tiers[0]!.visibility = [];
  return tiers;
}

/** Every visibility class `selectTiers` can emit — `sitenav.css` must define each. */
export const VISIBILITY_CLASSES: string[] = BREAKPOINT_ORDER.flatMap((b) => [
  `below-${b}`,
  `from-${b}`,
]);

/** Wrapper `class` for one tier. */
export function tierClass(tier: SiteNavTier): string[] {
  return [
    'sitenav-tier',
    `sitenav-tier--${tier.kind}`,
    ...tier.visibility.map((v) => `sitenav-tier--${v}`),
  ];
}

/** Extra classes on the `.sitenav` root for a tier. */
export function navClass(tier: SiteNavTier): string[] {
  return [
    'sitenav',
    `sitenav--bp-${tier.breakpoint}`,
    'sitenav--drawer-end',
    ...(tier.kind === 'mega' ? ['sitenav--mega'] : []),
  ];
}

/** Description text for an item, or undefined. See `NavItem.titleAttr`. */
export function itemDescription(item: NavItem): string | undefined {
  const d = item.titleAttr?.trim();
  return d ? d : undefined;
}

/** A link opening in a new tab must say so to AT and not leak the opener. */
export function linkRel(item: NavItem): string | undefined {
  return item.target === '_blank' ? 'noopener noreferrer' : undefined;
}

/** Unique, stable drawer id per tier — the toggle ↔ panel contract (see NavShell's `id`). */
export function drawerId(base: string, tier: SiteNavTier): string {
  return `${base}-${tier.kind}`;
}
