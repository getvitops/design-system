import { noChange } from 'lit';
import { BaseElement } from './BaseElement.js';
import {
  exactMatch,
  filterOptions,
  moveActive,
  statusText,
  type ComboOption,
} from './utils/combobox.js';
import { initFromLightDom } from './utils/upgrade.js';

/**
 * A text input with a filtered list of suggestions, as progressive enhancement over
 * `<input list>` + `<datalist>`.
 *
 * **The fallback is native autocomplete.** With no JS the browser's own datalist popup suggests
 * the options and the input submits whatever is typed, exactly as an `<input list>` always has.
 * Nothing here is a placeholder.
 *
 * ```html
 * <wc-combobox class="combobox">
 *   <input class="combobox__input" name="city" list="cities" />
 *   <datalist id="cities"><option value="Ottawa"></option><option value="Gatineau"></option></datalist>
 * </wc-combobox>
 * ```
 *
 * On upgrade it takes the `list` attribute off the input (so the browser's popup doesn't appear
 * beside ours), reads the options from the datalist and builds `.combobox__listbox` — the ARIA 1.2
 * combobox pattern with a listbox popup and `aria-activedescendant`, so DOM focus never leaves the
 * input. The datalist stays in the document, unused, as the source of truth for the options.
 *
 * Keys: Down/Up open the list and move through it (wrapping), Enter chooses the active option (and
 * does not submit the form), Escape closes the list and a second Escape clears the input, Tab
 * leaves. A free-typed value that matches nothing is kept: this is a suggestion list, not a
 * select, so what is typed is what is submitted. A polite live region says how many options match.
 *
 * Light DOM, because `.combobox`' CSS has to style both the fallback and the built list.
 *
 * @fires combobox-select `{ value, label }`, bubbles and composed, when an option is chosen.
 *
 * @fallback full `<input list>` and `<datalist>`
 */
export class WCCombobox extends BaseElement {
  static properties = {
    /** Text for the row shown when nothing matches. */
    emptyText: { type: String, attribute: 'empty-text' },
  };

  declare emptyText: string;

  override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Never let lit-html touch the input. */
  protected override render(): typeof noChange {
    return noChange;
  }

  static #counter = 0;

  #ready = false;
  #input: HTMLInputElement | null = null;
  #datalist: HTMLDataListElement | null = null;
  #listbox: HTMLUListElement | null = null;
  #status: HTMLElement | null = null;
  #shown: ComboOption[] = [];
  #active = -1;
  #open = false;
  #id = '';

