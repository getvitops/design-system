/**
 * Generic keyboard-navigation decisions shared by every roving-tabindex widget —
 * carousel dot nav today, tree/dropdown/tabs/combobox as they land. Same split as
 * `tree-filter.ts` against `WCTree`: everything decidable about "what does this
 * keypress mean" lives here as pure functions over plain data, tested with no DOM.
 */

/** Move `index` by `delta`, wrapping or clamping at the ends. */
export function stepIndex(opts: {
  index: number;
  total: number;
  delta: number;
  loop: boolean;
}): number {
  const { index, total, delta, loop } = opts;
  if (total <= 0) return index;
  const next = index + delta;
  if (loop) return ((next % total) + total) % total;
  return Math.min(Math.max(next, 0), total - 1);
}

export interface LinearKeyOptions {
  orientation: 'horizontal' | 'vertical' | 'both';
  /** Flips ArrowLeft/ArrowRight. Never flips ArrowUp/ArrowDown — direction is a
   * horizontal-axis property, so a vertical arrow means the same thing either way. */
  rtl?: boolean;
}

export type LinearMove = { type: 'step'; delta: number } | { type: 'first' } | { type: 'last' };

/** What a linear (non-tree) roving group does with `key`, or `null` if nothing. */
export function linearKeyToMove(key: string, options: LinearKeyOptions): LinearMove | null {
  const { orientation, rtl = false } = options;
  const horizontal = orientation === 'horizontal' || orientation === 'both';
  const vertical = orientation === 'vertical' || orientation === 'both';

  if (horizontal) {
    if (key === 'ArrowLeft') return { type: 'step', delta: rtl ? 1 : -1 };
    if (key === 'ArrowRight') return { type: 'step', delta: rtl ? -1 : 1 };
  }
  if (vertical) {
    if (key === 'ArrowUp') return { type: 'step', delta: -1 };
    if (key === 'ArrowDown') return { type: 'step', delta: 1 };
  }
  if (key === 'Home') return { type: 'first' };
  if (key === 'End') return { type: 'last' };
  return null;
}

/** Default gap (ms) after which a new keypress starts a fresh type-ahead search. */
export const TYPEAHEAD_TIMEOUT = 1000;

export interface TypeaheadState {
  /** Raw accumulated keys, used only to detect a same-character repeat. */
  buffer: string;
  /** The effective search string — collapses a same-character repeat to one char,
   * so "aaa" cycles through every "a…" item instead of searching for the literal
   * string "aaa". */
  query: string;
  lastTime: number;
}

/**
 * Fold one more typed character into the running search state. `now` is always
 * caller-supplied (never `Date.now()` internally), so this stays pure and testable.
 */
export function typeahead(
  prev: TypeaheadState | null,
  char: string,
  now: number,
  timeoutMs: number = TYPEAHEAD_TIMEOUT,
): TypeaheadState {
  const fresh = !prev || now - prev.lastTime > timeoutMs;
  const buffer = fresh ? char : prev!.buffer + char;
  const isRepeat = buffer.length > 1 && Array.from(buffer).every((c) => c === buffer[0]);
  return { buffer, query: isRepeat ? buffer[0]! : buffer, lastTime: now };
}

export interface TypeaheadCandidate {
  key: unknown;
  text: string;
}

/**
 * Which candidate `state.query` selects, WAI-ARIA style: search starts just AFTER
 * `activeKey`, wraps around, and checks `activeKey` itself last — so a lone match
 * that is already active stays put, and a repeated character cycles forward
 * through every match rather than getting stuck on the first.
 *
 * `isHidden` lets the caller skip filtered-out or collapsed-away candidates
 * without removing them from the list (which would shift indices under the
 * caller's feet).
 */
export function matchTypeahead(
  candidates: readonly TypeaheadCandidate[],
  query: string,
  activeKey: unknown,
  isHidden?: (key: unknown) => boolean,
): unknown {
  const q = query.toLowerCase();
  if (!q) return null;
  const n = candidates.length;
  if (!n) return null;
  const startIndex = Math.max(
    0,
    candidates.findIndex((c) => c.key === activeKey),
  );
  for (let i = 1; i <= n; i++) {
    const candidate = candidates[(startIndex + i) % n]!;
    if (isHidden?.(candidate.key)) continue;
    if (candidate.text.toLowerCase().startsWith(q)) return candidate.key;
  }
  return null;
}
