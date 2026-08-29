import { noChange } from 'lit';
import { BaseElement } from './BaseElement.js';
import { preloadTargets } from './utils/gallery.js';
import { initFromLightDom } from './utils/upgrade.js';

/** One `.gallery__trigger` anchor, the `.carousel__slide` its `href` targets. */
interface GalleryItem {
  trigger: HTMLAnchorElement;
  slide: HTMLElement;
}

/**
 * Augments a `.gallery` grid of `<a href="#slide-id">` triggers and the single
 * `.lightbox-dialog` they point into (patterns/gallery.css, patterns/lightbox.css)
 * with a real `showModal()` open, neighbour preload and a thumbnail → full-image
 * view-transition morph.
 *
 * **Stepping between images is not this element's job.** The `<wc-carousel>`
 * nested inside the dialog (patterns/carousel.css, `WCCarousel.ts`) owns
 * prev/next, dots, arrow keys and swipe — reused rather than re-implemented. The
 * previous version of this element hand-rolled all four across N per-image
 * dialogs, and closing one dialog to open another made every step play a full
 * exit-then-entry animation on the top-layer driver (animation.css) — a design
 * that could not help flickering. One dialog containing one carousel makes that
 * failure mode unrepresentable: stepping is a scroll, not a close/open pair.
 *
 * **The fallback is the point, and it does not merely degrade gracefully.**
 * With no JS, each `.gallery__trigger` is a real `<a href="#slide-id">` into the
 * carousel's own `<li id="slide-id">` — ordinary fragment navigation, no
 * Invoker Commands, no polyfill. `:has(:target)` in lightbox.css is what reveals
 * the dialog once that navigation lands, and the browser's own fragment scroll
 * already puts the carousel on the right slide. What JS adds on top is real
 * top-layer placement (`showModal()`, so the overlay sits above other top-layer
 * content a fixed-position `:has(:target)` box could not), the morph, and
 * neighbour preload — never prev/next, which the fallback already has via the
 * carousel underneath.
 *
 * **`:target` is deliberately not kept in sync with the JS-driven open.** This
 * element intercepts the trigger click and never lets the real fragment
 * navigation happen, so the URL hash is simply not part of how the JS path
 * decides visibility — only `dialog[open]` is, and lightbox.css's fallback rule
 * is gated on `:not([open])` for exactly this reason: once JS has the dialog
 * open, the fallback's condition is irrelevant regardless of what the URL says.
 *
 * @fires gallery-open
 * @fires gallery-change
 * @example
 * ```html
 * <wc-gallery>
 *   <ul class="gallery" role="list">
 *     <li class="gallery__item">
 *       <a class="gallery__trigger" href="#img-1">
 *         <img class="gallery__thumb" src="…" alt="" />
 *       </a>
 *     </li>
 *   </ul>
 *   <dialog id="lb" class="lightbox-dialog" closedby="any" aria-label="…">
 *     <wc-carousel class="carousel lightbox-dialog__track" role="group"
 *                  aria-roledescription="carousel" aria-label="…">
 *       <ul class="carousel__track" role="list" tabindex="0">
 *         <li class="carousel__slide" id="img-1">
 *           <figure class="carousel__media"><img src="…" alt="…" /></figure>
 *         </li>
 *       </ul>
 *     </wc-carousel>
 *     <a class="lightbox-dialog__close" href="#" aria-label="Close">&times;</a>
 *   </dialog>
 * </wc-gallery>
 * ```
 */
export class WCGallery extends BaseElement {
  /** Light DOM — the framework's `.gallery` / `.lightbox-dialog` CSS must style the slotted markup. */
  override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Never let lit-html touch the slotted markup. */
  protected override render(): typeof noChange {
    return noChange;
  }

  #ready = false;
  #dialog: HTMLDialogElement | null = null;
  #carousel: HTMLElement | null = null;
  #closeLink: HTMLAnchorElement | null = null;
  #items: GalleryItem[] = [];
  #reducedMotion = false;