  constructor() {
    super();
    this.emptyText = 'No matches';
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Here rather than in setup: a reconnect skips setup (it is guarded), and this listener is
    // removed on disconnect. Adding the same function twice is a no-op.
    document.addEventListener('pointerdown', this.#onOutside, true);
    initFromLightDom(this, () => this.#setup());
  }

  override disconnectedCallback(): void {
    document.removeEventListener('pointerdown', this.#onOutside, true);
    super.disconnectedCallback();
  }

  /* ── Setup ───────────────────────────────────────────────────────────────── */

  #setup(): boolean {
    if (this.#ready) return true;
    const input = this.querySelector<HTMLInputElement>('input');
    if (!input) return false;
    // The datalist is optional: without one this is just an input, and there is nothing to build.
    const datalist = input.list ?? this.querySelector<HTMLDataListElement>('datalist') ?? null;
    if (!datalist) return true;

    this.#id = this.id || `combobox-${++WCCombobox.#counter}`;
    this.#input = input;
    this.#datalist = datalist;

    // Take the browser's own popup away so there aren't two lists. The datalist stays, as the
    // options' source.
    input.removeAttribute('list');
    input.autocomplete = 'off';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');

    const listbox = document.createElement('ul');
    listbox.className = 'combobox__listbox';
    listbox.id = `${this.#id}-listbox`;
    listbox.setAttribute('role', 'listbox');
    listbox.hidden = true;
    this.#listbox = listbox;
    input.setAttribute('aria-controls', listbox.id);

    const status = document.createElement('div');
    status.className = 'sr-only';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    this.#status = status;

    input.after(listbox, status);
    this.classList.add('combobox--enhanced');

    input.addEventListener('input', this.#onInput);
    input.addEventListener('focus', this.#onFocus);
    input.addEventListener('keydown', this.#onKeyDown);
    listbox.addEventListener('pointerdown', this.#onListPointer);

    this.#ready = true;
    return true;
  }

  #options(): ComboOption[] {
    const out: ComboOption[] = [];
    for (const option of Array.from(this.#datalist?.options ?? [])) {
      const value = option.value;
      if (!value) continue;
      // The attribute, then the text: `option.label` is not consistent about which it returns.
      const label = option.getAttribute('label') || option.textContent?.trim() || value;
      out.push({ value, label });
    }
    return out;
  }

  /* ── Rendering the list ──────────────────────────────────────────────────── */

  #render(): void {
    const listbox = this.#listbox;
    const input = this.#input;
    if (!listbox || !input) return;
    this.#shown = filterOptions(this.#options(), input.value);
    this.#active = -1;
    listbox.replaceChildren();

    if (this.#shown.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'combobox__empty';
      empty.setAttribute('role', 'presentation');
      empty.textContent = this.emptyText;
      listbox.append(empty);
    } else {
      this.#shown.forEach((option, i) => {
        const li = document.createElement('li');
        li.className = 'combobox__option';
        li.id = `${this.#id}-option-${i}`;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        li.dataset.value = option.value;
        li.textContent = option.label;
        listbox.append(li);
      });
    }
    input.removeAttribute('aria-activedescendant');
    if (this.#status) {
      this.#status.textContent = statusText(this.#shown.length, input.value, this.emptyText);
    }
  }

  #setOpen(open: boolean): void {
    if (!this.#listbox || !this.#input) return;
    this.#open = open;
    this.#listbox.hidden = !open;
    this.#input.setAttribute('aria-expanded', String(open));
    if (!open) {
      this.#active = -1;
      this.#input.removeAttribute('aria-activedescendant');
      for (const li of Array.from(this.#listbox.querySelectorAll('[role="option"]'))) {
        li.setAttribute('aria-selected', 'false');
      }
      if (this.#status) this.#status.textContent = '';
    }
  }

  #setActive(index: number): void {
    const listbox = this.#listbox;
    const input = this.#input;
    if (!listbox || !input) return;
    this.#active = index;
    const items = Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"]'));
    items.forEach((li, i) => li.setAttribute('aria-selected', String(i === index)));
    const current = items[index];
    if (current) {
      input.setAttribute('aria-activedescendant', current.id);
      current.scrollIntoView?.({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  #choose(option: ComboOption): void {
    const input = this.#input;
    if (!input) return;
    input.value = option.value;
    // The form and any listener see the same events a typed value would produce.
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    this.#setOpen(false);
    this.dispatchEvent(
      new CustomEvent('combobox-select', {
        detail: { value: option.value, label: option.label },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /* ── Events ──────────────────────────────────────────────────────────────── */

  #onInput = (): void => {
    this.#render();
    this.#setOpen(true);
  };

  #onFocus = (): void => {
    // Reveal the choices on arrival, but never re-open over a choice just made.
    if (!this.#open) {
      this.#render();
      this.#setOpen(true);
    }
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!this.#open) {
          this.#render();
          this.#setOpen(true);
        }
        // Counted AFTER the list is built: the first Down from closed has to land on an option.
        this.#setActive(
          moveActive(this.#active, event.key === 'ArrowDown' ? 1 : -1, this.#shown.length),
        );
        return;
      }
      case 'Enter': {
        const option = this.#shown[this.#active];
        if (this.#open && option) {
          // Choosing is not submitting.
          event.preventDefault();
          this.#choose(option);
        }
        return;
      }
      case 'Escape': {
        if (this.#open) {
          event.preventDefault();
          this.#setOpen(false);
        } else if (this.#input?.value) {
          event.preventDefault();
          this.#input.value = '';
          this.#input.dispatchEvent(new Event('input', { bubbles: true }));
          this.#setOpen(false);
        }
        return;
      }
      case 'Tab':
        this.#setOpen(false);
        return;
      default:
    }
  };

  /** Pointer on an option chooses it; `preventDefault` keeps focus in the input so it doesn't blur-close first. */
  #onListPointer = (event: PointerEvent): void => {
    event.preventDefault();
    const li = (event.target as Element | null)?.closest<HTMLElement>('[role="option"]');
    if (!li) return;
    const option = this.#shown.find((o) => o.value === li.dataset.value);
    if (option) this.#choose(option);
  };

  #onOutside = (event: Event): void => {
    if (this.#open && !this.contains(event.target as Node)) this.#setOpen(false);
  };

  /** The option the current input text equals, if any — for a consumer that wants to know. */
  get match(): ComboOption | undefined {
    return exactMatch(this.#options(), this.#input?.value ?? '');
  }
}

if (!customElements.get('wc-combobox')) {
  customElements.define('wc-combobox', WCCombobox);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-combobox': WCCombobox;
  }
}
