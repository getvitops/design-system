import { noChange } from 'lit';
import { BaseElement } from './BaseElement.js';
import {
  keyToAction,
  preloadTargets,
  stepIndex,
  swipeAction,
  type SwipeAction,
} from './utils/gallery.js';
import { slideLabel } from './utils/carousel.js';
import { initFromLightDom } from './utils/upgrade.js';

/** How far a completed drag must travel before it counts as a swipe, in CSS pixels. */
const SWIPE_THRESHOLD = 40;

/** One `.gallery__trigger` + the `.lightbox-dialog` it opens, plus what this element built. */
interface GalleryItem {
  trigger: HTMLElement;
  dialog: HTMLDialogElement;
  index: number;
  /** The generated nav wrappers, so they can be removed on teardown. */
  nav?: HTMLElement[];
  /** `dialog`'s authored `aria-label`, restored on teardown. `null` if it had none. */
  originalLabel: string | null;
}

/**
 * Augments a `.gallery` grid of `command="show-modal"` triggers and their
 * `.lightbox-dialog`s (patterns/gallery.css, patterns/lightbox.css) with prev/next,
 * arrow keys, swipe, an image counter, neighbour preload and a thumbnail→full-image
 * view-transition morph.
 *
 * **The fallback is the point.** With no JS, each `.gallery__trigger` is a real
 * `command="show-modal" commandfor="…"` invoker for its own `<dialog>` — a fully
 * working modal lightbox with zero JavaScript. Open and close both work; only
 * navigating between images requires this element, because it cannot exist in the
 * fallback at all: a `command="show-modal"` button inside an already-open dialog
 * opens a *second* modal on top of the first, stacking the top layer rather than
 * replacing what's shown. So prev/next is generated here, never authored — the
 * same rule `WCTree` states for its search field: a control that does nothing is
 * worse than no control.
 *
 * **The N authored dialogs are kept, not collapsed into one shared dialog.** That
 * is simpler, it cannot destroy the fallback if setup only half succeeds, and it
 * costs nothing: an image inside a closed `<dialog>` is `display: none`, so
 * `loading="lazy"` never fetches it until that dialog opens.
 *
 * **Stepping needs no manual focus bookkeeping.** `showModal()` records whatever
 * has focus at the moment it is called as the element to restore on `close()`, and
 * that restoration is synchronous. Closing the current dialog before opening the
 * next therefore always relays focus back through the chain to the trigger that
 * started it, however many images were visited in between — no tracking required.
 *
 * @example
 * ```html
 * <wc-gallery>
 *   <ul class="gallery" role="list">
 *     <li class="gallery__item">
 *       <button class="gallery__trigger" type="button"
 *               command="show-modal" commandfor="img-1">
 *         <img class="gallery__thumb" src="…" alt="" />
 *       </button>
 *     </li>
 *   </ul>
 *   <dialog id="img-1" class="lightbox-dialog" closedby="any" aria-label="…">
 *     <div class="lightbox-dialog__content">
 *       <img class="lightbox-dialog__image" src="…" />
 *     </div>
 *     <button class="lightbox-dialog__close" type="button"
 *             command="close" commandfor="img-1" aria-label="Close">&times;</button>
 *   </dialog>
 * </wc-gallery>
 * ```
 */
export class WCGallery extends BaseElement {
  static properties = {
    /** Wrap prev/next past the ends instead of stopping there. */
    loop: { type: Boolean, reflect: true },
  };

  /** Light DOM — the framework's `.gallery` / `.lightbox-dialog` CSS must style the slotted markup. */
  override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Never let lit-html touch the slotted markup. */
  protected override render(): typeof noChange {
    return noChange;
  }

  declare loop: boolean;

  #ready = false;
  #items: GalleryItem[] = [];
  #currentIndex: number | null = null;
  #reducedMotion = false;
  #dragStart: { x: number; y: number } | null = null;

