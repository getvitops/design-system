/**
 * Pure decisions behind `<wc-combobox>`: which options match what was typed, how the active option
 * moves, what a screen reader is told. The element is the DOM wiring; these are the parts worth
 * asserting without one.
 */

export interface ComboOption {
  /** What goes in the input when chosen — the `<option value>`. */
  value: string;
  /** What is shown for it. Defaults to the value. */
  label: string;
}

/** Case- and accent-insensitive, so `cafe` finds `Café`. */
export const normalize = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * The options matching `query`: those that START with it first, then those that merely contain it,
 * each group keeping the author's order. An empty query is every option. Matches the label or the
 * value, since either is what someone might type.
 */
export function filterOptions(options: readonly ComboOption[], query: string): ComboOption[] {
  const q = normalize(query);
  if (!q) return [...options];
  const starts: ComboOption[] = [];
  const contains: ComboOption[] = [];
  for (const option of options) {
    const label = normalize(option.label);
    const value = normalize(option.value);
    if (label.startsWith(q) || value.startsWith(q)) starts.push(option);
    else if (label.includes(q) || value.includes(q)) contains.push(option);
  }
  return [...starts, ...contains];
}

/**
 * Where the active option goes after an arrow key. `-1` is "none active" (the input itself has
 * focus): Down from there goes to the first, Up to the last. Wraps at both ends, as the APG
 * combobox does, so the list never dead-ends.
 */
export function moveActive(current: number, delta: 1 | -1, count: number): number {
  if (count <= 0) return -1;
  if (current < 0) return delta === 1 ? 0 : count - 1;
  return (current + delta + count) % count;
}

/** The polite live-region text: how many options match, so a screen reader hears the narrowing. */
export function statusText(count: number, query: string, emptyText: string): string {
  if (count === 0) return emptyText;
  const noun = count === 1 ? 'result' : 'results';
  return query.trim() ? `${count} ${noun} available` : `${count} ${noun}`;
}

/** The option whose value or label equals `text` exactly (after normalising), for a typed-in match. */
export function exactMatch(options: readonly ComboOption[], text: string): ComboOption | undefined {
  const q = normalize(text);
  if (!q) return undefined;
  return options.find((o) => normalize(o.value) === q || normalize(o.label) === q);
}
