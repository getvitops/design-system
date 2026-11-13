/**
 * The decisions `<wc-stepper>` makes, as functions over plain values, so they are tested without a
 * DOM (the element's own wiring is in `WCStepper.dom.test.ts`).
 */

/** The index of the step whose id is the URL fragment, or `-1`. A leading `#` is accepted. */
export function stepFromHash(ids: readonly string[], hash: string): number {
  const id = hash.replace(/^#/, '');
  if (!id) return -1;
  let decoded = id;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    // A malformed escape is not a step.
  }
  return ids.indexOf(decoded);
}

/** Clamp a move of `by` steps from `from` into `[0, count - 1]`. */
export function moveBy(from: number, by: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, from + by));
}

/**
 * Where a move from `current` to `target` actually lands. Going back is always allowed. Going
 * forward must pass every step in between, so the move stops at the first one that is not valid:
 * jumping from step 1 to step 4 through the nav cannot skip a required field on step 2.
 *
 * `valid[i]` says whether step `i` is currently valid.
 */
export function resolveTarget(current: number, target: number, valid: readonly boolean[]): number {
  if (target <= current) return target;
  for (let i = current; i < target; i++) {
    if (valid[i] === false) return i;
  }
  return target;
}

/** Which classes a nav item carries: the current one, and the ones passed and their state. */
export function itemState(
  index: number,
  current: number,
  visited: ReadonlySet<number>,
  valid: readonly boolean[],
): 'current' | 'complete' | 'invalid' | 'upcoming' {
  if (index === current) return 'current';
  if (!visited.has(index)) return 'upcoming';
  return valid[index] === false ? 'invalid' : 'complete';
}
