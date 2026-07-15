import { css, type CSSResultGroup, type PropertyValues } from 'lit';
import { html } from '@lit-labs/signals';
import { BaseElement } from './BaseElement.js';

interface FieldEntry {
  id: string;
  value: string;
  isDefault: boolean;
}

// Declaration merging for TypeScript - properties initialized in init()
export interface WCMultiField {
  name?: string;
  type: string;
  placeholder: string;
  protectDefaults: boolean;
  min: number;
  max: number;
  addLabel: string;
  clearLabel: string;
  deleteLabel: string;
  _entries: FieldEntry[];
  _initialized: boolean;
  _idCounter: number;
}

/**
 * Multi-field input web component for managing multiple values.
 *
 * Enables adding, deleting, and clearing multiple field entries.
 * The `protect-defaults` attribute prevents deletion of initial entries.
 *
 * @element multi-field
 * @slot add-label - Custom label for add button
 * @slot clear-label - Custom label for clear button
 * @slot delete-label - Custom label for delete buttons
 *
 * @csspart container - The main container
 * @csspart entries - The entries list container
 * @csspart entry - Individual entry wrapper
 * @csspart input - The input field
 * @csspart delete-button - Delete button for each entry
 * @csspart actions - Container for add/clear buttons
 * @csspart add-button - The add button
 * @csspart clear-button - The clear button
 *
 * @cssprop --multi-field-gap - Gap between entries (default: 0.5rem)
 * @cssprop --multi-field-input-padding - Input padding (default: 0.5rem 0.75rem)
 * @cssprop --multi-field-border-radius - Border radius (default: 0.375rem)
 * @cssprop --multi-field-border-color - Border color (default: oklch(0.8 0 0))
 * @cssprop --multi-field-focus-color - Focus ring color (default: oklch(0.6 0.2 250))
 *
 * @fires multi-field-change - Fired when entries change, detail: { values: string[] }
 * @fires multi-field-add - Fired when an entry is added
 * @fires multi-field-delete - Fired when an entry is deleted, detail: { value: string }
 * @fires multi-field-clear - Fired when entries are cleared
 *
 * @example
 * ```html
 * <multi-field name="emails" placeholder="Enter email" protect-defaults>
 *   <input type="email" value="default@example.com">
 * </multi-field>
 * ```
 */
export class WCMultiField extends BaseElement {
  static styles: CSSResultGroup = [
    BaseElement.styles,
    css`
      :host {
        --_gap: var(--multi-field-gap, 0.5rem);
        --_input-padding: var(--multi-field-input-padding, 0.5rem 0.75rem);
        --_radius: var(--multi-field-border-radius, 0.375rem);
        --_border-color: var(--multi-field-border-color, oklch(0.8 0 0));
        --_focus-color: var(--multi-field-focus-color, oklch(0.6 0.2 250));
        --_button-bg: var(--multi-field-button-bg, oklch(0.95 0 0));
        --_button-hover-bg: var(--multi-field-button-hover-bg, oklch(0.9 0 0));
        --_delete-color: var(--multi-field-delete-color, oklch(0.6 0.2 25));
        --_delete-hover-bg: var(--multi-field-delete-hover-bg, oklch(0.95 0.05 25));

        display: block;
      }

      .container {
        display: flex;
        flex-direction: column;
        gap: var(--_gap);
      }

      .entries {
        display: flex;
        flex-direction: column;
        gap: var(--_gap);
      }

      .entry {
        display: flex;
        align-items: center;
        gap: var(--_gap);
      }

      .entry__input {
        flex: 1;
        padding: var(--_input-padding);
        border: 1px solid var(--_border-color);
        border-radius: var(--_radius);
        font: inherit;
        background: transparent;
      }

      .entry__input:focus-visible {
        outline: 2px solid var(--_focus-color);
        outline-offset: 2px;
      }

      .entry__input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .entry__delete {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-inline-size: 2rem;
        min-block-size: 2rem;
        padding: 0.25rem;
        background: transparent;
        border: 1px solid transparent;
        border-radius: var(--_radius);
        color: var(--_delete-color);
        cursor: pointer;
        transition: background-color 0.15s ease;
      }

      .entry__delete:hover:not(:disabled) {
        background: var(--_delete-hover-bg);
      }

      .entry__delete:focus-visible {
        outline: 2px solid var(--_focus-color);
        outline-offset: 2px;
      }

      .entry__delete:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }

      .entry__delete-icon {
        inline-size: 1rem;
        block-size: 1rem;
        background-color: currentColor;
        mask-size: contain;
        mask-repeat: no-repeat;
        mask-position: center;
        mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512'%3E%3Cpath d='M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z'/%3E%3C/svg%3E");
      }

      .actions {
        display: flex;
        gap: var(--_gap);
        flex-wrap: wrap;
      }

      .action-button {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.5rem 0.75rem;
        background: var(--_button-bg);
        border: 1px solid var(--_border-color);
        border-radius: var(--_radius);
        font: inherit;
        font-size: 0.875em;
        cursor: pointer;
        transition: background-color 0.15s ease;
      }

      .action-button:hover:not(:disabled) {
        background: var(--_button-hover-bg);
      }

      .action-button:focus-visible {
        outline: 2px solid var(--_focus-color);
        outline-offset: 2px;
      }

      .action-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .action-button__icon {
        inline-size: 0.875rem;
        block-size: 0.875rem;
        background-color: currentColor;
        mask-size: contain;
        mask-repeat: no-repeat;
        mask-position: center;
      }

      .action-button__icon--add {
        mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512'%3E%3Cpath d='M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z'/%3E%3C/svg%3E");
      }

      .action-button__icon--clear {
        mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 576 512'%3E%3Cpath d='M290.7 57.4L57.4 290.7c-25 25-25 65.5 0 90.5l80 80c12 12 28.3 18.7 45.3 18.7H288h9.4H512c17.7 0 32-14.3 32-32s-14.3-32-32-32H387.9L518.6 285.3c25-25 25-65.5 0-90.5L381.3 57.4c-25-25-65.5-25-90.5 0zM297.4 416H288l-105.4 0-80-80L227.3 211.3 364.7 348.7 297.4 416z'/%3E%3C/svg%3E");
      }

      /* Hidden slot for initial values */
      .initial-slot {
        display: none;
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .entry__delete,
        .action-button {
          transition: none;
        }
      }
    `,
  ];

