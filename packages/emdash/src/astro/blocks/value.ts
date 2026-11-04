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

// Shared with the Astro components and `nodesToHtml`; re-exported so blocks import one place.
export { safeHref } from '@getvitops/utils/url';

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
