/**
 * The decisions `<wc-field>` makes, as functions over plain values, so they are tested without a
 * DOM (the element's own wiring is in `WCField.dom.test.ts`).
 */

/**
 * `aria-describedby` after adding and removing ids, keeping any the author wrote.
 *
 * Returns `null` when nothing is left, so the caller removes the attribute instead of writing an
 * empty one. Order is stable (existing first, then additions) and an id is never listed twice.
 */
export function mergeDescribedBy(
  existing: string | null,
  add: readonly string[],
  remove: readonly string[] = [],
): string | null {
  const gone = new Set(remove);
  const out: string[] = [];
  for (const token of [...(existing ?? '').split(/\s+/), ...add]) {
    if (token && !gone.has(token) && !out.includes(token)) out.push(token);
  }
  return out.length ? out.join(' ') : null;
}

/** `12 / 80`, or `null` when the control states no limit. */
export function counterText(length: number, max: number | null): string | null {
  return max !== null && max > 0 ? `${length} / ${max}` : null;
}

/** The state `messageFor` reads. */
export interface FieldState {
  /** A message a host set with `setError()`; it outranks the browser's own. */
  custom: string;
  /** The browser's validation message for the control, empty when it is valid. */
  native: string;
  /** Has the visitor left the control or changed it? Never nag before that. */
  touched: boolean;
  /** Has a submit attempt reported this control invalid (the `invalid` event)? */
  reported: boolean;
}

/**
 * The text to show under a field, or `''`.
 *
 * A host's message shows straight away, because the host decided the value is wrong. The browser's
 * own message waits until the visitor has touched the control or a submit has reported it, which is
 * what `:user-invalid` does: an empty required field is not an error while someone is still reading
 * the form.
 */
export function messageFor(state: FieldState): string {
  if (state.custom) return state.custom;
  if (!state.native) return '';
  return state.touched || state.reported ? state.native : '';
}

/** The value a control would submit, for `field-change`. A checkbox reports whether it is on. */
export function controlValue(control: {
  type?: string;
  value: string;
  checked?: boolean;
}): string | boolean {
  if (control.type === 'checkbox') return control.checked === true;
  return control.value;
}
