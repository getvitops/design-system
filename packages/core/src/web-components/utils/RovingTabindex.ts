import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  linearKeyToMove,
  matchTypeahead,
  stepIndex,
  typeahead,
  type TypeaheadState,
} from './keynav.js';

export type RovingCause = 'key' | 'pointer' | 'api' | 'sync';

export type RovingMove<T> =
  | { type: 'to'; item: T }
  | { type: 'step'; delta: number }
  | { type: 'first' }
  | { type: 'last' }
  /** The caller already performed a side effect (e.g. expand/collapse a tree
   * branch) and wants the keypress consumed (`preventDefault`) without moving
   * focus. */
  | { type: 'handled' };

export interface RovingContext<T extends HTMLElement> {
  /** Every known item, not pre-filtered to focusable ones. */
  readonly items: readonly T[];
  readonly active: T | null;
  readonly index: number;
  /** Computed direction of the attached container, read fresh per keydown. */
  readonly rtl: boolean;
}

export interface RovingTabindexOptions<T extends HTMLElement = HTMLElement> {
  /** Re-resolved on every keydown and every `sync()` call — never cached, since
   * the item set can change between interactions (a filter keystroke, a
   * collapse). */
  items: () => readonly T[];
  /** Default: not `hidden` and no `[hidden]` ancestor — attribute-based, so it
   * works with no layout (`happy-dom` has none) and covers both a plain boolean
   * `hidden` and an expansion `hidden="until-found"` the same way. */
  isFocusable?: (item: T) => boolean;
  /** Full override of key decoding. Omit to use the built-in linear decoder
   * (`orientation`/`loop`) — that's the carousel/gallery shape; a tree supplies
   * its own to get expand/collapse semantics out of Left/Right. */
  keyToMove?: (event: KeyboardEvent, ctx: RovingContext<T>) => RovingMove<T> | null;
  /** Built-in decoder only. */
  orientation?: 'horizontal' | 'vertical' | 'both';
  /** Built-in decoder only. Wrap (carousel) vs clamp (tree/no default given). */
  loop?: boolean;
  /** Fired after focus lands on a new active item. `<wc-carousel>` calls
   * `item.click()` here — selection follows focus; `<wc-tree>` scrolls the row
   * into view. Not fired for a `'handled'` move, since active didn't change. */
  onMove?: (item: T, previous: T | null, cause: RovingCause) => void;
  /** Type-ahead haystack. Omit to disable type-ahead entirely. */
  textFor?: (item: T) => string;
  /** Keydowns whose target matches this selector are ignored entirely — the
   * escape hatch for interactive row children (`.tree__actions` buttons) so
   * Space on one of them activates the button instead of also toggling the
   * row underneath it. */
  ignoreWithin?: string;
}

const DEFAULT_IS_FOCUSABLE = (item: HTMLElement): boolean =>
  !item.hidden && !item.closest('[hidden]');

/**
 * Roving-tabindex bookkeeping shared by every keyboard-navigable group in the
 * framework — modelled on `DragController.ts`, the established precedent for
 * "shared interactive behaviour as a Lit `ReactiveController`, exported from
 * `index.ts`". Decides nothing about *which* key means what; that comes from
 * `keynav.ts` (the built-in linear decoder) or a caller-supplied `keyToMove`
 * (`tree-nav.ts`, for `<wc-tree>`).
 *
 * **Never resolves its container in `hostConnected` or `hostUpdated`.** A
 * light-DOM element upgraded mid-insertion is connected before its children
 * exist (`utils/upgrade.ts`), and `hostUpdated` looks like the fix but isn't:
 * Lit resolves the host's one-and-only update microtask *before*
 * `initFromLightDom`'s retry microtask runs, and a light-DOM host whose
 * `render()` returns `noChange` never gets a second update to save it —
 * `hostUpdated` would fire exactly once, permanently too early, for the
 * component's whole lifetime. `DragController` only gets away with
 * `hostUpdated` because its host has a shadow `renderRoot` that `render()`
 * actually populates. So the container is resolved by an explicit `attach()`
 * call, made by the host from inside its own setup routine, once that routine
 * has confirmed the markup it needs actually exists.
 *
 * No `RovingTabindexHost`/`renderRoot` in the interface — that would re-import
 * the same timing bug `DragControllerHost` exists to work around. Any
 * `ReactiveControllerHost` will do.
 */
export class RovingTabindex<T extends HTMLElement = HTMLElement> implements ReactiveController {
  #options: RovingTabindexOptions<T>;
  #container: HTMLElement | null = null;
  #active: T | null = null;
  #typeahead: TypeaheadState | null = null;

  constructor(host: ReactiveControllerHost, options: RovingTabindexOptions<T>) {
    this.#options = options;
    host.addController(this);
  }

  get active(): T | null {
    return this.#active;
  }

  #isFocusable = (item: T): boolean => (this.#options.isFocusable ?? DEFAULT_IS_FOCUSABLE)(item);

