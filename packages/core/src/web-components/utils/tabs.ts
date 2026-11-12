/**
 * Pure decisions behind `<wc-tabs>`: which ids to give things, and which tab starts selected.
 * The element is the DOM wiring; these are the parts worth asserting without one.
 */

export type TabsOrientation = 'horizontal' | 'vertical';

export const orientationOf = (value: string | null | undefined): TabsOrientation =>
  value === 'vertical' ? 'vertical' : 'horizontal';

/** `Our pricing & plans` → `our-pricing-plans`. Empty when nothing usable is left. */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * One id per panel, keeping any the author wrote (a deep link to `#pricing` must keep working) and
 * deriving the rest from the label, de-duplicated against everything already taken on the page.
 */
export function panelIds(
  sources: ReadonlyArray<{ id?: string; label: string }>,
  taken: ReadonlySet<string>,
  base: string,
): string[] {
  const used = new Set(taken);
  for (const s of sources) if (s.id) used.add(s.id);
  return sources.map((s, i) => {
    if (s.id) return s.id;
    const stem = `${base}-${slugify(s.label) || `panel-${i + 1}`}`;
    let id = stem;
    for (let n = 2; used.has(id); n++) id = `${stem}-${n}`;
    used.add(id);
    return id;
  });
}

/**
 * The tab that starts selected. A URL that points at a panel (or at something inside one) wins,
 * because someone followed a link to it; then the author's `selected`; then the first.
 */
export function initialIndex(opts: {
  /** The panel ids, in order. */
  ids: readonly string[];
  /** The index of the panel the URL fragment points into, if any. */
  fromHash: number | null;
  /** The author's `selected` attribute. */
  selected: number | null | undefined;
}): number {
  const { ids, fromHash, selected } = opts;
  if (ids.length === 0) return 0;
  if (fromHash !== null && fromHash >= 0 && fromHash < ids.length) return fromHash;
  if (typeof selected === 'number' && Number.isInteger(selected)) {
    return Math.min(Math.max(selected, 0), ids.length - 1);
  }
  return 0;
}
