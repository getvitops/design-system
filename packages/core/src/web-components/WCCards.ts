import { noChange } from 'lit';
import { BaseElement } from './BaseElement.js';
import { INTERACTIVE, distance, shouldNavigate } from './utils/card-click.js';
import { initFromLightDom } from './utils/upgrade.js';

/**
 * Whole-card click that keeps the card's text selectable.
 *
 * Wrap a container of cards; a click on a card's whitespace follows that card's own
 * link, while a click-and-drag selects text as normal.
 *
 * **Why this is an element and not CSS.** `.stretched-link` (patterns/anchor-link.css)
 * does the same job with no JS by covering the card with a link's `::after` — and
 * that overlay necessarily receives the pointer-drag, so the card's text can no
 * longer be selected. The two are alternatives, not layers: with an overlay present
 * this element has nothing to do. Pick by whether selectable text matters.
 *
 * **Why it wraps the list instead of being the card.** A `<ul>` may contain only
 * `<li>` and script-supporting elements, so `<ul><wc-card>` is invalid — and it
 * would make the custom element the grid item, losing both the `<li>` and the list
 * semantics. `<li><wc-card>` inverts the problem: the `<li>` is the grid item, so
 * the element is not, and a `.subgrid`'s row tracks stop reaching the card's
 * tranches. One instance governing many marked descendants is also cheaper than one
 * per card, and is how `consent/runtime.ts` already governs `[data-consent]`.
 *
 * **No `href` attribute.** The URL is already on the card's real link; taking it
 * here too would be two declarations of one fact with nothing comparing them.
 * Forwarding with `link.click()` also inherits `target`, `rel`, `download` and the
 * browser's own modifier-key handling rather than reimplementing them.
 *
 * Fallback with no JS: the card's link is an ordinary link and works. Only the
 * click-anywhere convenience is missing, and `[data-card-link]`'s pointer cursor is
 * applied by this element, so the affordance never appears without the behaviour.
 *
 * @example
 * ```html
 * <wc-cards>
 *   <ul class="subgrid subgrid-cols-3" role="list">
 *     <li class="card subgrid-card">
 *       <p class="font-eyebrow">Service</p>
 *       <p class="font-heading"><a class="link" href="/a">Title</a></p>
 *       <p>Blurb…</p>
 *     </li>
 *   </ul>
 * </wc-cards>
 * ```
 */
export class WCCards extends BaseElement {
  static properties = {
    /** Selector for the cards this governs. */
    item: { type: String, reflect: true },
  };

  /** Light DOM — the framework's `.card` / `.subgrid` CSS must style the slotted markup. */
  override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Never let lit-html touch the slotted cards. */
  protected override render(): typeof noChange {
    return noChange;
  }

  declare item: string;
  #cards: HTMLElement[] = [];
  #origin: { x: number; y: number } | undefined;

  constructor() {
    super();
    this.item = '.card';
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // The cards may not be parsed yet — see initFromLightDom. Listeners are attached
    // by #setup, not here: they must come AFTER the defer-to-enclosing check, or a
    // nested pair both listen, both see the same bubbling click, and both forward it.
    initFromLightDom(this, () => this.#setup());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('pointerdown', this.#onPointerDown);
    this.removeEventListener('click', this.#onClick);
    for (const card of this.#cards) card.removeAttribute('data-card-link');
    this.#cards = [];
  }

  #setup(): boolean {
    // Defer entirely to an enclosing <wc-cards>.
    //
    // `<Cards />` emits its own <wc-cards>, so a consumer who reasonably guesses
    // `<wc-cards><Cards /></wc-cards>` nests two. Both would govern the same cards
    // and both would forward the same click. `parentElement` rather than `this`,
    // since `this.closest()` matches self; returning true also cancels the retry.
    if (this.parentElement?.closest('wc-cards')) return true;
    if (this.#cards.length) return true; // already set up

    const cards = [...this.querySelectorAll<HTMLElement>(this.item)];
    if (!cards.length) return false;
    // Only cards that actually hold a link are marked. A card with no link has no
    // shortcut to offer, and giving it a pointer cursor would be a lie.
    this.#cards = cards.filter((card) => this.#linkFor(card));
    if (!this.#cards.length) return true; // cards, but nothing to forward to
    for (const card of this.#cards) card.setAttribute('data-card-link', '');
    // Same references every time, so a retry cannot double-add and
    // disconnectedCallback can remove them.
    this.addEventListener('pointerdown', this.#onPointerDown);
    this.addEventListener('click', this.#onClick);
    return true;
  }

  /**
   * The link a click on this card should follow.
   *
   * `[data-card-link-target]` wins, so a card with several links can name its
   * primary one; otherwise the first link in document order, which for a card built
   * the documented way is the heading.
   */
  #linkFor(card: HTMLElement): HTMLAnchorElement | null {
    return (
      card.querySelector<HTMLAnchorElement>('a[href][data-card-link-target]') ??
      card.querySelector<HTMLAnchorElement>('a[href]')
    );
  }

  #onPointerDown = (event: PointerEvent): void => {
    this.#origin = { x: event.clientX, y: event.clientY };
  };

  #onClick = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    const card = target?.closest<HTMLElement>('[data-card-link]');
    if (!card || !this.contains(card)) return;

    const link = this.#linkFor(card);
    // The click landed on the card's own link already — let it be, or we would
    // forward it to itself.
    if (link && target?.closest('a[href]') === link) return;

    const decision = shouldNavigate({
      // No origin means the click did not come from a pointer press we saw — a
      // synthesised click, or a keyboard activation on some descendant. Treat it as
      // no travel, since the interactive/platform guards still apply.
      moved: this.#origin ? distance(this.#origin, { x: event.clientX, y: event.clientY }) : 0,
      onInteractive: Boolean(target?.closest(INTERACTIVE)),
      platformHandled:
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0,
      hasLink: Boolean(link),
    });
    this.#origin = undefined;
    if (!decision || !link) return;

    // Forward to the real link rather than assigning location, so target/rel/
    // download and the browser's own handling all still apply.
    link.click();
  };
}

if (!customElements.get('wc-cards')) {
  customElements.define('wc-cards', WCCards);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-cards': WCCards;
  }
}
