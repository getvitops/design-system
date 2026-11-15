import { noChange } from 'lit';
import { BaseElement } from './BaseElement.js';
import { focusTargetAfterRemoval } from './utils/focus-return.js';

/**
 * Light-DOM dismissable wrapper — progressive enhancement for any dismissable UI
 * (banner, notification, alert, tag). Wrap the content; a click on any descendant
 * marked `[data-dismiss]` (e.g. the close button) fades the element out and
 * removes it, dispatching a cancelable `dismiss` event first. An optional
 * `duration` (ms) auto-dismisses; `exit` (ms) sets the fade-out time (skipped
 * under prefers-reduced-motion).
 *
 * The countdown PAUSES while the pointer is over the element or keyboard focus is inside it, and
 * resumes with the time that was left (WCAG 2.2.1 Timing Adjustable: content that disappears on a
 * timer must give a reader time to finish). It does not announce itself: a toast inserted after
 * load needs a live region that already existed (`role="status"` on a container that was in the
 * page first), because a region that arrives together with its text is not announced reliably.
 *
 * When the dismissed element held focus (a keyboard user pressed the close button), focus
 * moves to the next focusable element after it, or the nearest one before, instead of
 * falling to `<body>` and losing the reader's place.
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
 *
 * @fallback partial stays visible; the close button needs JS
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
  /** Milliseconds of the countdown still to run, so a pause resumes rather than restarts. */
  #remaining = 0;
  #startedAt = 0;

  constructor() {
    super();
    this.duration = 0;
    this.exit = 200;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('click', this.#onClick);
    this.addEventListener('pointerenter', this.#pauseCountdown);
    this.addEventListener('pointerleave', this.#resumeCountdown);
    this.addEventListener('focusin', this.#onFocusIn);
    this.addEventListener('focusout', this.#onFocusOut);
    this.#remaining = this.duration;
    this.#startCountdown();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('click', this.#onClick);
    this.removeEventListener('pointerenter', this.#pauseCountdown);
    this.removeEventListener('pointerleave', this.#resumeCountdown);
    this.removeEventListener('focusin', this.#onFocusIn);
    this.removeEventListener('focusout', this.#onFocusOut);
    this.#clearCountdown();
  }

  #startCountdown(): void {
    if (this.#remaining <= 0 || this.#timer) return;
    this.#startedAt = Date.now();
    this.#timer = setTimeout(() => this.dismiss(), this.#remaining);
  }

  #clearCountdown(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
  }

  #pauseCountdown = (): void => {
    if (!this.#timer) return;
    this.#clearCountdown();
    this.#remaining = Math.max(0, this.#remaining - (Date.now() - this.#startedAt));
  };

  #resumeCountdown = (): void => this.#startCountdown();

  /** Keyboard focus only: a mouse click on the close button also focuses it, and that is not a reason to wait. */
  #onFocusIn = (event: FocusEvent): void => {
    let keyboard = true;
    try {
      keyboard = !(event.target instanceof Element) || event.target.matches(':focus-visible');
    } catch {
      /* unsupported selector: treat as keyboard focus */
    }
    if (keyboard) this.#pauseCountdown();
  };

  #onFocusOut = (event: FocusEvent): void => {
    // Focus moving between two controls inside it is not focus leaving.
    if (event.relatedTarget instanceof Node && this.contains(event.relatedTarget)) return;
    this.#resumeCountdown();
  };

  #onClick = (event: Event): void => {
    const target = event.target as Element | null;
    if (target?.closest('[data-dismiss]')) {
      event.preventDefault();
      this.dismiss();
    }
  };

  /** Remove, handing focus to a neighbour first if it was inside (see the class docblock). */
  #detach(): void {
    const active = this.ownerDocument.activeElement;
    const target = active && this.contains(active) ? focusTargetAfterRemoval(this) : null;
    this.remove();
    target?.focus();
  }

  /** Dispatch `dismiss` (cancelable); if not prevented, fade out + remove. */
  dismiss(): void {
    this.#clearCountdown();
    this.#remaining = 0;
    const event = new CustomEvent('dismiss', { bubbles: true, cancelable: true });
    if (!this.dispatchEvent(event)) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.exit <= 0 || reduced) {
      this.#detach();
      return;
    }

    this.style.transition = `opacity ${this.exit}ms ease, scale ${this.exit}ms ease`;
    this.style.opacity = '0';
    this.style.scale = '0.97';
    let removed = false;
    const finish = (): void => {
      if (removed) return;
      removed = true;
      this.#detach();
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
