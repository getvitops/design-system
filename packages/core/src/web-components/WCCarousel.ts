import { noChange } from 'lit';
import { BaseElement } from './BaseElement.js';
import {
  CLONE_MEDIA,
  hasScrolled,
  planCarousel,
  readFeatures,
  slideLabel,
  type CarouselPlan,
} from './utils/carousel.js';
import { initFromLightDom } from './utils/upgrade.js';
import { RovingTabindex } from './utils/RovingTabindex.js';

/**
 * Scroll-snap carousel: an opt-in cloned loop, autoplay, and — where the browser
 * has no `::scroll-button()` / `::scroll-marker` — real prev/next buttons and a
 * real dot nav built to look and behave exactly like the native ones.
 *
 * **The fallback is the point.** With no JS, `.carousel` is a snapping scroll
 * strip with a visible scrollbar, a "Scroll for more" hint and natively lazy
 * off-screen images (`loading="lazy"` is honoured for images clipped by a
 * horizontal scroll container, so no `data-src` dance is needed). Everything here
 * is enhancement on top of markup that already works.
 *
 * **Which controls to build is answered by the stylesheet, not by `CSS.supports`.**
 * `carousel.css` declares `--carousel-native-nav: 1` inside one `@supports`, and
 * this element reads it back. The condition therefore exists once, and — more
 * importantly — the question it answers is "did my stylesheet's native branch
 * apply", not "does this engine know the pseudo-element". A page that loads
 * `elements.js` without the framework CSS gets the fallback, which is correct;
 * `CSS.supports` would have said yes and built nothing. See `utils/carousel.ts`.
 *
 * **Looping is opt-in** (`loop`, implied by `autoplay`). It clones the slides at
 * both ends, which triples the DOM and duplicates every image element — so the
 * default is an honest finite strip whose scrollbar reflects real content and
 * whose dot count matches the slides.
 *
 * @example
 * ```html
 * <wc-carousel class="carousel carousel--scroll-buttons carousel--scroll-markers"
 *              role="group" aria-roledescription="carousel" aria-label="Our work"
 *              loop autoplay="4000">
 *   <ul class="carousel__track" role="list" tabindex="0">
 *     <li class="carousel__slide">…</li>
 *   </ul>
 *   <p class="carousel__hint" aria-hidden="true">Scroll for more</p>
 * </wc-carousel>
 * ```
 */
export class WCCarousel extends BaseElement {
  static properties = {
    /** Milliseconds between slides. 0 (the default) is off. Implies `loop`. */
    autoplay: { type: Number, reflect: true },
    /** Clone the slides at both ends for a seamless infinite strip. */
    loop: { type: Boolean, reflect: true },
  };

  /** Light DOM — the framework's `.carousel` CSS must style the slotted markup. */
  override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Never let lit-html touch the slotted slides. */
  protected override render(): typeof noChange {
    return noChange;
  }

  declare autoplay: number;
  declare loop: boolean;

  #ready = false;
  #track: HTMLElement | null = null;
  #slides: HTMLElement[] = [];
  #clones: Element[] = [];
  #plan: CarouselPlan | null = null;

  #buttons: HTMLButtonElement[] = [];
  #markerGroup: HTMLElement | null = null;
  #markers: HTMLButtonElement[] = [];
  #autoplayBtn: HTMLButtonElement | null = null;
  #ownsAutoplayBtn = false;
  #roving: RovingTabindex<HTMLButtonElement>;

  #observer: ResizeObserver | null = null;
  #timer: ReturnType<typeof setInterval> | null = null;
  #settleTimer: ReturnType<typeof setTimeout> | null = null;
  #paused = false;
  #reducedMotion = false;
  #jumping = false;

