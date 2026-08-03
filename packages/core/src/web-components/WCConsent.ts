/**
 * `<wc-consent>` — the consent banner.
 *
 * Pure progressive enhancement over slotted light-DOM markup: it renders nothing,
 * it *reveals and wires* what is already in the document. Ships `hidden`; shown
 * only while a choice is outstanding, or when something calls
 * `vitopsConsent.open()` (a "Cookie settings" control).
 *
 * **The no-JS behaviour is correct rather than degraded**, which is unusual enough
 * to be worth stating: with no JS the gate in `consent/runtime.ts` never runs, so
 * no gated tag ever loads and no non-essential cookie is ever set. There is
 * nothing to consent to, and the banner stays hidden. That is why this element is
 * allowed to start from `hidden` markup without breaking the tier-2 rule that a
 * web component must never render from empty — its fallback isn't empty, it's
 * *moot*.
 *
 * Written against `HTMLElement` with no Lit, like `WCThemeEditor`, because it
 * ships in the standalone `consent.js` bundle: a site that wants consent must not
 * be made to download a rendering framework to get it.
 *
 * @example
 * ```html
 * <wc-consent hidden>
 *   <form class="consent" popover="manual">
 *     <p>We use cookies to measure how the site is used.</p>
 *     <label><input type="checkbox" name="analytics" /> Analytics</label>
 *     <button type="button" data-consent-reject>Reject</button>
 *     <button type="button" data-consent-save>Save choices</button>
 *     <button type="button" data-consent-accept>Accept all</button>
 *   </form>
 * </wc-consent>
 * ```
 *
 * `popover="manual"`, not `auto`: light dismiss would let a stray click anywhere
 * on the page count as a decision.
 */
import { CONSENT_OPEN_EVENT, type ConsentApi } from '../consent/runtime.js';
import type { ConsentChoices, OptionalCategory } from '../consent/store.js';

const OPTIONAL: readonly OptionalCategory[] = ['analytics', 'marketing', 'preferences'];

export class WCConsent extends HTMLElement {
  #unsubscribe: (() => void) | undefined;

  get #api(): ConsentApi | undefined {
    return window.vitopsConsent;
  }

  /**
   * The banner itself — the `[popover]` element, when there is one.
   *
   * It is shown in the top layer rather than as a plain fixed element because any
   * ancestor with `container-type`, `transform`, `filter` or `contain` becomes the
   * containing block for a fixed descendant, and `body { container-type }` is
   * ordinary in a framework whose breakpoints are container queries. The top layer
   * has no containing-block chain to be trapped by.
   */
  get #panel(): HTMLElement | null {
    return this.querySelector<HTMLElement>('[popover]');
  }

  connectedCallback(): void {
    const api = this.#api;
    if (!api) return;

    // Popover is baseline, but a browser without it would leave the banner stuck
    // as an inert `[popover]` — visible to nobody and impossible to answer.
    // Dropping the attribute moves it onto the plain fixed-dock rule instead.
    const panel = this.#panel;
    if (panel && typeof panel.showPopover !== 'function') panel.removeAttribute('popover');

    // Opt out of the post-revoke reload if the author asked to.
    if (this.getAttribute('reload-on-revoke') === 'false') api.reloadOnRevoke = false;

    this.addEventListener('click', this.#onClick);
    // The fallback markup is a <form> so it is a coherent group for assistive
    // tech; nothing here ever submits it.
    this.addEventListener('submit', this.#onSubmit);
    document.addEventListener(CONSENT_OPEN_EVENT, this.#onOpen);

    this.#unsubscribe = api.subscribe(() => {
      if (api.needed()) this.#show();
      else this.#hide();
    });
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this.#onClick);
    this.removeEventListener('submit', this.#onSubmit);
    document.removeEventListener(CONSENT_OPEN_EVENT, this.#onOpen);
    this.#unsubscribe?.();
  }

  #onOpen = (): void => this.#show();

  #onSubmit = (event: Event): void => event.preventDefault();

  #show(): void {
    this.#sync();
    this.hidden = false;
    const panel = this.#panel;
    // Already-open is not an error worth surfacing: `open()` may fire while the
    // banner is up, and showPopover() throws on a second call.
    if (panel?.isConnected && !panel.matches(':popover-open')) panel.showPopover();
  }

  #hide(): void {
    this.#panel?.hidePopover?.();
    this.hidden = true;
  }

  /** Reflect the recorded choice onto the checkboxes before the banner is seen. */
  #sync(): void {
    const api = this.#api;
    if (!api) return;
    for (const category of OPTIONAL) {
      const input = this.querySelector<HTMLInputElement>(`input[name="${category}"]`);
      if (input) input.checked = api.granted(category);
    }
  }

  #onClick = (event: Event): void => {
    const api = this.#api;
    const button = (event.target as Element | null)?.closest?.(
      '[data-consent-accept],[data-consent-reject],[data-consent-save]',
    );
    if (!api || !button) return;
    event.preventDefault();

    if (button.hasAttribute('data-consent-accept')) api.acceptAll();
    else if (button.hasAttribute('data-consent-reject')) api.rejectAll();
    else api.set(this.#choices());

    this.#hide();
  };

  /**
   * Read the per-category checkboxes. A category with no checkbox in the markup
   * resolves to `false` rather than being left untouched: the visitor was shown a
   * form, and everything that form didn't offer them is something they haven't
   * agreed to.
   */
  #choices(): Partial<ConsentChoices> {
    const patch: Partial<ConsentChoices> = {};
    for (const category of OPTIONAL) {
      patch[category] =
        this.querySelector<HTMLInputElement>(`input[name="${category}"]`)?.checked === true;
    }
    return patch;
  }
}

if (!customElements.get('wc-consent')) {
  customElements.define('wc-consent', WCConsent);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-consent': WCConsent;
  }
}
