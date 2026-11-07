/**
 * The pure half of `vitops emdash check-prerender`: is a prerendered `.html` body a real page?
 *
 * `astro build` succeeds even when a prerendered route's response was an error. Against a local
 * database with pending migrations EmDash answers with a one-line "Database migrations are
 * required" body, which is written to `index.html` like any other page, and the deploy then
 * publishes it.
 */
export const PENDING_MIGRATIONS = /Database migrations are required/i;

/** Why `html` is not a real page, or `undefined` when it looks like one. */
export function prerenderProblem(html: string): string | undefined {
  if (PENDING_MIGRATIONS.test(html)) return 'carries the pending-migrations message';
  if (!/<html[\s>]/i.test(html)) return 'is not an HTML document';
  if (!/<title>[^<]+<\/title>/i.test(html)) return 'has no <title>';
  return undefined;
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
 * (`font-display` in `vitops.stats`) was never generated, and the page rendered at body size with
 * no error. The type roles are the one family checkable without the site's config: the list is
 * closed. A class is "defined" when the CSS names it as a selector.
 */
export function missingTypeRoleRules(html: string, css: string): string[] {
  const defined = (cls: string) => new RegExp(`\\.${cls}(?![\\w-])`).test(css);
  return [...classesIn(html)].filter((c) => TYPE_ROLE_CLASS.test(c) && !defined(c)).sort();
}
