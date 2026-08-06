import { BaseElement } from './BaseElement.js';
import { initFromLightDom } from './utils/upgrade.js';

/**
 * Infinite-loop carousel with optional autoplay.
 *
 * Progressively enhances a CSS-only `.carousel` by cloning slides at both
 * ends and silently jumping from clones back to real slides on snap.
 * Infinite looping is non-paged mode only — `carousel--auto-pages` (CSS
 * columns) gets autoplay and accessibility but not cloning.
 *
 * Without JS the element is an unknown HTML tag — `.carousel` classes still
 * produce a fully functional non-looping carousel.
 *
 * Accessibility (progressive):
 * - In HTML (safe without JS): `role="region"`, `aria-roledescription="carousel"`,
 *   `aria-label="..."` can be set as defaults on the element.
 * - On connect: component ensures `role` and `aria-roledescription` are present.
 * - With autoplay: manages `aria-live` — `"off"` while playing (avoids constant
 *   announcements), `"polite"` when paused (announces manual navigation).
 * - Clones get `aria-hidden="true"` and `tabindex="-1"` on focusable elements.
 *
 * @example
 * ```html
 * <wc-carousel class="carousel carousel--scroll-buttons carousel--scroll-markers"
 *              role="region" aria-roledescription="carousel" aria-label="Featured slides"
 *              autoplay="4000">
 *   <div>Slide 1</div>
 *   <div>Slide 2</div>
 *   <div>Slide 3</div>
 * </wc-carousel>
 * ```
 */
export class WCCarousel extends BaseElement {
  static properties = {
    autoplay: { type: Number, reflect: true },
  };

  /** Light DOM — no shadow root so existing .carousel CSS applies directly. */
  override createRenderRoot() {
    return this;
  }

  declare autoplay: number;

  #realSlides: Element[] = [];
  #clones: Element[] = [];
  #isPaged = false;
  #isJumping = false;
  #autoplayTimer: ReturnType<typeof setInterval> | null = null;
  #paused = false;
  #playPauseBtn: HTMLButtonElement | null = null;
  #reducedMotion = false;

  init() {
    this.autoplay = 0;
  }

  constructor() {
    super();
    this.init();
  }

