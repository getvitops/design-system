import { nextIndex, rowIdentity, scrubRow } from './utils/repeat.js';
import { initFromLightDom } from './utils/upgrade.js';

const ROW = '.field__row';

/**
 * A group of repeatable rows (one fieldset's worth of fields each) with Add and Delete.
 *
 * **The fallback is the rows themselves.** With no JS the element wraps the rows already on the
 * page plus one blank row at the end (`data-blank`): fill it in to add an entry, empty an entry's
 * key to drop it (a row with no key is not sent). Each row is a `<details open>`, so it can be
 * folded away natively. Nothing about that markup is a placeholder.
 *
 * ```html
 * <wc-repeat add-label="Add a location" delete-label="Remove" item-label="location">
 *   <fieldset class="field__group">
 *     <legend>Locations</legend>
 *     <details class="field__row" open>
 *       <summary><span class="field__row-title">Ottawa</span></summary>
 *       <div class="field__row-body">…fields named `…$map.0.*`…</div>
 *     </details>
 *     <details class="field__row" data-blank open>…</details>
 *   </fieldset>
 * </wc-repeat>
 * ```
 *
 * On upgrade it keeps the blank row as a template and takes it out of the page, adds a Remove button
 * to every row and an Add button after the last, keeps each row's summary in step with its key field,
 * and opens a folded row that holds the control a blocked submit is about. A new row is a scrubbed
 * copy of the template, named at the next free index (indices are a rendering detail: the form
 * codec keys rows by `$key`, so gaps after a delete are fine). Changes fire `input` (so a form
 * listener such as `<wc-config-form>` validates and re-reads) and `repeat-change`.
 *
 * Plain `HTMLElement`, no Lit, in its own bundle (`@getvitops/core/repeat`).
 *
 * @fires repeat-change `{ action: 'add' | 'delete', count }`, bubbles.
 */
export class WCRepeat extends HTMLElement {
  #ready = false;
  #template: HTMLElement | null = null;
  #base = '';
  #templateIndex = 0;
  #next = 0;
  #container: HTMLElement | null = null;
  #add: HTMLButtonElement | null = null;
  #status: HTMLElement | null = null;

  connectedCallback(): void {
    initFromLightDom(this, () => this.#setup());
  }

  /** The rows now on the page (the template is not one). */
  get rows(): HTMLElement[] {
    // A row of a repeat nested inside one of this repeat's rows is that repeat's, not this one's.
    return Array.from(this.querySelectorAll<HTMLElement>(ROW)).filter(
      (row) => row.closest('wc-repeat') === this,
    );
  }

  /** Add a row as the visitor would. Returns it. */
  add(): HTMLElement | null {
    return this.#addRow();
  }

  #setup(): boolean {
    if (this.#ready) return true;
    const all = this.rows;
    if (all.length === 0) return false;
    const source = all.find((row) => row.hasAttribute('data-blank')) ?? all[all.length - 1]!;
    const identity = rowIdentity(source);
    if (!identity) return false;

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

    for (const row of this.rows) this.#enhanceRow(row);

    this.#status = document.createElement('p');
    this.#status.className = 'field__status';
    this.#status.setAttribute('role', 'status');
    this.#add = document.createElement('button');
    this.#add.type = 'button';
    this.#add.className = 'btn';
    this.#add.dataset.repeatAction = 'add';
    this.#add.textContent = this.getAttribute('add-label') ?? 'Add';
    this.#container?.append(this.#add, this.#status);

    this.addEventListener('click', this.#onClick);
    this.addEventListener('input', this.#onInput);
    this.addEventListener('change', this.#onInput);
    // `invalid` does not bubble: capture it, and unfold the row a blocked submit is about.
    this.addEventListener('invalid', this.#onInvalid, true);

    this.#ready = true;
    this.setAttribute('data-ready', '');
    return true;
  }

  /* ── Rows ────────────────────────────────────────────────────────────────── */

  #noun(): string {
    return this.getAttribute('item-label') ?? 'item';
  }

  #enhanceRow(row: HTMLElement): void {
    if (!row.querySelector(':scope [data-repeat-action="delete"]')) {
      const actions = document.createElement('div');
      actions.className = 'field__row-actions';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn';
      button.dataset.repeatAction = 'delete';
      button.textContent = this.getAttribute('delete-label') ?? 'Remove';
      actions.append(button);
      (row.querySelector(':scope > .field__row-body') ?? row).append(actions);
    }
    this.#retitle(row);
  }

  /** The row's summary names the entry, so a folded row still says which one it is. */
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
    title.textContent = text.trim() || `New ${this.#noun()}`;
  }

  #addRow(): HTMLElement | null {
    if (!this.#template || !this.#add) return null;
    const row = this.#template.cloneNode(true) as HTMLElement;
    const index = Math.max(this.#next, nextIndex(this.rows));
    scrubRow(row, this.#base, this.#templateIndex, index);
    this.#next = index + 1;
    // Insert where the Add button sits, so rows stay above it.
    this.#add.before(row);
    (row as HTMLDetailsElement).open = true;
    this.#enhanceRow(row);
    this.#announce(`Added ${this.#noun()}`);
    this.#changed('add');
    row.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea')?.focus();
    return row;
  }

  #deleteRow(row: HTMLElement): void {
    const rows = this.rows;
    const at = rows.indexOf(row);
    const name = row.querySelector('summary .field__row-title')?.textContent?.trim();
    row.remove();
    this.#announce(name ? `Removed ${name}` : `Removed ${this.#noun()}`);
    this.#changed('delete');
    // Focus must land somewhere: the row above, else the Add button.
    const neighbour = this.rows[Math.min(at, this.rows.length - 1)];
    (neighbour?.querySelector<HTMLElement>('summary') ?? this.#add)?.focus();
  }

  #announce(text: string): void {
    if (this.#status) this.#status.textContent = text;
  }

  #changed(action: 'add' | 'delete'): void {
    // `input` so a form-level listener revalidates and re-reads the value; `repeat-change` for the rest.
    this.dispatchEvent(new Event('input', { bubbles: true }));
    this.dispatchEvent(
      new CustomEvent('repeat-change', {
        detail: { action, count: this.rows.length },
        bubbles: true,
      }),
    );
  }

  /* ── Events ──────────────────────────────────────────────────────────────── */

  #onClick = (event: Event): void => {
    const button = (event.target as Element | null)?.closest<HTMLElement>('[data-repeat-action]');
    if (!button || !this.contains(button)) return;
    event.preventDefault();
    if (button.dataset.repeatAction === 'add') this.#addRow();
    else {
      const row = button.closest<HTMLElement>(ROW);
      if (row) this.#deleteRow(row);
    }
  };

  #onInput = (event: Event): void => {
    const row = (event.target as Element | null)?.closest<HTMLElement>(ROW);
    if (row && this.contains(row)) this.#retitle(row);
  };

  #onInvalid = (event: Event): void => {
    const row = (event.target as Element | null)?.closest<HTMLDetailsElement>(ROW);
    if (row && !row.open) row.open = true;
  };
}

if (!customElements.get('wc-repeat')) {
  customElements.define('wc-repeat', WCRepeat);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-repeat': WCRepeat;
  }
}
