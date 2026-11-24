/**
 * URL safety for values that end up in an `href`/`src`.
 *
 * Worker-safe, dependency-free: used by the EmDash blocks, the Astro components that render
 * data from outside the repo (Google reviews), and `nodesToHtml`. It is an allowlist rather
 * than a sanitizer on purpose — nothing here takes HTML, and the only dangerous input is a URL
 * whose scheme runs script when followed.
 */

const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Return `href` only when it is safe to put in an anchor or image, otherwise `undefined`.
 *
 * Editors are semi-trusted, but `javascript:` and `data:` URLs run script on click, so only
 * web/mail/phone schemes and scheme-less (relative, `#`, `?`) values pass. Browsers ignore
 * ASCII whitespace and control characters inside a scheme (`java\tscript:`), so they are
 * stripped before the check rather than trusted to be absent.
 */
export function safeHref(href: unknown): string | undefined {
  if (typeof href !== 'string') return undefined;
  const trimmed = href.trim();
  // eslint-disable-next-line no-control-regex
  const probe = trimmed.replace(/[\u0000- ]/g, '');
  const scheme = /^([a-z][a-z0-9+.-]*:)/i.exec(probe)?.[1]?.toLowerCase();
  if (scheme && !SAFE_SCHEMES.has(scheme)) return undefined;
  return trimmed || undefined;
}
