import { LitElement, css, type CSSResultGroup } from 'lit';
import { SignalWatcher, html } from '@lit-labs/signals';

const SignalWatcherLitElement = SignalWatcher(LitElement) as typeof LitElement;

export abstract class BaseElement extends SignalWatcherLitElement {
  static styles: CSSResultGroup = [];

  #connection: AbortController | undefined;

  /**
   * An `AbortSignal` that lives exactly as long as this element is connected: aborted in
   * `disconnectedCallback`, and a fresh one on the next connect.
   *
   * Pass it as `{ signal }` when listening on something OUTSIDE the element (`document`,
   * `window`, a media query), so teardown is one mechanism rather than an add/remove pair that
   * can drift apart. `connectedCallback` can run again after a move or re-insert, so read this
   * getter inside `connectedCallback` — never cache it in a field or constructor.
   *
   * Do NOT use it for listeners on the element's own descendants that are attached once in a
   * guarded `#setup()`. Those die with the element, and a reconnect deliberately skips setup, so
   * aborting them on disconnect would leave a reconnected element dead.
   */
  protected get connectionSignal(): AbortSignal {
    return (this.#connection ??= new AbortController()).signal;
  }

  override disconnectedCallback(): void {
    this.#connection?.abort();
    this.#connection = undefined;
    super.disconnectedCallback();
  }

  protected getSlottedNodes(names: string[] = []): HTMLElement[] {
    const slot = this.shadowRoot?.querySelector('slot');
    if (!slot) return [];
    const assignedElements = slot.assignedNodes({ flatten: true }) as HTMLElement[];
    if (names.length === 0) {
      return assignedElements;
    }
    return assignedElements.filter((el) => names.includes(el.tagName.toLowerCase()));
  }
}

/**
 * Include for non-abstract classes. The tag MUST be `wc-*` prefixed — that is a
 * rule, not a convention, and `tiers.test.ts` asserts it over every
 * `customElements.define` in this directory. This block is the template people
 * copy, so it shows the prefix.
 */
// if (!customElements.get('wc-base-element')) {
//   customElements.define('wc-base-element', BaseElement);
// }

// declare global {
//   interface HTMLElementTagNameMap {
//     'wc-base-element': BaseElement;
//   }
// }
