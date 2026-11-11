/**
 * The pure half of `vitops emdash check-prerender`: is a prerendered `.html` body a real page?
 *
 * `astro build` succeeds even when a prerendered route's response was an error. Against a local
 * database with pending migrations EmDash answers with a one-line "Database migrations are
 * required" body, which is written to `index.html` like any other page, and the deploy then
 * publishes it.
 */
import { hasFormDelivery } from '@getvitops/utils/notify';

export const PENDING_MIGRATIONS = /Database migrations are required/i;

/** Why `html` is not a real page, or `undefined` when it looks like one. */
export function prerenderProblem(html: string): string | undefined {
  if (PENDING_MIGRATIONS.test(html)) return 'carries the pending-migrations message';
  if (!/<html[\s>]/i.test(html)) return 'is not an HTML document';
  if (!/<title>[^<]+<\/title>/i.test(html)) return 'has no <title>';
  const unrendered = unrenderedBlocks(html);
  if (unrendered.length)
    return `dropped block(s) with no renderer: ${unrendered.join(', ')} (see \`PortableText [components.type] is missing\` in the build log)`;
  return undefined;
}

/**
 * `vitops_*` block types a page's nested body dropped. `vitops_section` and widget areas emit a
 * `data-vitops-unrendered="<type>"` marker for each, so a page whose sections rendered as
 * headings over empty bodies fails here instead of passing for a real page. (The build-log check in
 * `vitops emdash build` also catches top-level bodies, which carry no marker.)
 */
export function unrenderedBlocks(html: string): string[] {
  const types = new Set<string>();
  for (const m of html.matchAll(/data-vitops-unrendered\s*=\s*"([^"]+)"/gi)) types.add(m[1]!);
  return [...types].sort();
}

/** The type-role utilities (`font-<role>`) the framework defines; a closed list from its docs. */
const TYPE_ROLES = [
  'display',
  'title',
  'heading',
  'body',
  'quote',
  'caption',
  'eyebrow',
  'code',
  'lead',
  'footnote',
  'tag',
];
const TYPE_ROLE_CLASS = new RegExp(`^font-(?:${TYPE_ROLES.join('|')})$`);