  /** Idempotent. Binds listeners and applies the initial tabindex. */
  attach(container: HTMLElement): void {
    if (this.#container === container) return;
    this.detach();
    this.#container = container;
    container.addEventListener('keydown', this.#onKeyDown);
    container.addEventListener('focusin', this.#onFocusIn);
    this.sync();
  }

  detach(): void {
    if (!this.#container) return;
    this.#container.removeEventListener('keydown', this.#onKeyDown);
    this.#container.removeEventListener('focusin', this.#onFocusIn);
    this.#container = null;
  }

  /**
   * Re-apply the one-tabindex-0 invariant over the current item set. Call
   * after anything that can change which items exist or which are focusable —
   * a filter pass, an expand/collapse.
   *
   * If the previously active item held real DOM focus and just became
   * unfocusable (hidden by a filter, or collapsed away), focus is moved to the
   * new active item rather than left to fall back to `<body>`.
   */
  sync(): void {
    const all = this.#options.items();
    const focusable = all.filter(this.#isFocusable);
    const previousActive = this.#active;
    const hadDomFocus = previousActive !== null && document.activeElement === previousActive;
    const stillFocusable = previousActive !== null && focusable.includes(previousActive);
    const active = stillFocusable ? previousActive : (focusable[0] ?? null);

    for (const item of all) item.tabIndex = item === active ? 0 : -1;
    this.#active = active;

    if (hadDomFocus && !stillFocusable && active) {
      active.focus({ preventScroll: true });
      this.#options.onMove?.(active, previousActive, 'sync');
    }
  }

  /** Move the roving item; `focus: false` is the pointer/click path, which only
   * needs the tabindex to follow — DOM focus already landed there natively.
   * `silent: true` skips `onMove` — for a caller that is itself reacting to
   * the thing `onMove` would trigger (e.g. `<wc-carousel>` syncing the active
   * dot from a scroll event; calling `onMove`'s `item.click()` there would
   * re-trigger the very scroll being synced from). */
  setActive(
    item: T | null,
    opts: { focus?: boolean; cause?: RovingCause; silent?: boolean } = {},
  ): void {
    const { focus = true, cause = 'api', silent = false } = opts;
    const previous = this.#active;
    this.#active = item;
    for (const el of this.#options.items()) el.tabIndex = el === item ? 0 : -1;
    if (item) {
      if (focus) item.focus({ preventScroll: true });
      if (!silent) this.#options.onMove?.(item, previous, cause);
    }
  }

  #onFocusIn = (event: FocusEvent): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target === this.#active) return;
    if (!this.#options.items().includes(target as T)) return;
    this.setActive(target as T, { focus: false, cause: 'pointer' });
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    const { ignoreWithin, textFor } = this.#options;
    const target = event.target;
    if (ignoreWithin && target instanceof Element && target.closest(ignoreWithin)) return;

    // Space is excluded even though it's a length-1 key: every WAI-ARIA
    // pattern this controller serves (tree, and eventually listbox/menu)
    // reserves it for activation, never type-ahead — `<wc-tree>`'s own
    // `keyToMove` handles it.
    if (
      textFor &&
      event.key.length === 1 &&
      event.key !== ' ' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      this.#onTypeahead(event, textFor);
      return;
    }

    const container = this.#container;
    if (!container) return;
    const items = this.#options.items();
    const ctx: RovingContext<T> = {
      items,
      active: this.#active,
      index: this.#active ? items.indexOf(this.#active) : -1,
      rtl: getComputedStyle(container).direction === 'rtl',
    };

    const move = this.#options.keyToMove
      ? this.#options.keyToMove(event, ctx)
      : this.#builtinKeyToMove(event, ctx);
    if (!move) return;

    event.preventDefault();
    this.#applyMove(move, ctx);
  };

  #onTypeahead = (event: KeyboardEvent, textFor: (item: T) => string): void => {
    this.#typeahead = typeahead(this.#typeahead, event.key, performance.now());
    const focusable = this.#options.items().filter(this.#isFocusable);
    const candidates = focusable.map((item) => ({ key: item, text: textFor(item) }));
    const match = matchTypeahead(candidates, this.#typeahead.query, this.#active);
    if (match) {
      event.preventDefault();
      this.setActive(match as T, { focus: true, cause: 'key' });
    }
  };

  #builtinKeyToMove = (event: KeyboardEvent, ctx: RovingContext<T>): RovingMove<T> | null => {
    const { orientation } = this.#options;
    if (!orientation) return null;
    return linearKeyToMove(event.key, { orientation, rtl: ctx.rtl });
  };

  #applyMove(move: RovingMove<T>, ctx: RovingContext<T>): void {
    if (move.type === 'handled') return;
    const items = ctx.items.filter(this.#isFocusable);
    if (!items.length) return;

    if (move.type === 'to') {
      this.setActive(move.item, { focus: true, cause: 'key' });
      return;
    }
    if (move.type === 'first') {
      this.setActive(items[0]!, { focus: true, cause: 'key' });
      return;
    }
    if (move.type === 'last') {
      this.setActive(items[items.length - 1]!, { focus: true, cause: 'key' });
      return;
    }
    // 'step'
    const current = ctx.active ? items.indexOf(ctx.active) : -1;
    const nextIndex = stepIndex({
      index: current < 0 ? 0 : current,
      total: items.length,
      delta: move.delta,
      loop: this.#options.loop ?? false,
    });
    this.setActive(items[nextIndex]!, { focus: true, cause: 'key' });
  }

  hostConnected(): void {
    // No-op — see the class docblock for why the container is never resolved here.
  }

  hostDisconnected(): void {
    this.detach();
  }
}
