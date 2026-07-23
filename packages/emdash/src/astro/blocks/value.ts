/**
 * Normalize the props EmDash passes to a Portable Text block component.
 *
 * Verified against emdash 0.31: <PortableText> delegates to astro-portabletext,
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

/** Split a newline/comma-separated editor field into trimmed non-empty items. */
export function splitLines(input: unknown): string[] {
  if (typeof input !== 'string') return [];
  return input
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
