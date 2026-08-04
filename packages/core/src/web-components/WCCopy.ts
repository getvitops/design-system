import { css, type CSSResultGroup } from 'lit';
import { html } from '@lit-labs/signals';
import { BaseElement } from './BaseElement.js';

/**
 * Copy-to-clipboard web component.
 *
 * The copy button is hidden until the component is connected,
 * ensuring JS has executed and the Clipboard API is available.
 *
 * @example
 * ```html
 * <wc-copy value="text to copy">
 *   <span>Fallback text</span>
 * </wc-copy>
 * ```
 */

export class WCCopy extends BaseElement {
  static styles: CSSResultGroup = [
    BaseElement.styles,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }

      .copy__button {
        display: none;
        align-items: center;
        justify-content: center;
        min-inline-size: var(--copy-size, 2.5rem);
        min-block-size: var(--copy-size, 2.5rem);
        padding: var(--copy-padding, 0.5rem);
        background: var(--copy-bg, transparent);
        border: var(--copy-border, none);
        border-radius: var(--copy-radius, 0.375rem);
        cursor: pointer;
        transition:
          background-color 0.15s ease,
          transform 0.1s ease;
      }

      :host(wc-copy:defined) .copy__button {
        display: inline-flex;
      }

      .copy__button:hover {
        background: var(--copy-hover-bg, oklch(0.9 0 0));
      }

      .copy__button:active {
        transform: scale(0.95);
      }

      .copy__button:focus-visible {
        outline: 2px solid var(--copy-focus-color, oklch(0.6 0.2 250));
        outline-offset: 2px;
      }

      .copy__icon {
        inline-size: 1.25em;
        block-size: 1.25em;
        background-color: currentColor;
        mask-size: contain;
        mask-repeat: no-repeat;
        mask-position: center;
      }

      .copy__icon--copy {
        mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512'%3E%3Cpath d='M208 0H332.1c12.7 0 24.9 5.1 33.9 14.1l67.9 67.9c9 9 14.1 21.2 14.1 33.9V336c0 26.5-21.5 48-48 48H208c-26.5 0-48-21.5-48-48V48c0-26.5 21.5-48 48-48zM48 128h80v64H64V448H256V416h64v48c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V176c0-26.5 21.5-48 48-48z'/%3E%3C/svg%3E");
      }

      .copy__icon--success {
        mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512'%3E%3Cpath d='M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z'/%3E%3C/svg%3E");
        color: var(--copy-success-color, oklch(0.6 0.2 145));
      }
    `,
  ];

  static properties = {
    value: { type: String },
    label: { type: String },
    _copied: { type: Boolean, state: true },
  };

  // Reactive props are created by Lit from `static properties`; declare the
  // fields so TypeScript knows them without emitting shadowing class fields.
  declare value: string | undefined;
  declare label: string;
  declare _copied: boolean;

  constructor() {
    super();
    this.init();
  }

  init() {
    this.value = undefined;
    this.label = 'Copy to clipboard';
    this._copied = false;
  }

  private _timeoutId?: ReturnType<typeof setTimeout>;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
    }
  }

  private _handleCopy = async (): Promise<void> => {
    const value =
      this.value ??
      this.getSlottedNodes()
        .map((node) => node.textContent)
        .join('')
        .trim();
    if (value == null || value === '') return;
    console.log('copying value:', value);
    try {
      await navigator.clipboard.writeText(value);
      this._copied = true;

      // Reset after 2 seconds
      this._timeoutId = setTimeout(() => {
        this._copied = false;
      }, 2000);

      this.dispatchEvent(
        new CustomEvent('copy', {
          detail: { value: this.value },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (err) {
      console.error('Failed to copy:', err);
      this.dispatchEvent(
        new CustomEvent('copy-error', {
          detail: { error: err },
          bubbles: true,
          composed: true,
        }),
      );
    }
  };

  render() {
    const iconClass = this._copied
      ? 'copy__icon copy__icon--success'
      : 'copy__icon copy__icon--copy';
    const buttonLabel = this._copied ? 'Copied!' : this.label;

    return html`
      <slot></slot>
      <button
        class="copy__button"
        part="button"
        type="button"
        aria-label=${buttonLabel}
        @click=${this._handleCopy}
      >
        <span class=${iconClass} part="icon" aria-hidden="true"></span>
      </button>
    `;
  }
}

if (!customElements.get('wc-copy')) {
  customElements.define('wc-copy', WCCopy);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-copy': WCCopy;
  }
}
