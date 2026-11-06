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
