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
import { initFromLightDom } from './utils/upgrade.js';

export class WCMarquee extends BaseElement {
  /** Light DOM: the framework CSS has to reach the slotted content. */
  protected override createRenderRoot() {
    return this;
  }

  /** The author's first `.marquee__content`; every other one is ours. */
  #source: HTMLElement | null = null;
  #observer?: ResizeObserver;
  /** Last measurement `#fill` acted on, so a no-op resize does no work. */
  #last?: { one: number; gap: number; container: number; vertical: boolean };

  override connectedCallback() {
    super.connectedCallback();
    // `.marquee__content` may not be parsed yet — see initFromLightDom.
    initFromLightDom(this, () => this.#setup());
  }

  /** Take over the CSS-only marquee if the content track is present. */
  #setup(): boolean {
    if (this.#source) return true;
    const tracks = this.querySelectorAll<HTMLElement>('.marquee__content');
    const source = tracks[0];
    if (!source) return false;
    this.#source = source;

    // Every other authored `.marquee__content` is the no-JS fallback's
    // duplicate — with JS running, `#fill` produces the copies, so mark the
    // rest as clones and let the existing cleanup in `#fill` remove them.
    for (const track of Array.from(tracks).slice(1)) {
      track.dataset.marqueeClone = '';
    }

    // Release the 100% floor the CSS-only path needs: from here the copy is its
    // own width and we supply enough copies to cover the track.
    this.style.setProperty('--_marquee-min', 'auto');

    this.#fill();
    // The host's own size is one reason to re-measure; the source's is
    // another — an image finishing load or a font swapping in changes the
    // content's natural width with no host resize at all, which is what left
    // a stale (too-large) --_marquee-distance and a gap in the track.
    this.#observer = new ResizeObserver(() => this.#fill());
    this.#observer.observe(this);
    this.#observer.observe(source);
    return true;
  }

  override disconnectedCallback() {
    this.#observer?.disconnect();
    super.disconnectedCallback();
  }

  #fill() {
    const src = this.#source;
    if (!src) return;

    // Measure BEFORE touching clones: `src` is a direct reference to the one
    // element that never gets removed, so its size reads the same whether the
    // old clones are still sitting beside it or not (they're `flex-shrink: 0`
    // siblings in an `overflow: hidden` row/column, not something `src`
    // shares layout with) — and reading it first is what makes the "nothing
    // changed" case below a true no-op instead of a wipe-and-not-replace.
    //
    // `.marquee--vertical` animates on the block axis (`marquee.css`); read
    // the axis off the computed style rather than the class, so it holds
    // however column direction ended up set.
    const style = getComputedStyle(this);
    const vertical = style.flexDirection.startsWith('column');
    const gap = Number.parseFloat(vertical ? style.rowGap : style.columnGap) || 0;
    const srcRect = src.getBoundingClientRect();
    const one = vertical ? srcRect.height : srcRect.width;
    if (one <= 0) return;

    const rect = this.getBoundingClientRect();
    const container = vertical ? rect.height : rect.width;

    if (
      this.#last &&
      this.#last.one === one &&
      this.#last.gap === gap &&
      this.#last.container === container &&
      this.#last.vertical === vertical
    ) {
      return;
    }
    this.#last = { one, gap, container, vertical };

    // Now drop the previous pass's clones and rebuild for the new measurement.
    for (const el of this.querySelectorAll('[data-marquee-clone]')) el.remove();

    // The animation travels exactly one copy + one gap, so the copy leaving the
    // start is replaced by an identical one arriving — which is what makes the
    // seam indistinguishable from any other gap. Publish the distance in px
    // rather than `100%`, because `100%` of a NATURAL-width copy is that copy,
    // and the keyframe needs the same number the layout used.
    this.style.setProperty('--_marquee-distance', `${one + gap}px`);

    // Coverage: after the first translate (one copy + one gap) the remaining
    // content must still span the container, i.e. reach `container + gap`
    // measured from the start of the first copy — bare `container` comes up
    // one gap short at the far edge. +1 so a copy is always entering as
    // another leaves, never a bare track.
    const need = Math.ceil((container + gap) / (one + gap)) + 1;
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
