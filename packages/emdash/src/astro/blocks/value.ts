/**
 * Normalize the props EmDash passes to a Portable Text block component.
 *
 * Verified against emdash 1.4: <PortableText> still delegates to astro-portabletext,
 * which passes the block object as `props.node` (fields flat on the block next
 * to _type/_key). The `value` and spread branches are kept as tolerance for the
 * shapes shown elsewhere in the EmDash docs, so a host-side change is a
 * one-line fix here rather than a change in every block component.
 */
export function resolveBlockValue<T extends Record<string, unknown>>(
  props: Record<string, unknown>,
): T {
  const candidate = props.value ?? props.node ?? props;
  return candidate as T;
}

const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Return `href` only when it is safe to put in an anchor, otherwise `undefined`.
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

/** Split a newline/comma-separated editor field into trimmed non-empty items. */
export function splitLines(input: unknown): string[] {
  if (typeof input !== 'string') return [];
  return input
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** A repeater field's saved value: an array of row objects. Anything else is no rows. */
export function rows<T extends Record<string, unknown> = Record<string, unknown>>(
  input: unknown,
): T[] {
  return Array.isArray(input)
    ? (input.filter((row) => row && typeof row === 'object' && !Array.isArray(row)) as T[])
    : [];
}

/** A trimmed string field, or `''` when the value is absent or not a string. */
export function text(input: unknown): string {
  return typeof input === 'string' ? input.trim() : '';
}

/** Split a multiline editor field into paragraphs on blank lines. */
export function paragraphs(input: unknown): string[] {
  return text(input)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
