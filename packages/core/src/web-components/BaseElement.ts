import { LitElement, css, type CSSResultGroup } from 'lit';
import { SignalWatcher, html } from '@lit-labs/signals';

const SignalWatcherLitElement = SignalWatcher(LitElement) as typeof LitElement;

export abstract class BaseElement extends SignalWatcherLitElement {
  static styles: CSSResultGroup = [];

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
