import { noChange } from 'lit';
import { BaseElement } from './BaseElement.js';
import { holdSubmit, scriptSrc, validSiteKey } from './utils/turnstile.js';
import { initFromLightDom } from './utils/upgrade.js';

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  remove(widgetId: string): void;
  reset(widgetId: string): void;
}

const READY_HOOK = '__vitopsTurnstileReady';
let loading: Promise<TurnstileApi> | undefined;

/** One script load shared by every instance on the page. */
function loadTurnstile(): Promise<TurnstileApi> {
  const existing = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
  if (existing) return Promise.resolve(existing);
  return (loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    (window as unknown as Record<string, unknown>)[READY_HOOK] = () =>
      resolve((window as unknown as { turnstile: TurnstileApi }).turnstile);
    const script = document.createElement('script');
    script.src = scriptSrc(READY_HOOK);
    script.async = true;
    script.onerror = () => {
      loading = undefined; // allow a later interaction to retry
      reject(new Error('turnstile script failed to load'));
    };
    document.head.append(script);
  }));
}

/**
 * Cloudflare Turnstile spam check for a form, loaded only once the visitor starts using it.
 *
 * **Why a web component, not an inline script.** Loading a third-party script on first
 * interaction is behaviour, so by the tier rule it belongs here, and the block that renders
 * it stays pure markup. It also keeps the page free of an inline script a Content Security
 * Policy would need a hash for.
 *
 * **The fallback is honest, not decorative.** With no JS the slotted paragraph explains that
 * the spam check needs JavaScript and offers another way to reach the site. Whether the
 * form still submits is the server's decision, not this element's: `createConversionRoute`'s
 * `turnstile.required` option decides what a missing token means.
 *
 * **No request until the visitor touches the form.** The Cloudflare script (and its iframe)
 * load on the first `focusin`/`pointerdown`/`input` inside the surrounding `<form>`. A visitor
 * who only reads the page makes no request to challenges.cloudflare.com. Cloudflare recommends
 * loading as early as possible; that trade is made deliberately, for privacy, and a managed
 * challenge needs only the seconds a person takes to fill a field.
 *
 * Turnstile is treated as a `necessary` service (it exists to protect the form the visitor is
 * submitting), so it is not behind the consent gate — see the form block's documentation.
 *
 * If a visitor submits before the token has arrived, the submit is held and replayed once it
 * does, rather than posting an empty token.
 *
 * @example
 * ```html
 * <wc-turnstile sitekey="0x4AAAAAAA…">
 *   <p>This form needs JavaScript for its spam check. Email us instead.</p>
 * </wc-turnstile>
 * ```
 *
 * @fallback partial a paragraph saying the spam check needs JS
 */
export class WCTurnstile extends BaseElement {
  /** Light DOM — the framework's form CSS must style the fallback and status text. */
  override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Never let lit-html touch the slotted markup. */
  protected override render(): typeof noChange {
    return noChange;
  }

  #form: HTMLFormElement | null = null;
  #host: HTMLElement | null = null;
  #started = false;
  #live = false;
  #token = '';
  #wantsSubmit = false;
  #widgetId: string | undefined;
  #fallback: HTMLElement | null = null;
  #status: HTMLElement | null = null;
  #box: HTMLElement | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    initFromLightDom(this, () => this.#setup());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#teardown();
  }

  #setup(): boolean {
    if (this.#live || this.#form) return true;
    const form = this.closest('form');
    if (!form) return false;
    const key = this.getAttribute('sitekey');
    // An invalid key leaves the fallback in place: the honest state is "no spam check".
    if (!validSiteKey(key)) return true;

    this.#form = form;
    this.#fallback = this.querySelector<HTMLElement>('[data-turnstile-fallback]');
    for (const type of ['focusin', 'pointerdown', 'input'] as const)
      form.addEventListener(type, this.#start, { once: true, passive: true });
    form.addEventListener('submit', this.#onSubmit);
    this.#live = true;
    // Hide the no-JS explanation only once JS has genuinely taken over.
    this.#fallback?.setAttribute('hidden', '');

    this.#box = document.createElement('div');
    this.#box.className = 'turnstile__widget';
    this.#status = document.createElement('p');
    this.#status.className = 'form-group__helper turnstile__status';
    this.#status.setAttribute('role', 'status');
    this.#status.hidden = true;
    this.append(this.#box, this.#status);
    return true;
  }

  #teardown(): void {
    if (!this.#form) return;
    for (const type of ['focusin', 'pointerdown', 'input'] as const)
      this.#form.removeEventListener(type, this.#start);
    this.#form.removeEventListener('submit', this.#onSubmit);
    if (this.#widgetId)
      (window as unknown as { turnstile?: TurnstileApi }).turnstile?.remove(this.#widgetId);
    this.#form = null;
    this.#live = false;
    this.#started = false;
    this.#widgetId = undefined;
    this.#box?.remove();
    this.#status?.remove();
    this.#fallback?.removeAttribute('hidden');
  }

  #start = (): void => {
    if (this.#started) return;
    this.#started = true;
    const sitekey = this.getAttribute('sitekey')!;
    loadTurnstile().then(
      (api) => {
        if (!this.isConnected || !this.#box) return;
        this.#widgetId = api.render(this.#box, {
          sitekey,
          callback: (token: string) => {
            this.#token = token;
            this.#say('');
            if (this.#wantsSubmit) {
              this.#wantsSubmit = false;
              this.#form?.requestSubmit();
            }
          },
          'expired-callback': () => {
            this.#token = '';
          },
          'error-callback': () => {
            this.#token = '';
            this.#say('The spam check could not run. Reload the page, or contact us another way.');
          },
        });
      },
      () => {
        this.#started = false;
        this.#say('The spam check could not load. Check your connection and try again.');
      },
    );
  };

  #onSubmit = (event: Event): void => {
    if (!holdSubmit({ live: this.#live, token: this.#token })) return;
    // The token hasn't arrived yet. Posting now would send none; wait for it instead.
    event.preventDefault();
    this.#wantsSubmit = true;
    this.#say('Checking that you are human. Your message will send in a moment.');
    this.#start();
  };

  #say(message: string): void {
    if (!this.#status) return;
    this.#status.textContent = message;
    this.#status.hidden = !message;
  }
}

if (!customElements.get('wc-turnstile')) {
  customElements.define('wc-turnstile', WCTurnstile);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-turnstile': WCTurnstile;
  }
}
