/**
 * Breadcrumb trail model — pure, so the two things a trail must get right are asserted without
 * rendering a component: which item is the current page, and what the JSON-LD says.
 */

export interface Crumb {
  label: string;
  /** Where the item links. Optional: an ancestor that has no page of its own renders as text. */
  href?: string;
}

export interface ResolvedCrumb {
  label: string;
  /** Absent on the current page and on any ancestor with no page. */
  href?: string;
  current: boolean;
}

/**
 * The last item is the current page whether or not it was given an `href`: a trail whose final
 * item links to itself invites a click that goes nowhere and reads as a link to a screen reader.
 */
export function resolveCrumbs(items: readonly Crumb[]): ResolvedCrumb[] {
  const last = items.length - 1;
  return items.map((item, i) => {
    const current = i === last;
    return {
      label: item.label,
      ...(!current && item.href ? { href: item.href } : {}),
      current,
    };
  });
}

/**
 * `BreadcrumbList` items for the same trail, with absolute URLs resolved against `page`.
 *
 * An ancestor with no `href` is not a page, so it has no `item` URL to give and is left out;
 * schema.org's list is of pages. The final item takes its own `href` if given, else the page's.
 */
export function schemaCrumbs(
  items: readonly Crumb[],
  page: URL,
): Array<{ name: string; url: string }> {
  const last = items.length - 1;
  const out: Array<{ name: string; url: string }> = [];
  items.forEach((item, i) => {
    if (i === last) out.push({ name: item.label, url: new URL(item.href ?? page.href, page).href });
    else if (item.href) out.push({ name: item.label, url: new URL(item.href, page).href });
  });
  return out;
}
