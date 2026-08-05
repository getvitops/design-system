/**
 * `<wc-consent>` — the consent banner.
 *
 * Pure progressive enhancement over slotted light-DOM markup: it renders nothing,
 * it *reveals and wires* what is already in the document. Ships `hidden`; shown
 * only when something has actually demanded a category the visitor hasn't
 * answered, or when something calls `vitopsConsent.open()` (a "Cookie settings"
 * control).
 *
 * **The banner asks about what asked for it, and nothing else.** The markup
 * carries a row per category the site could ever need — a build-time fact — but a
 * showing reveals only the rows currently demanded and undecided. So a site whose
 * analytics are cookieless never interrupts anyone, and a site whose only gated
 * thing is a theme toggle asks about preferences at the moment the visitor picks a
 * scheme, not on arrival. `vitopsConsent.open()` is the exception: someone who
 * went looking for their cookie settings gets every row.
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
 *     <label data-consent-row="analytics"><input type="checkbox" name="analytics" /> Analytics</label>
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
import {
  type ConsentChoices,
  decidedFor,
  type OptionalCategory,
  OPTIONAL_CATEGORIES,
} from '../consent/store.js';

/** Set on the form while a single category is on offer — see consent.css. */
const SINGLE_CLASS = 'consent--single';

type Mode = 'prompt' | 'settings';

export class WCConsent extends HTMLElement {
  #unsubscribe: (() => void) | undefined;
  #mode: Mode = 'prompt';
  #open = false;

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
      // A settings showing outranks a demand that lands mid-interaction: narrowing
      // the rows under someone who deliberately opened their cookie settings would
      // take away controls they came for.
      if (this.#open && this.#mode === 'settings') this.#sync();
      else if (api.needed()) this.#show('prompt');
      else this.#hide();
    });
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this.#onClick);
    this.removeEventListener('submit', this.#onSubmit);
    document.removeEventListener(CONSENT_OPEN_EVENT, this.#onOpen);
    this.#unsubscribe?.();
  }

  #onOpen = (): void => this.#show('settings');

  #onSubmit = (event: Event): void => event.preventDefault();

  /**
   * The row for a category.
   *
   * Falls back to the label wrapping the checkbox so hand-authored markup that
   * predates `data-consent-row` keeps working — the attribute is how the Astro
   * component marks rows, not a requirement of the element.
   */
  #row(category: OptionalCategory): HTMLElement | null {
    return (
      this.querySelector<HTMLElement>(`[data-consent-row="${category}"]`) ??
      this.#input(category)?.closest('label') ??
      null
    );
  }

  #input(category: OptionalCategory): HTMLInputElement | null {
    return this.querySelector<HTMLInputElement>(`input[name="${category}"]`);
  }

  /**
   * Which categories this showing is about — and therefore which rows are
   * revealed and which the resulting patch may speak for.
   *
   * A prompt covers exactly what was demanded and is still unanswered. Settings
   * covers everything the markup offers a row for, so the visitor can revisit a
   * choice nothing happens to be asking about right now.
   */
  #targets(mode: Mode): OptionalCategory[] {
    const api = this.#api;
    if (!api) return [];
    if (mode === 'settings') {
      const offered = OPTIONAL_CATEGORIES.filter((c) => this.#row(c));
      return offered.length ? offered : [...OPTIONAL_CATEGORIES];
    }
    const state = api.get();
    return OPTIONAL_CATEGORIES.filter((c) => api.demanded().includes(c) && !decidedFor(state, c));
  }

  #show(mode: Mode): void {
    const targets = this.#targets(mode);
    // Nothing to ask about — don't put up an empty banner.
    if (!targets.length) return;
    this.#mode = mode;
    this.#sync();
    this.hidden = false;
    this.#open = true;
    const panel = this.#panel;
    // Already-open is not an error worth surfacing: `open()` may fire while the
    // banner is up, and showPopover() throws on a second call.
    if (panel?.isConnected && !panel.matches(':popover-open')) panel.showPopover();
  }

  #hide(): void {
    this.#open = false;
    this.#panel?.hidePopover?.();
    this.hidden = true;
  }

  /**
   * Reveal the rows this showing is about, hide the rest, and reflect the recorded
   * choice onto their checkboxes before the banner is seen.
   */
  #sync(): void {
    const api = this.#api;
    if (!api) return;
    const targets = this.#targets(this.#mode);
    for (const category of OPTIONAL_CATEGORIES) {
      const row = this.#row(category);
      if (row) row.hidden = !targets.includes(category);
      const input = this.#input(category);
      if (input) input.checked = api.granted(category);
    }
    // One category is a yes/no question, and the two buttons already say it — the
    // checkbox would be a third control for the same decision.
    this.#panel?.classList.toggle(SINGLE_CLASS, targets.length < 2);
  }

  #onClick = (event: Event): void => {
    const api = this.#api;
    const button = (event.target as Element | null)?.closest?.(
      '[data-consent-accept],[data-consent-reject],[data-consent-save]',
    );
    if (!api || !button) return;
    event.preventDefault();

    const targets = this.#targets(this.#mode);
    if (button.hasAttribute('data-consent-accept')) api.set(this.#patch(targets, () => true));
    else if (button.hasAttribute('data-consent-reject')) api.set(this.#patch(targets, () => false));
    else api.set(this.#patch(targets, (c) => this.#input(c)?.checked === true));

    this.#hide();
  };

  /**
   * Build a patch covering exactly the categories this showing offered.
   *
   * Everything else is left out, which under the tri-state store means *still
   * unanswered* rather than refused. That distinction is the whole point: a
   * visitor accepting an analytics prompt has said nothing about preferences, and
   * recording a `false` there would silently foreclose a question they were never
   * asked. It is also why Accept goes through here rather than calling
   * `api.acceptAll()` — "accept" means accept what is on screen.
   */
  #patch(
    targets: OptionalCategory[],
    value: (category: OptionalCategory) => boolean,
  ): Partial<ConsentChoices> {
    const patch: Partial<ConsentChoices> = {};
    for (const category of targets) patch[category] = value(category);
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