  static properties = {
    name: { type: String },
    type: { type: String },
    placeholder: { type: String },
    protectDefaults: { type: Boolean, attribute: 'protect-defaults' },
    min: { type: Number },
    max: { type: Number },
    addLabel: { type: String, attribute: 'add-label' },
    clearLabel: { type: String, attribute: 'clear-label' },
    deleteLabel: { type: String, attribute: 'delete-label' },
    _entries: { type: Array, state: true },
    _initialized: { type: Boolean, state: true },
  };

  constructor() {
    super();
    this.init();
  }

  init() {
    this.name = undefined;
    this.type = 'text';
    this.placeholder = '';
    this.protectDefaults = false;
    this.min = 1;
    this.max = 0;
    this.addLabel = 'Add';
    this.clearLabel = 'Clear';
    this.deleteLabel = 'Delete';
    this._entries = [];
    this._initialized = false;
    this._idCounter = 0;
  }

  private _generateId(): string {
    return `entry-${++this._idCounter}`;
  }

  private _initializeFromSlot(): void {
    if (this._initialized) return;

    const slotted = this.getSlottedNodes(['input']);
    const initialEntries: FieldEntry[] = [];

    for (const node of slotted) {
      const input = node as HTMLInputElement;
      const value = input.value || input.getAttribute('value') || '';
      initialEntries.push({
        id: this._generateId(),
        value,
        isDefault: true,
      });
    }

    // Ensure minimum entries
    while (initialEntries.length < this.min) {
      initialEntries.push({
        id: this._generateId(),
        value: '',
        isDefault: false,
      });
    }

    // If no entries at all, add one empty entry
    if (initialEntries.length === 0) {
      initialEntries.push({
        id: this._generateId(),
        value: '',
        isDefault: false,
      });
    }

    this._entries = initialEntries;
    this._initialized = true;
  }

  firstUpdated(): void {
    this._initializeFromSlot();
  }

  willUpdate(changed: PropertyValues): void {
    if (changed.has('min') && this._initialized) {
      // Ensure minimum entries when min changes
      while (this._entries.length < this.min) {
        this._entries = [
          ...this._entries,
          {
            id: this._generateId(),
            value: '',
            isDefault: false,
          },
        ];
      }
    }
  }

  private _getValues(): string[] {
    return this._entries.map((entry) => entry.value);
  }

