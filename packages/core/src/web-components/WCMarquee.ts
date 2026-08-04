/**
 * Marquee — fills the track with as many copies of the content as it takes.
 *
 * Tier-2, and it earns it: "how many copies cover this container" is a
 * measurement, and CSS cannot measure.
 *
 * The CSS-only pattern gets a seamless loop by giving each `.marquee__content`
 * `min-inline-size: 100%` and translating by exactly its own width. That works,
 * but when the items are narrower than the track the copy is *padded* to 100% —
 * so the leftover space lands at the end of every copy and the seam gap comes
 * out wider than the gaps between items. Consistent spacing needs the copy to be
 * its natural width, and enough copies to cover the track.
 *
 *   <wc-marquee class="marquee">
 *     <div class="marquee__content">
 *       <span class="marquee__item">…</span>
 *     </div>
 *   </wc-marquee>
 *
 * Fallback: with no JS this is an unknown tag wrapping the author's markup, and
 * `.marquee` still scrolls exactly as it does today — author two copies by hand
 * and it is seamless, author one and it scrolls off. The element only ever makes
 * the spacing right; it is never what makes the thing work.
 */
import { BaseElement } from './BaseElement.js';

export class WCMarquee extends BaseElement {
  /** Light DOM: the framework CSS has to reach the slotted content. */
  protected override createRenderRoot() {
    return this;
  }

  /** The author's first `.marquee__content`; every other one is ours. */
  #source: HTMLElement | null = null;
  #observer?: ResizeObserver;

  override connectedCallback() {
    super.connectedCallback();
    this.#source = this.querySelector<HTMLElement>('.marquee__content');
    if (!this.#source) return;

    // Release the 100% floor the CSS-only path needs: from here the copy is its
    // own width and we supply enough copies to cover the track.
    this.style.setProperty('--_marquee-min', 'auto');

    this.#fill();
    this.#observer = new ResizeObserver(() => this.#fill());
    this.#observer.observe(this);
  }

  override disconnectedCallback() {
    this.#observer?.disconnect();
    super.disconnectedCallback();
  }

  #fill() {
    const src = this.#source;
    if (!src) return;

    // Drop previous clones before measuring, or each pass measures the last.
    for (const el of this.querySelectorAll('[data-marquee-clone]')) el.remove();

    const gap = Number.parseFloat(getComputedStyle(this).columnGap) || 0;
    const one = src.getBoundingClientRect().width;
    if (one <= 0) return;

    // The animation travels exactly one copy + one gap, so the copy leaving the
    // start is replaced by an identical one arriving — which is what makes the
    // seam indistinguishable from any other gap. Publish the distance in px
    // rather than `100%`, because `100%` of a NATURAL-width copy is that copy,
    // and the keyframe needs the same number the layout used.
    this.style.setProperty('--_marquee-distance', `${one + gap}px`);

    // +1 so a copy is always entering as another leaves, never a bare track.
    const need = Math.ceil(this.getBoundingClientRect().width / (one + gap)) + 1;
    for (let i = 0; i < need; i++) {
      const clone = src.cloneNode(true) as HTMLElement;
      clone.dataset.marqueeClone = '';
      // The list is decorative once repeated; a screen reader should hear it once.
      clone.setAttribute('aria-hidden', 'true');
      this.append(clone);
    }
  }
}

if (!customElements.get('wc-marquee')) {
  customElements.define('wc-marquee', WCMarquee);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-marquee': WCMarquee;
  }
}