/** Every `class="…"` token in a page. */
function classesIn(html: string): Set<string> {
  const out = new Set<string>();
  for (const m of html.matchAll(/\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')/gi))
    for (const token of (m[1] ?? m[2] ?? '').split(/\s+/)) if (token) out.add(token);
  return out;
}

/**
 * Type-role classes a page uses that the built stylesheet has no rule for.
 *
 * Tailwind v4 does not scan `node_modules`, so a utility used only by a package's own renderer
 * (`font-display` in `vitops_stats`) was never generated, and the page rendered at body size with
 * no error. The type roles are the one family checkable without the site's config: the list is
 * closed. A class is "defined" when the CSS names it as a selector.
 */
export function missingTypeRoleRules(html: string, css: string): string[] {
  const defined = (cls: string) => new RegExp(`\\.${cls}(?![\\w-])`).test(css);
  return [...classesIn(html)].filter((c) => TYPE_ROLE_CLASS.test(c) && !defined(c)).sort();
}

/**
 * Block types EmDash's `<PortableText>` reported as having no component, from a build's output.
 *
 * `astro build` prints `PortableText [components.type] is missing "vitops_cards"` once per
 * occurrence and carries on, rendering nothing for that block. A single missing renderer is a
 * page published with its content gone, and the prerender guard cannot see it in the HTML. The
 * known cause is an import cycle that empties the plugin's block map for a whole build, so the
 * warning arrives dozens of times; it is reported once per type.
 */
export function missingBlockComponents(log: string): string[] {
  // eslint-disable-next-line no-control-regex
  const plain = log.replace(/\u001b\[[0-9;]*m/g, '');
  const seen = new Set<string>();
  for (const m of plain.matchAll(/PortableText \[components\.type\] is missing "([^"]+)"/g))
    seen.add(m[1]!);
  return [...seen].sort();
}

/**
 * How many `<h1>` a page has. A page with none has no title in its outline; a page with two (a
 * hero left on its `h1` default beside a layout title) has a muddled one. Counted outside
 * `<template>`, `<script>` and comments so inert markup does not skew it.
 */
export function h1Count(html: string): number {
  const live = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|template|style)[\s\S]*?<\/\1>/gi, '');
  return (live.match(/<h1[\s>]/gi) ?? []).length;
}

/** The URL path a built `.html` file is served at: `a/index.html` and `a.html` are both `/a`. */
export function routeOf(relativeFile: string): string {
  const path =
    '/' +
    relativeFile
      .replace(/\\/g, '/')
      .replace(/(^|\/)index\.html$/, '$1')
      .replace(/\.html$/, '');
  return path.length > 1 ? path.replace(/\/+$/, '') : '/';
}

/**
 * Site-relative links in a page that point at a route the build did not produce: a planned link
 * (`/pricing` in a menu before the page exists) that would 404. Anchors, query-only links, assets
 * (anything with a file extension), `/_emdash/*` and `/api/*` (Worker routes) are not judged.
 */
export function brokenInternalLinks(html: string, routes: ReadonlySet<string>): string[] {
  const live = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|template|style)[\s\S]*?<\/\1>/gi, '');
  const broken = new Set<string>();
  for (const m of live.matchAll(/<a\s[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const href = (m[1] ?? m[2] ?? '').trim();
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const path = href.split(/[?#]/)[0] || '/';
    if (/\.[a-z0-9]{1,8}$/i.test(path) || path.startsWith('/_') || path.startsWith('/api/'))
      continue;
    const norm = path.length > 1 ? path.replace(/\/+$/, '') : path;
    if (!routes.has(norm)) broken.add(norm);
  }
  return [...broken].sort();
}

/**
 * URLs a sitemap lists that the build did not produce a page for. A collection with no
 * `urlPattern` is listed as `/<collection>/<slug>` while the site serves `/<slug>`, so the
 * sitemap submitted to a search engine would be all dead links. Only same-path `<loc>`s are judged.
 */
export function sitemapOrphans(xml: string, routes: ReadonlySet<string>): string[] {
  const orphans = new Set<string>();
  for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
    let path: string;
    try {
      path = new URL(m[1]!).pathname;
    } catch {
      continue;
    }
    if (/\.[a-z0-9]{1,8}$/i.test(path)) continue; // nested sitemaps, assets
    const norm = path.length > 1 ? path.replace(/\/+$/, '') : path;
    if (!routes.has(norm)) orphans.add(norm);
  }
  return [...orphans].sort();
}

/** Whether a built page carries the `vitops_form` block's post (to the conversion route). */
export function hasConversionForm(html: string): boolean {
  return /<form[^>]*\saction\s*=\s*["']\/api\/track["']/i.test(html);
}

/**
 * Why a site with a form has nowhere to send it, or `undefined` when something is configured.
 * `createConversionRoute` refuses a post with no recipient and no CRM rather than accept a message
 * nobody receives, so the first visitor to submit would be told it failed. A recipient is
 * `site.notifications.email` (a bare address, or `{ to }`) or a location `email`; a CRM also counts.
 */
export function deliveryProblem(config: unknown): string | undefined {
  const c = (config ?? {}) as {
    site?: { notifications?: { email?: unknown }; crm?: unknown };
    organization?: { locations?: Record<string, { email?: unknown }> | Array<{ email?: unknown }> };
  };
  const locations = c.organization?.locations;
  const locationEmails = (Array.isArray(locations) ? locations : Object.values(locations ?? {}))
    .map((l) => l?.email)
    .filter((e): e is string => typeof e === 'string' && e !== '');
  // The same test the route makes (`hasFormDelivery`), so the build and the route cannot disagree.
  return hasFormDelivery(
    { notifications: c.site?.notifications as never, locationEmails },
    c.site?.crm,
  )
    ? undefined
    : 'no recipient: set `site.notifications.email`, or give an organization location an `email`, or configure `site.crm`';
}

const NOT_COLLECTED = new Set([
  '_next',
  'website',
  'honeypot',
  '_honeypot',
  'cf-turnstile-response',
]);

/**
 * The visitor-supplied field names of the form that posts to `/api/track`, from the built HTML:
 * every named control except the hidden ones, the honeypot and the Turnstile token, which are not
 * personal information the visitor gave. Repeated names (a tick-box group) count once.
 */
export function formFieldNames(html: string): string[] {
  const names = new Set<string>();
  for (const form of html.matchAll(
    /<form[^>]*\saction\s*=\s*["']\/api\/track["'][^>]*>([\s\S]*?)<\/form>/gi,
  )) {
    for (const m of form[1]!.matchAll(/<(input|textarea|select)\b([^>]*)>/gi)) {
      const attrs = m[2]!;
      if (/\stype\s*=\s*["']hidden["']/i.test(attrs)) continue;
      const name = /\sname\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
      if (name && !NOT_COLLECTED.has(name)) names.add(name);
    }
  }
  return [...names].sort();
}

/**
 * Form fields that are on a built page but not in any `site.templates` form entry. `vitops legal`
 * derives "what personal information we collect" from those entries, not from the editor's block,
 * so a field added in the admin is invisible to the generated privacy policy until mirrored.
 */
export function uninventoriedFields(config: unknown, built: string[]): string[] {
  const templates = (
    config as {
      site?: { templates?: Record<string, { type?: string; fields?: { name?: string }[] }> };
    }
  )?.site?.templates;
  const known = new Set<string>();
  for (const tpl of Object.values(templates ?? {}))
    if (tpl?.type === 'form') for (const f of tpl.fields ?? []) if (f?.name) known.add(f.name);
  return built.filter((name) => !known.has(name));
}