  private _dispatchChange(): void {
    this.dispatchEvent(
      new CustomEvent('multi-field-change', {
        detail: { values: this._getValues() },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleInput(id: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this._entries = this._entries.map((entry) =>
      entry.id === id ? { ...entry, value: input.value } : entry,
    );
    this._dispatchChange();
  }

  private _handleAdd = (): void => {
    if (this.max > 0 && this._entries.length >= this.max) return;

    const newEntry: FieldEntry = {
      id: this._generateId(),
      value: '',
      isDefault: false,
    };

    this._entries = [...this._entries, newEntry];

    this.dispatchEvent(
      new CustomEvent('multi-field-add', {
        bubbles: true,
        composed: true,
      }),
    );
    this._dispatchChange();

    // Focus the new input after render
    this.updateComplete.then(() => {
      const inputs = this.renderRoot.querySelectorAll<HTMLInputElement>('.entry__input');
      const lastInput = inputs[inputs.length - 1];
      lastInput?.focus();
    });
  };

  private _handleDelete(id: string): void {
    const entry = this._entries.find((e) => e.id === id);
    if (!entry) return;

    // Prevent deletion if protected and is a default entry
    if (this.protectDefaults && entry.isDefault) return;

    // Prevent going below minimum
    if (this._entries.length <= this.min) return;

    const deletedValue = entry.value;
    this._entries = this._entries.filter((e) => e.id !== id);

    this.dispatchEvent(
      new CustomEvent('multi-field-delete', {
        detail: { value: deletedValue },
        bubbles: true,
        composed: true,
      }),
    );
    this._dispatchChange();
  }

  private _handleClear = (): void => {
    let newEntries: FieldEntry[];

    if (this.protectDefaults) {
      // Keep default entries, remove non-defaults
      newEntries = this._entries.filter((e) => e.isDefault);
    } else {
      // Remove all entries
      newEntries = [];
    }

    // Ensure minimum entries
    while (newEntries.length < this.min) {
      newEntries.push({
        id: this._generateId(),
        value: '',
        isDefault: false,
      });
    }

    this._entries = newEntries;

    this.dispatchEvent(
      new CustomEvent('multi-field-clear', {
        bubbles: true,
        composed: true,
      }),
    );
    this._dispatchChange();
  };

  private _canDelete(entry: FieldEntry): boolean {
    // Cannot delete if at minimum
    if (this._entries.length <= this.min) return false;
    // Cannot delete protected defaults
    if (this.protectDefaults && entry.isDefault) return false;
    return true;
  }

  private _canAdd(): boolean {
    if (this.max > 0 && this._entries.length >= this.max) return false;
    return true;
  }

  private _canClear(): boolean {
    if (this.protectDefaults) {
      // Can clear if there are non-default entries
      return this._entries.some((e) => !e.isDefault);
    }
    // Can clear if there are entries beyond minimum
    return this._entries.length > this.min;
  }

  render() {
    return html`
      <div class="container" part="container">
        <div class="initial-slot">
          <slot @slotchange=${this._initializeFromSlot}></slot>
        </div>

        <div class="entries" part="entries" role="list">
          ${this._entries.map(
            (entry) => html`
              <div class="entry" part="entry" role="listitem">
                <input
                  class="entry__input"
                  part="input"
                  type=${this.type}
                  name=${this.name ? `${this.name}[]` : ''}
                  placeholder=${this.placeholder}
                  .value=${entry.value}
                  @input=${(e: Event) => this._handleInput(entry.id, e)}
                  ?data-default=${entry.isDefault}
                />
                <button
                  type="button"
                  class="entry__delete"
                  part="delete-button"
                  aria-label=${this.deleteLabel}
                  ?disabled=${!this._canDelete(entry)}
                  @click=${() => this._handleDelete(entry.id)}
                >
                  <span class="entry__delete-icon" aria-hidden="true"></span>
                </button>
              </div>
            `,
          )}
        </div>

        <div class="actions" part="actions">
          <button
            type="button"
            class="action-button"
            part="add-button"
            ?disabled=${!this._canAdd()}
            @click=${this._handleAdd}
          >
            <span class="action-button__icon action-button__icon--add" aria-hidden="true"></span>
            <slot name="add-label">${this.addLabel}</slot>
          </button>
          <button
            type="button"
            class="action-button"
            part="clear-button"
            ?disabled=${!this._canClear()}
            @click=${this._handleClear}
          >
            <span class="action-button__icon action-button__icon--clear" aria-hidden="true"></span>
            <slot name="clear-label">${this.clearLabel}</slot>
          </button>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('multi-field')) {
  customElements.define('multi-field', WCMultiField);
}

declare global {
  interface HTMLElementTagNameMap {
    'multi-field': WCMultiField;
  }
}