  override connectedCallback(): void {
    super.connectedCallback();
    // The triggers/dialog/carousel may not be parsed yet — see initFromLightDom.
    initFromLightDom(this, () => this.#setup());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const item of this.#items) item.trigger.removeEventListener('click', this.#onTriggerClick);
    this.#closeLink?.removeEventListener('click', this.#onCloseClick);
    this.#carousel?.removeEventListener('carousel-change', this.#onCarouselChange as EventListener);
    this.#items = [];
    this.#dialog = null;
    this.#carousel = null;
    this.#closeLink = null;
    this.#ready = false;
  }

  #setup(): boolean {
    // Defer entirely to an enclosing <wc-gallery>. `<Gallery />` emits its own
    // tag, so a consumer who reasonably guesses `<wc-gallery><Gallery /></wc-gallery>`
    // nests two. `parentElement` rather than `this`, since `this.closest()`
    // matches self. Same trap WCCarousel and WCTree close.
    if (this.parentElement?.closest('wc-gallery')) return true;
    if (this.#ready) return true;

    const triggers = [...this.querySelectorAll<HTMLAnchorElement>('.gallery__trigger[href^="#"]')];
    const dialog = this.querySelector<HTMLDialogElement>('dialog.lightbox-dialog');
    // Fewer than one trigger, no dialog, or the nested carousel hasn't parsed
    // yet: the retry hook. Mid-insertion the element can be connected with an
    // empty or partial subtree.
    if (!triggers.length || !dialog) return false;
    const carousel = dialog.querySelector<HTMLElement>('.lightbox-dialog__track');
    if (!carousel) return false;

    const items: GalleryItem[] = [];
    for (const trigger of triggers) {
      const id = trigger.getAttribute('href')?.slice(1);
      const slide = id ? this.querySelector<HTMLElement>(`#${CSS.escape(id)}`) : null;
      // The slide a trigger points to hasn't landed yet either — retry.
      if (!slide) return false;
      items.push({ trigger, slide });
    }

    this.#reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.#dialog = dialog;
    this.#carousel = carousel;
    this.#closeLink = dialog.querySelector<HTMLAnchorElement>('.lightbox-dialog__close');
    this.#items = items;

    for (const item of items) item.trigger.addEventListener('click', this.#onTriggerClick);
    this.#closeLink?.addEventListener('click', this.#onCloseClick);
    carousel.addEventListener('carousel-change', this.#onCarouselChange as EventListener);

    this.#ready = true;
    return true;
  }

  #onTriggerClick = (event: MouseEvent): void => {
    const trigger = event.currentTarget as HTMLAnchorElement;
    const item = this.#items.find((it) => it.trigger === trigger);
    if (!item || !this.#dialog) return;
    event.preventDefault();
    this.#open(item);
  };

  /**
   * Runs the thumbnail → full-image morph and opens the dialog.
   *
   * Unlike the previous per-dialog design, this never awaits a decode before
   * starting the transition — `.carousel__media`'s `--lightbox-placeholder`
   * background (set from the thumbnail URL by `<Gallery />`) is already painted,
   * so the transition's "new" state is never an empty box even if the full
   * image hasn't loaded. That wait was the entire cause of the stuttery open.
   */
  #open(item: GalleryItem): void {
    const index = this.#items.indexOf(item);
    const total = this.#items.length;

    const finish = (): void => {
      this.#dialog!.showModal();
      item.slide.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' });
      this.#preload(index);
      this.dispatchEvent(
        new CustomEvent('gallery-open', {
          bubbles: true,
          composed: true,
          detail: { index, total },
        }),
      );
    };

    const thumb = item.trigger.querySelector<HTMLElement>('.gallery__thumb');
    const full = item.slide.querySelector<HTMLElement>('img');
    if (this.#reducedMotion || !('startViewTransition' in document) || !thumb || !full) {
      finish();
      return;
    }

    // The shared name is what morphs the thumbnail into the full image —
    // `view-transition-name: match-element` (each element auto-named uniquely)
    // cannot do this, which is why lightbox.css sets neither statically.
    thumb.style.viewTransitionName = 'lightbox-active';
    const transition = document.startViewTransition(() => {
      thumb.style.viewTransitionName = '';
      full.style.viewTransitionName = 'lightbox-active';
      finish();
    });
    void transition.finished.finally(() => {
      full.style.viewTransitionName = '';
    });
  }

  /** Neighbours of a warm cache load instantly when the visitor actually steps there. */
  #preload(index: number): void {
    const loop = this.#carousel?.hasAttribute('loop') ?? false;
    for (const i of preloadTargets(index, this.#items.length, loop)) {
      const img = this.#items[i]?.slide.querySelector<HTMLImageElement>('img');
      // `currentSrc` may be empty for a still-lazy `<picture>` image whose format
      // negotiation hasn't run yet; `src` (the fallback format) is always a
      // usable URL to warm the cache with, even if not the exact chosen format.
      const src = img?.currentSrc || img?.src;
      if (src) new Image().src = src;
    }
  }

  #onCloseClick = (event: MouseEvent): void => {
    // The href="#" is the no-JS close mechanism (clears the fragment so
    // `:has(:target)` stops matching) — irrelevant once JS is driving via
    // `showModal()`, so intercept it and close the real modal instead.
    event.preventDefault();
    this.#dialog?.close();
  };

  #onCarouselChange = (event: CustomEvent<{ index: number; total: number }>): void => {
    this.dispatchEvent(
      new CustomEvent('gallery-change', { bubbles: true, composed: true, detail: event.detail }),
    );
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
