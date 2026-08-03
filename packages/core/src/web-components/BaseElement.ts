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

/** include for non-abstract classes: */
// if (!customElements.get('base-element')) {
//   customElements.define('base-element', BaseElement);
// }

// declare global {
//   interface HTMLElementTagNameMap {
//     'base-element': BaseElement;
//   }
// }