  constructor() {
    super();
    this.loop = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // The triggers/dialogs may not be parsed yet — see initFromLightDom.
    initFromLightDom(this, () => this.#setup());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const item of this.#items) {
      item.dialog.removeEventListener('command', this.#onCommand);
      item.dialog.removeEventListener('keydown', this.#onKeydown);
      item.dialog.removeEventListener('close', this.#onDialogClose);
      item.dialog.removeEventListener('pointerdown', this.#onPointerDown);
      item.dialog.removeEventListener('pointerup', this.#onPointerUp);
      for (const nav of item.nav ?? []) nav.remove();
      if (item.originalLabel === null) item.dialog.removeAttribute('aria-label');
      else item.dialog.setAttribute('aria-label', item.originalLabel);
    }
    this.#items = [];
    this.#currentIndex = null;
    this.#ready = false;
  }

  #setup(): boolean {
    // Defer entirely to an enclosing <wc-gallery>. `<Gallery />` emits its own
    // tag, so a consumer who reasonably guesses `<wc-gallery><Gallery /></wc-gallery>`
    // nests two. `parentElement` rather than `this`, since `this.closest()`
    // matches self. Same trap WCCards and WCCarousel close.
    if (this.parentElement?.closest('wc-gallery')) return true;
    if (this.#ready) return true;

    const triggers = [...this.querySelectorAll<HTMLElement>('.gallery__trigger[commandfor]')];
    // Fewer than one is the retry hook: mid-insertion the element can be
    // connected with an empty or partial subtree.
    if (!triggers.length) return false;

    // Attribute fallback for upgrade timing — the Lit property may not have landed.
    if (!this.loop && this.hasAttribute('loop')) this.loop = true;

    const items: GalleryItem[] = [];
    for (const trigger of triggers) {
      const id = trigger.getAttribute('commandfor');
      const dialog = id ? this.querySelector<HTMLDialogElement>(`#${CSS.escape(id)}`) : null;
      // The dialog a trigger points to hasn't landed yet either — retry.
      if (!dialog) return false;
      items.push({ trigger, dialog, index: items.length, originalLabel: null });
    }
    this.#items = items;
    this.#reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    for (const item of items) this.#enhance(item);

    this.#ready = true;
    return true;
  }

  /** Wire one dialog's nav, counter and listeners. */
  #enhance(item: GalleryItem): void {
    const total = this.#items.length;
    if (total > 1) this.#buildNav(item);

    // The counter rides on the dialog's own accessible name, so it is announced
    // the moment the dialog receives focus with no separate live region to keep
    // in sync. Only added past one image — "Image 1 of 1" tells a single-image
    // gallery's visitor nothing they didn't already know.
    item.originalLabel = item.dialog.getAttribute('aria-label');
    if (total > 1) {
      const label = slideLabel(item.index, total, 'Image');
      item.dialog.setAttribute(
        'aria-label',
        item.originalLabel ? `${item.originalLabel} — ${label}` : label,
      );
    }

    item.dialog.addEventListener('command', this.#onCommand);
    item.dialog.addEventListener('keydown', this.#onKeydown);
    item.dialog.addEventListener('close', this.#onDialogClose);
    item.dialog.addEventListener('pointerdown', this.#onPointerDown);
    item.dialog.addEventListener('pointerup', this.#onPointerUp);
  }

  /**
   * Real `<button>`s for `.lightbox-dialog__nav[data-direction]` — the parts
   * `patterns/lightbox.css` already styles. Never authored: see the class
   * docblock for why prev/next cannot exist in the no-JS fallback.
   *
   * Disabled state at either end is fixed once here rather than recomputed on
   * every navigation: which dialog is first/last never changes, so there is
   * nothing to resync.
   */
  #buildNav(item: GalleryItem): void {
    const total = this.#items.length;
    const rtl = getComputedStyle(item.dialog).direction === 'rtl';
    const make = (
      direction: 'prev' | 'next',
      label: string,
      glyph: string,
      delta: number,
      disabled: boolean,
    ): HTMLElement => {
      const wrap = document.createElement('div');
      wrap.className = 'lightbox-dialog__nav';
      wrap.dataset.direction = direction;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lightbox-dialog__nav-button';
      button.setAttribute('aria-label', label);
      button.disabled = disabled;
      button.textContent = glyph;
      button.addEventListener('click', () => this.#step(delta));
      wrap.append(button);
      return wrap;
    };
    const atStart = !this.loop && item.index === 0;
    const atEnd = !this.loop && item.index === total - 1;
    const nav = [
      make('prev', 'Previous image', rtl ? '›' : '‹', -1, atStart),
      make('next', 'Next image', rtl ? '‹' : '›', 1, atEnd),
    ];
    item.dialog.append(...nav);
    item.nav = nav;
  }

  /* ── Navigation ──────────────────────────────────────────────────────────── */

  #step(delta: number): void {
    if (this.#currentIndex === null) return;
    this.#goto(
      stepIndex({ index: this.#currentIndex, total: this.#items.length, delta, loop: this.loop }),
    );
  }

  /** Close the current dialog and open `index`, relaying focus through the chain. */
  #goto(index: number): void {
    if (index === this.#currentIndex) return;
    const from = this.#currentIndex !== null ? this.#items[this.#currentIndex] : undefined;
    const to = this.#items[index];
    if (!to) return;
    from?.dialog.close();
    to.dialog.showModal();
    this.#afterOpen(index);
    this.dispatchEvent(
      new CustomEvent('gallery-change', {
        bubbles: true,
        composed: true,
        detail: { index, total: this.#items.length },
      }),
    );
  }

  #afterOpen(index: number): void {
    this.#currentIndex = index;
    this.#preload(preloadTargets(index, this.#items.length, this.loop));
  }

  /** Neighbours of a warm cache load instantly when the visitor actually steps there. */
  #preload(indices: number[]): void {
    for (const i of indices) {
      const img = this.#items[i]?.dialog.querySelector<HTMLImageElement>('.lightbox-dialog__image');
      // `currentSrc` may be empty for a still-lazy `<picture>` image whose format
      // negotiation hasn't run yet; `src` (the fallback format) is always a
      // usable URL to warm the cache with, even if not the exact chosen format.
      const src = img?.currentSrc || img?.src;
      if (src) new Image().src = src;
    }
  }

  /**
   * Runs the thumbnail → full-image morph and opens the dialog.
   *
   * Always intercepts the `show-modal` command rather than only when a
   * transition will run: letting the browser's default action fire `showModal()`
   * on top of a manual call here would throw (a dialog cannot be shown modally
   * twice), so bookkeeping and the transition share one path.
   */
  #openFromTrigger(item: GalleryItem): void {
    const total = this.#items.length;
    const finish = (): void => {
      item.dialog.showModal();
      this.#afterOpen(item.index);
      this.dispatchEvent(
        new CustomEvent('gallery-open', {
          bubbles: true,
          composed: true,
          detail: { index: item.index, total },
        }),
      );
    };

    const thumb = item.trigger.querySelector<HTMLElement>('.gallery__thumb');
    const full = item.dialog.querySelector<HTMLImageElement>('.lightbox-dialog__image');
    if (this.#reducedMotion || !('startViewTransition' in document) || !thumb || !full) {
      finish();
      return;
    }

    // The full image is `loading="lazy"` inside a still-closed (`display: none`)
    // dialog, so nothing has fetched it yet. Running the transition before it
    // decodes captures an empty box as the "new" state, and the image then pops
    // in once it finally loads — a flash that's most visible on the very first
    // open, since every later one has a neighbour already warmed by #preload.
    // Force the fetch now and hold the transition until it can actually paint.
    // `.catch()` lets a broken/failed image still open rather than hang.
    full.loading = 'eager';
    void full
      .decode()
      .catch(() => {})
      .then(() => {
        // The shared name is what morphs the thumbnail into the full image —
        // `view-transition-name: match-element` (each element auto-named
        // uniquely) cannot do this, which is why lightbox.css sets neither
        // statically.
        thumb.style.viewTransitionName = 'lightbox-active';
        const transition = document.startViewTransition(() => {
          thumb.style.viewTransitionName = '';
          full.style.viewTransitionName = 'lightbox-active';
          finish();
        });
        void transition.finished.finally(() => {
          full.style.viewTransitionName = '';
        });
      });
  }

  /* ── Listeners (shared references — same fn on every dialog, so add/remove match) ── */

  #onCommand = (event: Event): void => {
    const command = event as Event & { command?: string };
    if (command.command !== 'show-modal') return;
    // Always preventDefault: see #openFromTrigger's docblock for why this is
    // unconditional rather than only when a transition is about to run.
    event.preventDefault();
    const dialog = event.currentTarget as HTMLDialogElement;
    const item = this.#items.find((it) => it.dialog === dialog);
    if (item) this.#openFromTrigger(item);
  };

  #onKeydown = (event: KeyboardEvent): void => {
    if (this.#currentIndex === null) return;
    const rtl = getComputedStyle(event.currentTarget as Element).direction === 'rtl';
    const action = keyToAction(event.key, rtl);
    if (!action) return; // Escape included — <dialog> already closes on it.
    event.preventDefault();
    if (action === 'first') this.#goto(0);
    else if (action === 'last') this.#goto(this.#items.length - 1);
    else this.#step(action.delta);
  };

  #onDialogClose = (event: Event): void => {
    const dialog = event.currentTarget as HTMLDialogElement;
    const item = this.#items.find((it) => it.dialog === dialog);
    if (item && this.#currentIndex === item.index) this.#currentIndex = null;
  };

  #onPointerDown = (event: PointerEvent): void => {
    // Dragging over a nav or close button is still a click on it; don't treat
    // the resulting small travel as a swipe attempt.
    if ((event.target as Element | null)?.closest('button')) return;
    this.#dragStart = { x: event.clientX, y: event.clientY };
  };

  #onPointerUp = (event: PointerEvent): void => {
    const start = this.#dragStart;
    this.#dragStart = null;
    if (!start) return;
    const action: SwipeAction = swipeAction(
      event.clientX - start.x,
      event.clientY - start.y,
      SWIPE_THRESHOLD,
    );
    if (!action) return;
    if (action.type === 'dismiss') (event.currentTarget as HTMLDialogElement).close();
    else this.#step(action.delta);
  };
}

if (!customElements.get('wc-gallery')) {
  customElements.define('wc-gallery', WCGallery);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-gallery': WCGallery;
  }
}