  override connectedCallback(): void {
    super.connectedCallback();

    /* ── Accessibility defaults (safe to set on connect) ── */
    if (!this.hasAttribute('role')) this.setAttribute('role', 'region');
    if (!this.hasAttribute('aria-roledescription')) {
      this.setAttribute('aria-roledescription', 'carousel');
    }

    // The slides may not be parsed yet — see initFromLightDom. The a11y
    // attributes above are safe on connect and stay there; everything below
    // depends on the slotted slides existing.
    initFromLightDom(this, () => this.#setupSlides());
  }

  /** Wire up cloning/autoplay if the slotted slides are present. */
  #setupSlides(): boolean {
    if (this.#realSlides.length >= 2) return true; // already set up

    this.#realSlides = [...this.children].filter((el) => !el.hasAttribute('slot'));
    if (this.#realSlides.length < 2) return false;

    /* Paged mode (CSS columns) — cloning individual items would just add
       more items to the column flow, not clone pages. Only autoplay applies. */
    this.#isPaged = this.classList.contains('carousel--auto-pages');

    if (!this.#isPaged) {
      this.#createClones();
      this.#scrollToFirstReal();
      this.addEventListener('scrollsnapchange', this.#handleSnapChange as EventListener);
    }

    /* Autoplay setup — read attribute directly as fallback for upgrade timing */
    if (!this.autoplay && this.hasAttribute('autoplay')) {
      this.autoplay = Number(this.getAttribute('autoplay')) || 0;
    }
    this.#reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (this.autoplay > 0) {
      this.#resolvePlayPauseBtn();
      if (!this.#reducedMotion) {
        this.#startAutoplay();
      } else {
        this.#paused = true;
        this.setAttribute('aria-live', 'polite');
        this.#updatePlayPauseBtn();
      }

      this.addEventListener('pointerenter', this.#pauseAutoplay);
      this.addEventListener('pointerleave', this.#resumeAutoplay);
      this.addEventListener('focusin', this.#pauseAutoplay);
      this.addEventListener('focusout', this.#resumeAutoplay);
    }
    return true;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (!this.#isPaged) {
      this.removeEventListener('scrollsnapchange', this.#handleSnapChange as EventListener);
      this.#removeClones();
    }
    this.removeEventListener('pointerenter', this.#pauseAutoplay);
    this.removeEventListener('pointerleave', this.#resumeAutoplay);
    this.removeEventListener('focusin', this.#pauseAutoplay);
    this.removeEventListener('focusout', this.#resumeAutoplay);
    this.#stopAutoplay();
    if (this.#playPauseBtn) {
      this.#playPauseBtn.removeEventListener('click', this.#toggleAutoplay);
      /* Only remove fallback buttons we created; keep user-provided ones. */
      if (!this.#playPauseBtn.hasAttribute('slot')) this.#playPauseBtn.remove();
      this.#playPauseBtn = null;
    }
    this.removeAttribute('aria-live');
  }

  /* ── Clone management ── */

  #createClones(): void {
    const before: Element[] = [];
    const after: Element[] = [];

    for (let i = 0; i < this.#realSlides.length; i++) {
      const slide = this.#realSlides[i] as Element;
      before.push(this.#prepareClone(slide, i));
      after.push(this.#prepareClone(slide, i));
    }

    /* Prepend in reverse so slide order is preserved. */
    for (let i = before.length - 1; i >= 0; i--) {
      this.prepend(before[i] as Element);
    }
    for (const clone of after) {
      this.append(clone);
    }

    this.#clones = [...before, ...after];
  }

  #prepareClone(source: Element, index: number): Element {
    const clone = source.cloneNode(true) as Element;
    clone.setAttribute('data-carousel-clone', String(index));
    clone.setAttribute('aria-hidden', 'true');

    /* Prevent cloned focusable elements from entering the tab order. */
    for (const el of [
      clone,
      ...clone.querySelectorAll('[tabindex], a, button, input, select, textarea'),
    ]) {
      (el as HTMLElement).tabIndex = -1;
    }

    return clone;
  }

  #removeClones(): void {
    for (const clone of this.#clones) clone.remove();
    this.#clones = [];
  }

  /* ── Scroll helpers ── */

  #scrollToFirstReal(): void {
    requestAnimationFrame(() => {
      const first = this.#realSlides[0];
      if (!first) return;
      this.style.scrollBehavior = 'auto';
      this.scrollLeft =
        (first as HTMLElement).offsetLeft -
        this.offsetLeft -
        (parseFloat(getComputedStyle(this).scrollPaddingLeft) || 0) +
        (parseFloat(getComputedStyle(this).paddingLeft) || 0);
      /* Restore after the forced instant scroll. */
      requestAnimationFrame(() => {
        this.style.scrollBehavior = '';
      });
    });
  }

  #scrollToNext(): void {
    /* Scroll right by one page — the browser's scroll-snap picks the next slide. */
    this.scrollBy({ left: this.clientWidth, behavior: 'smooth' });
  }

  #handleSnapChange = (e: Event): void => {
    if (this.#isJumping) {
      this.#isJumping = false;
      return;
    }

    const snapped = (e as any).snapTargetInline as Element | null;
    if (!snapped || !snapped.hasAttribute('data-carousel-clone')) return;

    const index = Number(snapped.getAttribute('data-carousel-clone'));
    const realSlide = this.#realSlides[index];
    if (!realSlide) return;

    /* Delta between clone and real slide — content is identical so the
       jump is visually seamless. */
    const delta = (realSlide as HTMLElement).offsetLeft - (snapped as HTMLElement).offsetLeft;

    this.#isJumping = true;
    this.style.scrollBehavior = 'auto';
    this.scrollLeft += delta;
    requestAnimationFrame(() => {
      this.style.scrollBehavior = '';
    });
  };

  /* ── Autoplay ── */

  #startAutoplay(): void {
    if (this.#autoplayTimer || this.autoplay <= 0) return;
    this.#paused = false;
    this.#autoplayTimer = setInterval(() => this.#scrollToNext(), this.autoplay);
    this.setAttribute('aria-live', 'off');
    this.#updatePlayPauseBtn();
  }

  #stopAutoplay(): void {
    if (this.#autoplayTimer) {
      clearInterval(this.#autoplayTimer);
      this.#autoplayTimer = null;
    }
  }

  #pauseAutoplay = (): void => {
    this.#stopAutoplay();
    this.#paused = true;
    this.setAttribute('aria-live', 'polite');
    this.#updatePlayPauseBtn();
  };

  #resumeAutoplay = (): void => {
    if (this.#reducedMotion) return;
    this.#startAutoplay();
  };

  #toggleAutoplay = (): void => {
    if (this.#paused) {
      this.#reducedMotion = false;
      this.#startAutoplay();
    } else {
      this.#pauseAutoplay();
    }
  };

  /* ── Play/Pause button (slot with fallback) ── */

  #resolvePlayPauseBtn(): void {
    /* Look for a user-provided button with slot="autoplay". */
    const existing = this.querySelector<HTMLButtonElement>('[slot="autoplay"]');

    if (existing) {
      this.#playPauseBtn = existing;
    } else {
      /* Fallback: create a default button. */
      const btn = document.createElement('button');
      btn.type = 'button';
      this.append(btn);
      this.#playPauseBtn = btn;
    }

    this.#playPauseBtn.setAttribute('part', 'autoplay');
    this.#playPauseBtn.addEventListener('click', this.#toggleAutoplay);
    this.#updatePlayPauseBtn();
  }

  #updatePlayPauseBtn(): void {
    if (!this.#playPauseBtn) return;
    this.#playPauseBtn.setAttribute('aria-label', this.#paused ? 'Play' : 'Pause');
    this.#playPauseBtn.setAttribute('aria-pressed', String(!this.#paused));
    /* Only set text content on the fallback (no slot="autoplay"). */
    if (!this.#playPauseBtn.hasAttribute('slot')) {
      this.#playPauseBtn.textContent = this.#paused ? '\u25B6' : '\u23F8';
    }
  }
}

if (!customElements.get('wc-carousel')) {
  customElements.define('wc-carousel', WCCarousel);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-carousel': WCCarousel;
  }
}