  constructor() {
    super();
    this.autoplay = 0;
    this.loop = false;
    // `orientation: 'both'` — the dot nav has always accepted Up/Down as well
    // as Left/Right; `loop: true` — it has always wrapped unconditionally.
    // Selection follows focus: a keyboard move clicks the marker it lands on,
    // which is what actually scrolls the track (see the marker's own click
    // listener in #buildMarkers). Only for `cause === 'key'` — `#syncControls`
    // moves the active marker to match the track's real scroll position via
    // `silent: true`, and the focus-in-by-mouse path is `cause: 'pointer'`;
    // clicking either would re-trigger the scroll that's already happened.
    this.#roving = new RovingTabindex<HTMLButtonElement>(this, {
      items: () => this.#markers,
      orientation: 'both',
      loop: true,
      onMove: (marker, _previous, cause) => {
        if (cause === 'key') marker.click();
      },
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // The slides may not be parsed yet — see initFromLightDom.
    initFromLightDom(this, () => this.#setup());
  }

  /* ── Setup ───────────────────────────────────────────────────────────────── */

  #setup(): boolean {
    // Defer entirely to an enclosing <wc-carousel>. `<Carousel />` emits its own
    // tag, so a consumer who reasonably guesses `<wc-carousel><Carousel /></wc-carousel>`
    // nests two, and both would clone the same slides. `parentElement` rather
    // than `this`, since `this.closest()` matches self; returning true also
    // cancels the retry. Same trap WCCards closed.
    if (this.parentElement?.closest('wc-carousel')) return true;
    if (this.#ready) return true;

    const track = this.#resolveTrack();
    if (!track) return false;
    this.#track = track;

    this.#slides = [...track.children].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && !el.hasAttribute('slot'),
    );
    // Fewer than two is the retry hook: mid-insertion the element can be connected
    // with an empty or partial subtree.
    if (this.#slides.length < 2) return false;

    // Attribute fallback for upgrade timing — the Lit property may not have landed.
    if (!this.autoplay && this.hasAttribute('autoplay')) {
      this.autoplay = Number(this.getAttribute('autoplay')) || 0;
    }
    if (!this.loop && this.hasAttribute('loop')) this.loop = true;
    this.#reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const features = readFeatures((name) => getComputedStyle(this).getPropertyValue(name));
    const plan = planCarousel(
      {
        loop: this.loop,
        autoplay: this.autoplay,
        paged: this.classList.contains('carousel--auto-pages'),
        wantsButtons: this.classList.contains('carousel--scroll-buttons'),
        wantsMarkers: this.classList.contains('carousel--scroll-markers'),
        slides: this.#slides.length,
        reducedMotion: this.#reducedMotion,
      },
      features,
    );
    this.#plan = plan;

    this.#applyA11yDefaults(track);
    if (plan.clone) this.#createClones();
    if (plan.buildButtons) this.#buildButtons();
    if (plan.buildMarkers) this.#buildMarkers();

    // One scroll listener serves every consumer of the scroll position: the
    // one-way `data-scrolled` flag, the active marker, the button disabled
    // states, and the seam jump. Registering four would mean four rAF loops.
    if (plan.trackScrolled || plan.clone || this.#buttons.length || this.#markers.length) {
      track.addEventListener('scroll', this.#onScroll, { passive: true });
      // `scrollsnapchange` is the precise signal but is Chromium-only, and
      // `scrollend` is not in every engine we support either — so #onScroll
      // debounces as a last resort. All three funnel into #settle.
      track.addEventListener('scrollsnapchange', this.#settle);
      track.addEventListener('scrollend', this.#settle);
    }

    if (plan.clone) this.#scrollToFirstReal();
    if (this.autoplay > 0) this.#setupAutoplay(plan);

    // A strip that fits needs neither a hint nor a tab stop, and the answer
    // changes with the viewport.
    this.#observer = new ResizeObserver(this.#syncOverflow);
    this.#observer.observe(track);
    this.#syncOverflow();

    this.#ready = true;
    return true;
  }

  /**
   * Find the scroll container, promoting the deprecated 5.x markup if that is what
   * we were handed.
   *
   * In 5.x `.carousel` *was* the scroller and the slides were its bare children,
   * which leaves nowhere to put the hint or the fallback controls — appended to
   * the host they would become grid items in the slide track. `carousel.css` still
   * styles that shape for the no-JS case; here we promote it, which makes every
   * path below uniform and is exactly the "parse the fallback and augment it in
   * place" contract. Author CSS matching `.carousel > .slide` is the cost, and the
   * form is deprecated for that reason.
   */
  #resolveTrack(): HTMLElement | null {
    const existing = this.querySelector<HTMLElement>(':scope > .carousel__track');
    if (existing) return existing;
    if (!this.classList.contains('carousel')) return null;
    if (!this.children.length) return null;

    const track = document.createElement('div');
    track.className = 'carousel__track';
    track.append(...this.childNodes);
    this.append(track);
    return track;
  }

  /**
   * `role="group"`, not `region`. `region` is a landmark, so a page with four
   * carousels grows four entries in every landmark list; APG uses `group` unless
   * the carousel is itself a page-level landmark, which `<Carousel landmark />`
   * opts into. Nothing here overwrites an attribute the author set.
   */
  #applyA11yDefaults(track: HTMLElement): void {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'group');
    if (!this.hasAttribute('aria-roledescription')) {
      this.setAttribute('aria-roledescription', 'carousel');
    }
    // The scroller is what arrow keys act on, so it must be focusable.
    if (!track.hasAttribute('tabindex')) track.tabIndex = 0;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    const track = this.#track;

    this.#observer?.disconnect();
    this.#observer = null;

    if (track) {
      track.removeEventListener('scroll', this.#onScroll);
      track.removeEventListener('scrollsnapchange', this.#settle);
      track.removeEventListener('scrollend', this.#settle);
    }
    if (this.#settleTimer) clearTimeout(this.#settleTimer);
    this.#settleTimer = null;

    this.#stopAutoplay();
    this.removeEventListener('pointerenter', this.#pause);
    this.removeEventListener('pointerleave', this.#resume);
    this.removeEventListener('focusin', this.#pause);
    this.removeEventListener('focusout', this.#resume);

    if (this.#autoplayBtn) {
      this.#autoplayBtn.removeEventListener('click', this.#toggleAutoplay);
      // Only remove a button we made; an author's slot="autoplay" is theirs.
      if (this.#ownsAutoplayBtn) this.#autoplayBtn.remove();
      this.#autoplayBtn = null;
      this.#ownsAutoplayBtn = false;
    }

    for (const button of this.#buttons) button.remove();
    this.#buttons = [];
    this.#roving.detach();
    this.#markerGroup?.remove();
    this.#markerGroup = null;
    this.#markers = [];

    for (const clone of this.#clones) clone.remove();
    this.#clones = [];

    this.removeAttribute('data-scrolled');
    this.removeAttribute('aria-live');
    this.#slides = [];
    this.#plan = null;
    this.#ready = false;
  }

  /* ── Cloning ─────────────────────────────────────────────────────────────── */

  #createClones(): void {
    const before = this.#slides.map((slide, i) => this.#prepareClone(slide, i));
    const after = this.#slides.map((slide, i) => this.#prepareClone(slide, i));
    // Prepend in reverse so slide order is preserved.
    for (let i = before.length - 1; i >= 0; i--) this.#track?.prepend(before[i] as Element);
    for (const clone of after) this.#track?.append(clone);
    this.#clones = [...before, ...after];
  }

  #prepareClone(source: Element, index: number): Element {
    const clone = source.cloneNode(true) as Element;
    clone.setAttribute('data-carousel-clone', String(index));
    clone.setAttribute('aria-hidden', 'true');
    // `inert` rather than walking a list of focusable selectors: the platform
    // already covers <details>, [contenteditable], <audio controls> and anything
    // added to the focusable set later, in one attribute.
    clone.setAttribute('inert', '');
    // Ids are unique. The previous version cloned them, so a slide with an id
    // appeared three times in the document — and Carousel.astro now emits ids for
    // the dot nav's aria-controls, which would have made that live.
    clone.removeAttribute('id');
    for (const el of clone.querySelectorAll('[id]')) el.removeAttribute('id');
    // A clone of the first slide is a clone of the LCP candidate. See CLONE_MEDIA.
    for (const img of clone.querySelectorAll('img')) {
      for (const [name, value] of Object.entries(CLONE_MEDIA)) img.setAttribute(name, value);
    }
    return clone;
  }

  /* ── Navigation ──────────────────────────────────────────────────────────── */

  /** Every slide currently in the track, clones included, in document order. */
  #trackChildren(): HTMLElement[] {
    if (!this.#track) return [];
    return [...this.#track.children].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && !el.hasAttribute('slot'),
    );
  }

  /**
   * The child nearest the scrollport's centre.
   *
   * Measured from `getBoundingClientRect()` rather than `offsetLeft`, which was
   * wrong twice over: it is relative to `offsetParent`, and it ignores the
   * scroller's own padding. Rect centres are also direction-agnostic, so this is
   * correct in RTL with no sign handling.
   */
  #currentIndex(): number {
    const track = this.#track;
    const children = this.#trackChildren();
    if (!track || !children.length) return 0;
    const box = track.getBoundingClientRect();
    const centre = box.left + box.width / 2;
    let best = 0;
    let bestDistance = Infinity;
    children.forEach((child, i) => {
      const rect = child.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - centre);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    return best;
  }

  /**
   * Move by whole slides.
   *
   * The previous version scrolled by `clientWidth`, which overshoots whenever
   * `--carousel-slide-size` is not `100%`. Scrolling a specific slide into view
   * also honours `scroll-padding-inline` and the snap alignment for free, and
   * needs no RTL sign logic.
   */
  #step(delta: number): void {
    const children = this.#trackChildren();
    if (!children.length) return;
    const next = this.#currentIndex() + delta;
    const target = children[Math.max(0, Math.min(children.length - 1, next))];
    target?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  #scrollToFirstReal(): void {
    requestAnimationFrame(() => {
      const first = this.#slides[0];
      if (!first) return;
      this.#jumping = true;
      first.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' });
      requestAnimationFrame(() => {
        this.#jumping = false;
        this.#syncControls();
      });
    });
  }

  #onScroll = (): void => {
    if (this.#plan?.trackScrolled && !this.hasAttribute('data-scrolled')) {
      // One-way: the affordance is about the FIRST scroll, so re-showing the hint
      // when the visitor scrolls back to the start would re-offer advice they have
      // already acted on.
      if (hasScrolled(this.#track?.scrollLeft ?? 0)) this.setAttribute('data-scrolled', '');
    }
    this.#syncControls();
    // Last-resort settle for engines with neither `scrollsnapchange` nor
    // `scrollend`; both of those also call #settle, and it is idempotent.
    if (this.#settleTimer) clearTimeout(this.#settleTimer);
    this.#settleTimer = setTimeout(this.#settle, 150);
  };

  /**
   * Once the scroll has come to rest: if it rested on a clone, jump silently to
   * its real twin.
   *
   * The jump is a delta between two rects of identical content, so it is
   * invisible — and being a delta against a physical `scrollLeft`, it is correct
   * in RTL with no sign logic.
   */
  #settle = (): void => {
    if (this.#settleTimer) clearTimeout(this.#settleTimer);
    this.#settleTimer = null;
    this.#syncControls();

    const track = this.#track;
    if (!track || !this.#plan?.clone || this.#jumping) return;

    const children = this.#trackChildren();
    const snapped = children[this.#currentIndex()];
    const cloneOf = snapped?.getAttribute('data-carousel-clone');
    if (!snapped || cloneOf === null || cloneOf === undefined) return;

    const real = this.#slides[Number(cloneOf)];
    if (!real) return;

    const delta = real.getBoundingClientRect().left - snapped.getBoundingClientRect().left;
    if (!delta) return;

    this.#jumping = true;
    const previous = track.style.scrollBehavior;
    track.style.scrollBehavior = 'auto';
    track.scrollLeft += delta;
    requestAnimationFrame(() => {
      track.style.scrollBehavior = previous;
      this.#jumping = false;
      this.#syncControls();
    });
  };

  /** Active dot + button disabled states, from the current position. */
  #syncControls(): void {
    const children = this.#trackChildren();
    if (!children.length) return;
    const index = this.#currentIndex();
    const real = this.#plan?.clone ? index % this.#slides.length : index;

    this.#markers.forEach((marker, i) => marker.setAttribute('aria-selected', String(i === real)));
    // `silent: true` — this is syncing the active dot FROM a scroll that
    // already happened (dragging, autoplay, a button click); `RovingTabindex`
    // still owns the tabindex bookkeeping (one tab stop, arrow keys move
    // within it, matching the native `::scroll-marker-group`), but calling
    // `onMove` here would re-click the marker and re-trigger the very scroll
    // being synced from.
    const activeMarker = this.#markers[real];
    if (activeMarker) this.#roving.setActive(activeMarker, { focus: false, silent: true });

    if (this.#buttons.length && !this.#plan?.clone) {
      const [prev, next] = this.#buttons;
      if (prev) prev.disabled = index <= 0;
      if (next) next.disabled = index >= children.length - 1;
    }
  }

  /* ── Fallback controls ───────────────────────────────────────────────────── */

  /**
   * Real `<button>`s standing in for `::scroll-button()`.
   *
   * They carry the same classes `carousel.css` styles in its non-`@supports`
   * block, which declares the same properties as the native rule —
   * `carousel-parity.test.ts` holds the two to that. Logical direction words, not
   * left/right: "previous" is on the right in an RTL document.
   */
  #buildButtons(): void {
    const make = (
      kind: 'prev' | 'next',
      label: string,
      glyph: string,
      delta: number,
    ): HTMLButtonElement => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `carousel__button carousel__button--${kind}`;
      button.setAttribute('aria-label', label);
      button.textContent = glyph;
      button.addEventListener('click', () => this.#step(delta));
      return button;
    };
    // Glyphs match the native `content` values, and flip with the writing mode so
    // the chevron points the way the button travels.
    const rtl = getComputedStyle(this).direction === 'rtl';
    this.#buttons = [
      make('prev', 'Previous', rtl ? '›' : '‹', -1),
      make('next', 'Next', rtl ? '‹' : '›', 1),
    ];
    this.append(...this.#buttons);
  }

  /**
   * A real dot nav standing in for `::scroll-marker-group`.
   *
   * `tablist`/`tab` is the role pair the native scroll-marker group exposes, with
   * a roving tabindex, so the two paths sound the same to a screen reader. Only
   * the real slides get a dot — a clone is a duplicate of something already
   * reachable.
   */
  #buildMarkers(): void {
    const group = document.createElement('div');
    group.className = 'carousel__markers';
    group.setAttribute('role', 'tablist');
    group.setAttribute('aria-label', this.getAttribute('aria-label') ?? 'Slides');

    this.#markers = this.#slides.map((slide, i) => {
      const marker = document.createElement('button');
      marker.type = 'button';
      marker.className = 'carousel__marker';
      marker.setAttribute('role', 'tab');
      marker.setAttribute('aria-label', slideLabel(i, this.#slides.length));
      marker.setAttribute('aria-selected', String(i === 0));
      if (slide.id) marker.setAttribute('aria-controls', slide.id);
      marker.addEventListener('click', () => {
        slide.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      });
      return marker;
    });

    group.append(...this.#markers);
    this.append(group);
    this.#markerGroup = group;
    // Applies the initial tabindex (marker 0 = 0, the rest = -1) and wires the
    // keydown handling — arrow keys (both axes, wrapping — the dot nav has
    // always accepted Up/Down as well as Left/Right) and RTL-aware left/right
    // flipping, via the built-in linear decoder (`orientation: 'both'` in the
    // constructor).
    this.#roving.attach(group);
  }

  /**
   * Hide the hint when the strip does not overflow.
   *
   * "Scroll for more" over content that fits is a lie, and whether it fits changes
   * with the viewport — hence the ResizeObserver rather than a one-shot check.
   * With no JS a short carousel keeps the hint; `hint={false}` is the escape hatch.
   *
   * The track's `tabindex` is deliberately NOT pruned alongside it. A scroll
   * container that currently fits is still a scroll container, and `scrollWidth`
   * reads 0 before layout settles (a `display: none` ancestor, fonts still
   * loading) — so pruning would intermittently strip the keyboard route from a
   * carousel that does overflow, which is the one failure here with real
   * consequences.
   */
  #syncOverflow = (): void => {
    const track = this.#track;
    if (!track) return;
    const hint = this.querySelector<HTMLElement>(':scope > .carousel__hint');
    if (hint) hint.hidden = track.scrollWidth <= track.clientWidth + 1;
  };

  /* ── Autoplay ────────────────────────────────────────────────────────────── */

  #setupAutoplay(plan: CarouselPlan): void {
    this.#resolveAutoplayBtn();
    if (plan.play) {
      this.#startAutoplay();
    } else {
      this.#paused = true;
      this.setAttribute('aria-live', 'polite');
      this.#syncAutoplayBtn();
    }
    this.addEventListener('pointerenter', this.#pause);
    this.addEventListener('pointerleave', this.#resume);
    this.addEventListener('focusin', this.#pause);
    this.addEventListener('focusout', this.#resume);
  }

  #resolveAutoplayBtn(): void {
    const existing = this.querySelector<HTMLButtonElement>('[slot="autoplay"]');
    if (existing) {
      this.#autoplayBtn = existing;
      this.#ownsAutoplayBtn = false;
    } else {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'carousel__autoplay';
      // On the shell, not the track. Appended to the track it became a
      // slide-width grid column that the CSS then had to paper over.
      this.append(button);
      this.#autoplayBtn = button;
      this.#ownsAutoplayBtn = true;
    }
    this.#autoplayBtn.addEventListener('click', this.#toggleAutoplay);
    this.#syncAutoplayBtn();
  }

  #syncAutoplayBtn(): void {
    const button = this.#autoplayBtn;
    if (!button) return;
    button.setAttribute('aria-label', this.#paused ? 'Play' : 'Pause');
    button.setAttribute('aria-pressed', String(!this.#paused));
    if (this.#ownsAutoplayBtn) button.textContent = this.#paused ? '▶' : '⏸';
  }

  #startAutoplay(): void {
    if (this.#timer || this.autoplay <= 0) return;
    this.#paused = false;
    this.#timer = setInterval(() => this.#step(1), this.autoplay);
    // `off` while playing, so a screen reader is not narrating a slideshow the
    // visitor did not ask to hear; `polite` when paused, so manual navigation is.
    this.setAttribute('aria-live', 'off');
    this.#syncAutoplayBtn();
  }

  #stopAutoplay(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
  }

  #pause = (): void => {
    if (!this.#timer && this.#paused) return;
    this.#stopAutoplay();
    this.#paused = true;
    this.setAttribute('aria-live', 'polite');
    this.#syncAutoplayBtn();
  };

  #resume = (): void => {
    if (this.#reducedMotion) return;
    this.#startAutoplay();
  };

  #toggleAutoplay = (): void => {
    if (this.#paused) {
      // An explicit press outranks the media query for the rest of the session:
      // the visitor has asked for this specific animation.
      this.#reducedMotion = false;
      this.#startAutoplay();
    } else {
      this.#pause();
    }
  };
}

if (!customElements.get('wc-carousel')) {
  customElements.define('wc-carousel', WCCarousel);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-carousel': WCCarousel;
  }
}
