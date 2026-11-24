/**
 * Pure decisions behind `<wc-range>`: how two thumbs are kept from crossing, and where the filled
 * span between them sits. The element is the DOM wiring; these are the parts worth asserting
 * without one.
 */

/** `value` as a 0-100 percentage of `min`..`max`, clamped. A zero-width range is 0. */
export function percent(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

/**
 * The pair after the thumb that was just moved. The lower thumb can't pass the upper one and the
 * upper can't pass the lower: the one being dragged stops against the other, and the other stays
 * where it was. Equal is allowed (a range of zero width is a single value).
 */
export function clampPair(
  moved: 'lower' | 'upper',
  lower: number,
  upper: number,
): [number, number] {
  if (moved === 'lower') return [Math.min(lower, upper), upper];
  return [lower, Math.max(upper, lower)];
}

/** The start and end of the filled span, as percentages. Always in order. */
export function fillStops(
  lower: number,
  upper: number,
  min: number,
  max: number,
): { start: number; end: number } {
  const a = percent(lower, min, max);
  const b = percent(upper, min, max);
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

/** What an `<output>` shows: one value, or `low – high` for a pair. */
export function outputText(values: readonly number[], format: (n: number) => string): string {
  if (values.length === 1) return format(values[0]!);
  return `${format(values[0]!)} – ${format(values[1]!)}`;
}
