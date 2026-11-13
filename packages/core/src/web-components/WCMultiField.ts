import { freshEntry, nextIndex, rowIdentity, scrubRow } from './utils/repeat.js';
import { initFromLightDom } from './utils/upgrade.js';

const ROW = '.field__row';
const CONTROL = 'input:not([type="hidden"]), select, textarea';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Add and remove copies of a field, or of a whole fieldset.
 *
 * **The fallback is the markup you wrote.** Light DOM, no shadow root, so the framework's form CSS
 * applies and every control is a real, named, native control that submits and validates with the
 * form. With no JS it is simply the field(s) on the page.
 *
 * **A repeated field** (the original use): children that are, or hold, a control.
 *
 * ```html
 * <wc-multifield name="emails" type="email" placeholder="Another address" min="1" max="5">
 *   <input type="email" value="ada@example.com">
 * </wc-multifield>
 * ```
 *
 * Each child is an entry. Controls with no `name` take `name` + `[]`, so the values arrive as a list.
 * `type` / `placeholder` fill in controls that don't set their own.
 *
 * **A repeated fieldset** (what `renderProjectionHtml` writes for a keyed map): entries are
 * `.field__row` elements, normally open `<details>` with a `<summary class="field__row-title">` that
 * follows the row's key and a `.field__row-body` of fields named `…$map.N.$key`. The last row is
 * blank (`data-blank`) so a visitor with no JS can add one by filling it in; emptying a row's key
 * drops it. On upgrade the blank row becomes the template. A new row is a scrubbed copy at the next
 * free index (indices are a rendering detail: the form codec keys rows by `$key`), and a blocked
 * submit unfolds the row it is about.
 *
 * Attributes: `min` (default 1 for fields, 0 for fieldsets), `max` (0 = no limit), `protect-defaults`
 * (the entries present on load cannot be removed), `add-label`, `delete-label`, `clear-label` (adds a
 * Clear button; always shown for fields), `item-label` (names an entry in a summary and in what is
 * announced), `name`, `type`, `placeholder`. Add and Clear are disabled at their limits. A change is
 * announced in a polite live region, and the new entry takes focus.
 *
 * Plain `HTMLElement`, no Lit. Styling hooks: the `--multi-field-gap` custom property.
 *
 * @fires multi-field-change `{ action, count, values }` (`values` for fields), bubbles, on any change.
 * @fires multi-field-add bubbles, when an entry is added.
 * @fires multi-field-delete `{ value }`, bubbles, when an entry is removed.
 * @fires multi-field-clear bubbles, when Clear empties the list.
 * @fires input bubbles, so a form-level listener (`<wc-config-form>`) revalidates and re-reads.
 *
 * @fallback full the authored native controls, which submit with the form
 */
export class WCMultiField extends HTMLElement {
  #ready = false;
  #rows = false;
  #template: HTMLElement | null = null;
  #base = '';
  #templateIndex = 0;
  #next = 0;
  #serial = 0;
  #container: HTMLElement | null = null;
  #actions: HTMLElement | null = null;
  #add: HTMLButtonElement | null = null;
  #clear: HTMLButtonElement | null = null;
  #status: HTMLElement | null = null;
  readonly #defaults = new Set<HTMLElement>();

  connectedCallback(): void {
    initFromLightDom(this, () => this.#setup());
  }

  /** The entries now on the page (the template is not one). */
  get entries(): HTMLElement[] {
    const selector = this.#rows ? ROW : '.multifield__entry';
    // An entry of a multifield nested inside one of this one's entries is that one's, not this one's.
    return Array.from(this.querySelectorAll<HTMLElement>(selector)).filter(
      (entry) => entry.closest('wc-multifield') === this,
    );
  }

  /** The current values of a repeated field, one per entry. */
  get values(): string[] {
    return this.entries.map((entry) => entry.querySelector<Control>(CONTROL)?.value ?? '');
  }

  /** Add an entry as the visitor would. Returns it, or `null` at `max`. */
  add(): HTMLElement | null {
    return this.#addEntry(true);
  }

  get #min(): number {
    const attr = this.getAttribute('min');
    if (attr !== null && Number.isFinite(Number(attr))) return Math.max(0, Number(attr));
    return this.#rows ? 0 : 1;
  }

