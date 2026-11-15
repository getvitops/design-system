import { noChange } from 'lit';
import { BaseElement } from './BaseElement.js';
import {
  CONTRAST_CONSENT_EVENT,
  CONTRAST_STORAGE_KEY,
  choiceFor,
  initialChecked,
  readChoice,
  shouldApplyOnLoad,
  type ContrastChoice,
} from './utils/contrast-toggle.js';
import { initFromLightDom } from './utils/upgrade.js';
// Type-only, and it must stay that way — see `WCColorSchemeToggle`.
import type {} from '../consent/runtime.js';

/**
 * The high-contrast switch (WCAG technique G174), enhancing a plain checkbox.
 *
 * **The fallback is the control.** `<label class="contrast-toggle"><input type="checkbox"> …</label>`
 * works with no JS at all: `patterns/contrast-toggle.css` re-points the colour tokens with
 * `:root:has(.contrast-toggle input:checked)`, and `@media (prefers-contrast: more)` already does it
 * for visitors whose OS asks. What this element adds is what a stylesheet cannot do — start the box
 * checked to match the OS, and remember the choice across pages — by setting `data-contrast` on
 * `<html>` (`more` or `standard`; `standard` is how a visitor opts out of the media query).
 *
 * Light DOM, so the framework CSS styles the fallback and the upgraded result identically. Never
 * renders from empty: an element with no checkbox inside builds one rather than showing nothing.
 *
 * Remembering the choice goes through the `preferences` consent category when the site has a gate,
 * exactly as `<wc-color-scheme-toggle>` does; applying it to the current page never waits. Reading a
 * stored value is not gated — it was either consented to or predates the gate.
 *
 * @fires contrast-change - detail `{ contrast: 'more' | 'standard' }`
 *
 * @fallback full a labelled checkbox, which the CSS already acts on
 *
 * @example
 * ```html
 * <wc-contrast-toggle>
 *   <label class="contrast-toggle"><input type="checkbox" /> High contrast</label>
 * </wc-contrast-toggle>
 * ```
 */
export class WCContrastToggle extends BaseElement {
  override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override render(): typeof noChange {
    return noChange;
  }

  #input: HTMLInputElement | null = null;

  static readStored(): ContrastChoice | null {
    try {
      return readChoice(localStorage.getItem(CONTRAST_STORAGE_KEY));
    } catch {
      return null;
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener(CONTRAST_CONSENT_EVENT, this.#onConsent, {
      signal: this.connectionSignal,
    });
    initFromLightDom(this, () => this.#setup());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#input?.removeEventListener('change', this.#onChange);
    this.#input = null;
    this.#tries = 0;
  }

  #tries = 0;

  #setup(): boolean {
    if (this.#input) return true;
    this.#tries++;
    let input = this.querySelector<HTMLInputElement>('input[type="checkbox"]');
    // An element upgraded during insertion is connected before its children exist, so the first
    // look can find nothing in markup that is about to arrive. Building a checkbox then would
    // double it; only build on the retry (see `initFromLightDom`), when "nothing" is real.
    if (!input && this.#tries < 2) return false;
    if (!input) {
      const label = document.createElement('label');
      label.className = 'contrast-toggle';
      input = document.createElement('input');
      input.type = 'checkbox';
      label.append(input, ' High contrast');
      this.append(label);
    }
    this.#input = input;

    const stored = WCContrastToggle.readStored();
    input.checked = initialChecked(stored, matchMedia('(prefers-contrast: more)').matches);
    if (shouldApplyOnLoad(stored)) document.documentElement.dataset.contrast = stored;
    input.addEventListener('change', this.#onChange);
    return true;
  }

  #onChange = (): void => {
    if (!this.#input) return;
    const contrast = choiceFor(this.#input.checked);
    document.documentElement.dataset.contrast = contrast;
    this.#persist(contrast);
    this.dispatchEvent(
      new CustomEvent('contrast-change', { detail: { contrast }, bubbles: true, composed: true }),
    );
  };

  /** No gate on the page means no gate, not deny; see `WCColorSchemeToggle._persist`. */
  #persist(contrast: ContrastChoice): void {
    const consent = window.vitopsConsent;
    if (!consent || consent.require('preferences')) this.#write(contrast);
  }

  #onConsent = (): void => {
    if (window.vitopsConsent?.granted('preferences') && this.#input)
      this.#write(choiceFor(this.#input.checked));
  };

  #write(contrast: ContrastChoice): void {
    try {
      localStorage.setItem(CONTRAST_STORAGE_KEY, contrast);
    } catch {
      /* storage unavailable: the toggle still works for this page */
    }
  }
}

if (!customElements.get('wc-contrast-toggle')) {
  customElements.define('wc-contrast-toggle', WCContrastToggle);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-contrast-toggle': WCContrastToggle;
  }
}
