/**
 * What `<wc-multifield>` and `<wc-config-form>` both do to an entry: take a copy of a used one and
 * make it a fresh one. Over plain DOM nodes, so each element's own wiring stays small, and shared so
 * the two cannot disagree about what a blank entry is.
 */
import { parseKeyName, renumber } from './config-form.js';

/** `<wc-field>` writes these ids on the original; a copy must not repeat them. */
const GENERATED_ID = /^wc-field-\d+-(?:help|error)$/;

/** The map and index a row belongs to, read from its key control (`…$map.N.$key`). */
export function rowIdentity(row: Element): { base: string; index: number } | undefined {
  const key = row.querySelector<HTMLInputElement | HTMLSelectElement>(
    'input[name$="$key"], select[name$="$key"]',
  );
  return key ? parseKeyName(key.name) : undefined;
}

/** Index to give the next row: one past the highest in use, counting every row passed. */
export function nextIndex(rows: Iterable<Element>): number {
  let highest = -1;
  for (const row of rows) highest = Math.max(highest, rowIdentity(row)?.index ?? -1);
  return highest + 1;
}

/**
 * Turn `row` (a copy of a used or blank row of a keyed map) into an empty one at index `to`: names
 * and ids move from `from` to `to`, and the copy is cleaned as `cleanCopy` describes.
 */
export function scrubRow(row: HTMLElement, base: string, from: number, to: number): void {
  cleanCopy(row, (value, attribute) =>
    renumber(value, base, from, to, attribute === 'name' ? 'name' : 'id'),
  );
}

/**
 * Turn `entry` (a copy of a used entry of a plain repeated field) into an empty one: every id, `for`
 * and `aria-describedby` token gets `-<serial>` so the copy's label still finds its control and no
 * id repeats. Names are left alone: repeated names are how a list of values is submitted.
 */
export function freshEntry(entry: HTMLElement, serial: number): void {
  cleanCopy(entry, (value, attribute) =>
    attribute === 'name'
      ? value
      : value
          .split(/\s+/)
          .filter(Boolean)
          .map((token) => `${token}-${serial}`)
          .join(' '),
  );
}

/**
 * Empty a copied entry: values and states cleared, and what `<wc-field>` added to the original
 * dropped so the copy's own element adds its own. `rename` rewrites a name, id, `for` or
 * `aria-describedby` value.
 */
function cleanCopy(
  row: HTMLElement,
  rename: (value: string, attribute: 'name' | 'id' | 'for' | 'aria-describedby') => string,
): void {
  row.querySelectorAll('.field__counter').forEach((node) => node.remove());
  row
    .querySelectorAll('.field--enhanced')
    .forEach((node) => node.classList.remove('field--enhanced'));
  row.querySelectorAll('[data-invalid]').forEach((node) => node.removeAttribute('data-invalid'));
  row.querySelectorAll('.field__error').forEach((node) => (node.textContent = ''));

  // Drop generated ids, and any `aria-describedby` token naming one.
  for (const node of Array.from(row.querySelectorAll<HTMLElement>('[id], [aria-describedby]'))) {
    if (GENERATED_ID.test(node.id)) node.removeAttribute('id');
    const described = node.getAttribute('aria-describedby');
    if (described !== null) {
      const kept = described.split(/\s+/).filter((token) => token && !GENERATED_ID.test(token));
      if (kept.length) node.setAttribute('aria-describedby', kept.join(' '));
      else node.removeAttribute('aria-describedby');
    }
  }

  for (const node of Array.from(row.querySelectorAll<HTMLElement>('*'))) {
    for (const attribute of ['name', 'id', 'for', 'aria-describedby'] as const) {
      const current = node.getAttribute(attribute);
      if (current === null) continue;
      node.setAttribute(attribute, rename(current, attribute));
    }
    node.removeAttribute('aria-invalid');
    if (node instanceof HTMLInputElement) {
      // A hidden input is a fixed part of the row (a locale code, a switch's "false").
      if (node.type === 'checkbox' || node.type === 'radio') node.checked = false;
      else if (node.type !== 'hidden') node.value = '';
      // `value=""` as an attribute too, or a cloned default would come back on reset.
      if (node.type !== 'hidden' && node.type !== 'checkbox' && node.type !== 'radio') {
        node.setAttribute('value', '');
      }
    } else if (node instanceof HTMLTextAreaElement) {
      node.value = '';
      node.textContent = '';
    } else if (node instanceof HTMLSelectElement) {
      node.selectedIndex = 0;
      for (const option of Array.from(node.options)) option.removeAttribute('selected');
    }
  }
}