  get #max(): number {
    const attr = Number(this.getAttribute('max'));
    return Number.isFinite(attr) && attr > 0 ? attr : 0;
  }

  get #protect(): boolean {
    return this.hasAttribute('protect-defaults');
  }

  get #noun(): string {
    return this.getAttribute('item-label') ?? 'item';
  }

  /* ── Setup ───────────────────────────────────────────────────────────────── */

  #setup(): boolean {
    if (this.#ready) return true;
    const ok = this.querySelector(ROW) ? this.#setupRows() : this.#setupFields();
    if (!ok) return false;

    const actions = document.createElement('div');
    actions.className = 'multifield__actions';
    const add = this.#button('add', this.getAttribute('add-label') ?? 'Add');
    actions.append(add);
    if (!this.#rows || this.hasAttribute('clear-label')) {
      this.#clear = this.#button('clear', this.getAttribute('clear-label') ?? 'Clear');
      actions.append(this.#clear);
    }
    this.#status = document.createElement('p');
    this.#status.className = 'field__status';
    this.#status.setAttribute('role', 'status');
    actions.append(this.#status);
    this.#add = add;
    this.#actions = actions;
    this.#container!.append(actions);

    // At least `min` entries to start with.
    while (this.entries.length < this.#min) if (!this.#addEntry(false)) break;
    this.#refresh();

    this.addEventListener('click', this.#onClick);
    this.addEventListener('input', this.#onInput);
    this.addEventListener('change', this.#onInput);
    // `invalid` does not bubble: capture it, and unfold the row a blocked submit is about.
    this.addEventListener('invalid', this.#onInvalid, true);

    this.#ready = true;
    this.setAttribute('data-ready', '');
    return true;
  }

  /** A keyed map's rows: the blank one becomes the template. */
  #setupRows(): boolean {
    this.#rows = true;
    const all = this.entries;
    if (all.length === 0) return false;
    const source = all.find((row) => row.hasAttribute('data-blank')) ?? all[all.length - 1]!;
    const identity = rowIdentity(source);
    if (!identity) {
      this.#rows = false;
      return false;
    }
    this.#base = identity.base;
    this.#templateIndex = identity.index;
    this.#container = source.parentElement;
    // The blank row's own index is the first free one: it is about to leave the page.
    this.#next = nextIndex(all.filter((row) => !row.hasAttribute('data-blank')));

    const template = source.cloneNode(true) as HTMLElement;
    scrubRow(template, identity.base, identity.index, identity.index);
    template.removeAttribute('data-blank');
    this.#template = template;
    if (source.hasAttribute('data-blank')) source.remove();

    for (const row of this.entries) this.#enhanceRow(row);
    return true;
  }

  /** A repeated field: each child that is or holds a control is an entry. */
  #setupFields(): boolean {
    const children = Array.from(this.children).filter(
      (child) => child.matches(CONTROL) || child.querySelector(CONTROL),
    ) as HTMLElement[];
    if (children.length === 0) return false;

    const list = document.createElement('div');
    list.className = 'multifield__entries';
    list.setAttribute('role', 'list');
    this.insertBefore(list, children[0]!);
    this.#container = this;
    for (const child of children) {
      let entry = child;
      if (child.matches(CONTROL)) {
        entry = document.createElement('div');
        child.replaceWith(entry);
        entry.append(child);
      }
      entry.classList.add('multifield__entry');
      entry.setAttribute('role', 'listitem');
      list.append(entry);
      this.#fill(entry);
      this.#defaults.add(entry);
    }
    const template = this.entries[0]!.cloneNode(true) as HTMLElement;
    freshEntry(template, 0);
    this.#template = template;
    for (const entry of this.entries) this.#addDelete(entry);
    return true;
  }

  /** `name`, `type` and `placeholder` fill in what a control leaves unset. */
  #fill(entry: HTMLElement): void {
    const name = this.getAttribute('name');
    const type = this.getAttribute('type');
    const placeholder = this.getAttribute('placeholder');
    for (const control of Array.from(entry.querySelectorAll<Control>(CONTROL))) {
      if (name && !control.getAttribute('name')) control.setAttribute('name', `${name}[]`);
      if (control instanceof HTMLInputElement && !control.hasAttribute('type') && type) {
        control.setAttribute('type', type);
      }
      if (control instanceof HTMLInputElement && placeholder && !control.placeholder) {
        control.placeholder = placeholder;
      }
    }
  }

  #button(kind: 'add' | 'clear' | 'delete', label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = kind === 'delete' ? 'btn multifield__delete' : 'btn';
    button.dataset.multifieldAction = kind;
    button.textContent = label;
    return button;
  }

  /* ── Entries ─────────────────────────────────────────────────────────────── */

  #enhanceRow(row: HTMLElement): void {
    this.#addDelete(row);
    this.#retitle(row);
    if (!row.hasAttribute('data-blank')) this.#defaults.add(row);
  }

  #addDelete(entry: HTMLElement): void {
    if (entry.querySelector('[data-multifield-action="delete"]')) return;
    const label = this.getAttribute('delete-label') ?? (this.#rows ? 'Remove' : 'Delete');
    const button = this.#button('delete', label);
    if (this.#rows) {
      const actions = document.createElement('div');
      actions.className = 'field__row-actions';
      actions.append(button);
      (entry.querySelector(':scope > .field__row-body') ?? entry).append(actions);
    } else {
      // A field's delete is an icon button: the text is its accessible name.
      button.classList.add('multifield__delete--icon');
      button.textContent = '';
      button.setAttribute('aria-label', label);
      entry.append(button);
    }
  }

  /** A row's summary names the entry, so a folded row still says which one it is. */
  #retitle(row: HTMLElement): void {
    const title = row.querySelector<HTMLElement>(':scope > summary .field__row-title');
    const key = row.querySelector<HTMLInputElement | HTMLSelectElement>(
      'input[name$="$key"], select[name$="$key"]',
    );
    if (!title || !key) return;
    const text =
      key instanceof HTMLSelectElement
        ? (key.selectedOptions[0]?.textContent ?? '')
        : key.value.trim();
    title.textContent = text.trim() || `New ${this.#noun}`;
  }

  #addEntry(byVisitor: boolean): HTMLElement | null {
    if (!this.#template || !this.#actions) return null;
    if (this.#max > 0 && this.entries.length >= this.#max) return null;
    const entry = this.#template.cloneNode(true) as HTMLElement;
    if (this.#rows) {
      const index = Math.max(this.#next, nextIndex(this.entries));
      scrubRow(entry, this.#base, this.#templateIndex, index);
      this.#next = index + 1;
    } else {
      freshEntry(entry, ++this.#serial);
    }
    // Rows stay above the buttons.
    this.#actions.before(entry);
    if (entry instanceof HTMLDetailsElement) entry.open = true;
    if (this.#rows) this.#enhanceRow(entry);
    else this.#addDelete(entry);
    if (!byVisitor) return entry;

    this.#announce(`Added ${this.#noun}`);
    this.#refresh();
    this.#emit('add', {});
    entry.querySelector<HTMLElement>(CONTROL)?.focus();
    return entry;
  }

  #deleteEntry(entry: HTMLElement): void {
    const all = this.entries;
    const at = all.indexOf(entry);
    const value = entry.querySelector<Control>(CONTROL)?.value ?? '';
    const name = entry.querySelector('summary .field__row-title')?.textContent?.trim();
    entry.remove();
    this.#announce(name ? `Removed ${name}` : `Removed ${this.#noun}`);
    this.#refresh();
    this.#emit('delete', { value });
    // Focus must land somewhere: the entry above, else the Add button.
    const next = this.entries[Math.min(at, this.entries.length - 1)];
    (next?.querySelector<HTMLElement>('summary, ' + CONTROL) ?? this.#add)?.focus();
  }

  /** Empty the list: every removable entry goes, then it is padded back up to `min`. */
  #clearEntries(): void {
    for (const entry of this.entries) {
      if (!this.#canDelete(entry, true)) continue;
      entry.remove();
    }
    while (this.entries.length < this.#min) if (!this.#addEntry(false)) break;
    this.#announce('Cleared');
    this.#refresh();
    this.#emit('clear', {});
  }

  #canDelete(entry: HTMLElement, forClear = false): boolean {
    if (this.#protect && this.#defaults.has(entry)) return false;
    return forClear || this.entries.length > this.#min;
  }

  /** Disable what cannot be done now: delete at `min` or on a protected entry, add at `max`. */
  #refresh(): void {
    const entries = this.entries;
    for (const entry of entries) {
      const button = entry.querySelector<HTMLButtonElement>(
        ':scope [data-multifield-action="delete"]',
      );
      if (button) button.disabled = !this.#canDelete(entry);
    }
    if (this.#add) this.#add.disabled = this.#max > 0 && entries.length >= this.#max;
    if (this.#clear) {
      const removable = entries.filter((e) => this.#canDelete(e, true)).length;
      this.#clear.disabled = this.#protect ? removable === 0 : entries.length <= this.#min;
    }
  }

  #announce(text: string): void {
    if (this.#status) this.#status.textContent = text;
  }

  #emit(action: 'add' | 'delete' | 'clear', detail: Record<string, unknown>): void {
    // `input` first so a form-level listener revalidates and re-reads the value.
    this.dispatchEvent(new Event('input', { bubbles: true }));
    this.dispatchEvent(new CustomEvent(`multi-field-${action}`, { detail, bubbles: true }));
    this.dispatchEvent(
      new CustomEvent('multi-field-change', {
        detail: {
          action,
          count: this.entries.length,
          ...(this.#rows ? {} : { values: this.values }),
        },
        bubbles: true,
      }),
    );
  }

  /* ── Events ──────────────────────────────────────────────────────────────── */

  #onClick = (event: Event): void => {
    const button = (event.target as Element | null)?.closest<HTMLElement>(
      '[data-multifield-action]',
    );
    if (!button || !this.contains(button) || (button as HTMLButtonElement).disabled) return;
    event.preventDefault();
    const kind = button.dataset.multifieldAction;
    if (kind === 'add') this.#addEntry(true);
    else if (kind === 'clear') this.#clearEntries();
    else {
      const entry = button.closest<HTMLElement>(this.#rows ? ROW : '.multifield__entry');
      if (entry) this.#deleteEntry(entry);
    }
  };

  #onInput = (event: Event): void => {
    if (!this.#rows) return;
    const row = (event.target as Element | null)?.closest<HTMLElement>(ROW);
    if (row && this.contains(row)) this.#retitle(row);
  };

  #onInvalid = (event: Event): void => {
    const row = (event.target as Element | null)?.closest<HTMLDetailsElement>(ROW);
    if (row && !row.open) row.open = true;
  };
}

if (!customElements.get('wc-multifield')) {
  customElements.define('wc-multifield', WCMultiField);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-multifield': WCMultiField;
  }
}
