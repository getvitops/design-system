import { noChange } from 'lit';
import { BaseElement } from './BaseElement.js';

/**
 * Light-DOM dismissable wrapper — progressive enhancement for any dismissable UI
 * (banner, notification, alert, chip). Wrap the content; a click on any descendant
 * marked `[data-dismiss]` (e.g. the close button) fades the element out and
 * removes it, dispatching a cancelable `dismiss` event first. An optional
 * `duration` (ms) auto-dismisses; `exit` (ms) sets the fade-out time (skipped
 * under prefers-reduced-motion).
 *
 * Light DOM (no shadow root) so the wrapped component's framework CSS applies
 * directly and the close button sits in normal flow. Without JS the markup still
 * renders — the close control simply does nothing until the element upgrades.
 *
 * @example
 * ```html
 * <wc-dismissable>
 *   <div class="banner banner--dismissible">
 *     <div class="banner__content">Heads up!</div>
 *     <button class="banner__close" data-dismiss aria-label="Dismiss">✕</button>
 *   </div>
 * </wc-dismissable>
 * ```
 */
export class WCDismissable extends BaseElement {
  static properties = {
    duration: { type: Number, reflect: true },
    exit: { type: Number },
  };

  /** Light DOM — keep the wrapped component's CSS + normal flow. */
  override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Never let lit-html touch our light-DOM children. */
  protected override render(): typeof noChange {
    return noChange;
  }

  declare duration: number;
  declare exit: number;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.duration = 0;
    this.exit = 200;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('click', this.#onClick);
    if (this.duration > 0) this.#timer = setTimeout(() => this.dismiss(), this.duration);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('click', this.#onClick);
    if (this.#timer) clearTimeout(this.#timer);
  }

  #onClick = (event: Event): void => {
    const target = event.target as Element | null;
    if (target?.closest('[data-dismiss]')) {
      event.preventDefault();
      this.dismiss();
    }
  };

  /** Dispatch `dismiss` (cancelable); if not prevented, fade out + remove. */
  dismiss(): void {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }
    const event = new CustomEvent('dismiss', { bubbles: true, cancelable: true });
    if (!this.dispatchEvent(event)) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.exit <= 0 || reduced) {
      this.remove();
      return;
    }

    this.style.transition = `opacity ${this.exit}ms ease, scale ${this.exit}ms ease`;
    this.style.opacity = '0';
    this.style.scale = '0.97';
    let removed = false;
    const finish = (): void => {
      if (removed) return;
      removed = true;
      this.remove();
    };
    this.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, this.exit + 50); // fallback if transitionend doesn't fire
  }
}

if (!customElements.get('wc-dismissable')) {
  customElements.define('wc-dismissable', WCDismissable);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-dismissable': WCDismissable;
  }
}
