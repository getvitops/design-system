import { noChange, type PropertyValues } from 'lit';
import { BaseElement } from './BaseElement.js';
import {
  formatValue,
  isFormatType,
  nextRefreshDelay,
  parseInstant,
  parseNumber,
  type FormatOptions,
  type FormatType,
} from './utils/format.js';
import { initFromLightDom } from './utils/upgrade.js';

/**
 * Presents a machine value the way the reader expects: a relative time ("5 minutes ago"), a date,
 * a number, a percentage or a currency, in the reader's locale.
 *
 * **The fallback is the value already in the markup.** The server writes a real `<time>` or
 * `<data>` with human text inside, and that is what no-JS readers, search engines and a
 * pre-upgrade paint all see. The element only replaces the text, from the machine value, and
 * keeps the original in `title` so the absolute value stays reachable.
 *
 * ```html
 * <wc-format type="relative">
 *   <time datetime="2026-11-03T14:05:00Z">November 3, 2026</time>
 * </wc-format>
 * <wc-format type="currency" currency="CAD">
 *   <data value="1234.5">$1,234.50 CAD</data>
 * </wc-format>
 * ```
 *
 * A relative time is re-rendered when its text would change (at the next minute or hour boundary,
 * not on a fixed poll) and not at all while the tab is hidden; it catches up when the tab returns.
 * Anything it can't parse or format (no date, a currency with no code) is left exactly as authored.
 *
 * Locale: the `locale` attribute, else the nearest `lang`, else the browser's.
 *
 * Inline, like `<wc-counter>`: it wraps one inline `<time>` or `<data>`, so the default display is
 * already right for what it holds.
 */
export class WCFormat extends BaseElement {
  static properties = {
    type: { type: String, reflect: true },
    locale: { type: String },
    dateStyle: { type: String, attribute: 'date-style' },
    timeStyle: { type: String, attribute: 'time-style' },
    currency: { type: String },
    compact: { type: Boolean },
  };

  declare type: FormatType;
  declare locale: string | undefined;
  declare dateStyle: FormatOptions['dateStyle'];
  declare timeStyle: FormatOptions['timeStyle'];
  declare currency: string | undefined;
  declare compact: boolean;

  override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Never let lit-html touch the slotted `<time>` / `<data>`. */
  protected override render(): typeof noChange {
    return noChange;
  }

  #ready = false;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.type = 'relative';
    this.locale = undefined;
    this.dateStyle = undefined;
    this.timeStyle = undefined;
    this.currency = undefined;
    this.compact = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('visibilitychange', this.#onVisibility);
    initFromLightDom(this, () => this.#setup());
  }

  override disconnectedCallback(): void {
    document.removeEventListener('visibilitychange', this.#onVisibility);
    this.#clearTimer();
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (this.#ready && changed.size > 0) this.#render();
  }

  #source(): HTMLElement | null {
    return this.querySelector<HTMLElement>('time[datetime], data[value]');
  }

  #setup(): boolean {
    if (this.#ready) return true;
    const source = this.#source();
    if (!source) return false;
    // Keep what the server wrote, once, so the absolute value stays reachable and a re-render
    // never loses it.
    if (!source.hasAttribute('title') && source.textContent?.trim()) {
      source.setAttribute('title', source.textContent.trim());
      source.dataset.formatFallback = '';
    }
    this.#ready = true;
    this.#render();
    return true;
  }

  #locale(): string | undefined {
    return this.locale || this.closest('[lang]')?.getAttribute('lang') || undefined;
  }

  #render(): void {
    this.#clearTimer();
    const source = this.#source();
    if (!source || !isFormatType(this.type)) return;

    const date = parseInstant(source.getAttribute('datetime'));
    const number = parseNumber(source.getAttribute('value'));
    const now = Date.now();
    const text = formatValue(this.type, { date, number }, now, {
      locale: this.#locale(),
      dateStyle: this.dateStyle,
      timeStyle: this.timeStyle,
      currency: this.currency,
      compact: this.compact,
    });
    // Nothing usable: the authored text stays, untouched.
    if (text === null) return;
    if (source.textContent !== text) source.textContent = text;

    if (this.type === 'relative' && date && !document.hidden) {
      this.#timer = setTimeout(() => this.#render(), nextRefreshDelay(now, date.getTime()));
    }
  }

  #onVisibility = (): void => {
    if (!this.#ready) return;
    // Hidden: stop. Visible again: the text may be many minutes stale, so catch up now.
    if (document.hidden) this.#clearTimer();
    else this.#render();
  };

  #clearTimer(): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
  }
}

if (!customElements.get('wc-format')) {
  customElements.define('wc-format', WCFormat);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-format': WCFormat;
  }
}
