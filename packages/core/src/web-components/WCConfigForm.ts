import {
  formToConfig,
  validateAgainstSchema,
  type JsonObject,
  type JsonSchema,
  type ValidationIssue,
} from '@getvitops/config/forms';
import { docPathOf, messageAt, parseKeyName } from './utils/config-form.js';
import { scrubRow } from './utils/repeat.js';
import { initFromLightDom } from './utils/upgrade.js';
import type { WCField } from './WCField.js';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Turns a rendered config form into a live editor: validates against a JSON Schema as you type,
 * shows each message in its `<wc-field>`, adds a row to a keyed map as the blank one is used, and
 * exposes the config document the form currently describes.
 *
 * **It enhances a form that already works.** The markup (from `renderProjectionHtml`, or written by
 * hand in the same convention) is a complete `<form method="post">`: with no JS it posts the names
 * `formToConfig` parses, and the server validates. This element never replaces a control and never
 * takes over the submit, it only adds what a server round trip can't: feedback while typing.
 *
 * ```html
 * <wc-config-form schema="site-schema" output="#preview">
 *   <form method="post"> … <wc-field> … </wc-field> … </form>
 * </wc-config-form>
 * <script type="application/json" id="site-schema">{ …JSON Schema… }</script>
 * ```
 *
 * **Plain `HTMLElement`, no Lit, and its own bundle** (`@getvitops/core/config-form`): it carries the
 * validator and the codec, and a page that has no config form should not download either.
 *
 * - `schema`: the id of a `<script type="application/json">` holding the schema, or a URL to fetch.
 *   Narrow it to the fields the form shows (`pickSchema`), or a required field the form never
 *   displays will be reported against it. The `jsonSchema` property sets it from script instead.
 * - `output`: a selector for an element that receives `JSON.stringify(value, null, 2)` on every change.
 * - `novalidate`: don't block a submit that has errors (the server decides).
 *
 * A message shows once its field has been left, or a submit has been attempted; never while the
 * visitor is still reading the form. A submit with errors is cancelled and focuses the first one.
 *
 * @fires config-change `{ value, issues }`, bubbles, after every input, change or added row.
 *
 * @fallback full a complete `<form method="post">` the server validates
 */
export class WCConfigForm extends HTMLElement {
  #form: HTMLFormElement | null = null;
  #schema: JsonSchema | null = null;
  #ready = false;
  #submitted = false;
  readonly #touched = new WeakSet<Element>();
  #issues: ValidationIssue[] = [];

  static get observedAttributes(): string[] {
    return ['schema'];
  }

  connectedCallback(): void {
    initFromLightDom(this, () => this.#setup());
  }

  attributeChangedCallback(): void {
    if (this.#ready) this.#loadSchema();
  }

  /* ── Public API ──────────────────────────────────────────────────────────── */

  /** The config document the form currently describes (what `formToConfig` makes of it). */
  get value(): JsonObject {
    return this.#form ? formToConfig(new FormData(this.#form)) : {};
  }

  /** The issues from the last validation. */
  get issues(): readonly ValidationIssue[] {
    return this.#issues;
  }

  /** Set the schema from script instead of the `schema` attribute. */
  set jsonSchema(schema: JsonSchema | null) {
    this.#schema = schema;
    if (this.#ready) this.#sync();
  }

  /** Validate now, showing every message regardless of what has been touched. */
  validate(): ValidationIssue[] {
    this.#submitted = true;
    return this.#sync();
  }

  /* ── Setup ───────────────────────────────────────────────────────────────── */

  #setup(): boolean {
    if (this.#ready) return true;
    const form = this.querySelector('form') ?? this.closest('form');
    if (!form) return false;
    this.#form = form;

    form.addEventListener('input', this.#onInput);
    form.addEventListener('change', this.#onChange);
    form.addEventListener('focusout', this.#onFocusOut);
    form.addEventListener('submit', this.#onSubmit);

    this.#ready = true;
    this.#loadSchema();
    this.#sync();
    return true;
  }

  #loadSchema(): void {
    const ref = this.getAttribute('schema');
    if (!ref) return;
    const script = document.getElementById(ref);
    if (script) {
      try {
        this.#schema = JSON.parse(script.textContent ?? '') as JsonSchema;
        this.#sync();
      } catch {
        // A schema that does not parse leaves the form working without live validation, which is
        // exactly what it did before this element loaded.
        this.#schema = null;
      }
      return;
    }
    // Not an id on this page: a URL.
    void fetch(ref)
      .then((response) => response.json() as Promise<JsonSchema>)
      .then((schema) => {
        this.#schema = schema;
        this.#sync();
      })
      .catch(() => {
        this.#schema = null;
      });
  }

  /* ── Events ──────────────────────────────────────────────────────────────── */

  #onInput = (event: Event): void => {
    this.#useBlankRow(event.target);
    this.#sync();
  };

  #onChange = (event: Event): void => {
    // A select's key is committed by `change`, not `input`.
    this.#useBlankRow(event.target);
    this.#sync();
  };

  #onFocusOut = (event: FocusEvent): void => {
    const field = (event.target as Element | null)?.closest('wc-field');
    if (field) this.#touched.add(field);
    this.#sync();
  };

  #onSubmit = (event: SubmitEvent): void => {
    this.#submitted = true;
    const issues = this.#sync();
    if (issues.length > 0 && !this.hasAttribute('novalidate')) {
      event.preventDefault();
      this.#focusFirstInvalid();
    }
  };

  /* ── Validation ──────────────────────────────────────────────────────────── */

  /** Validate, paint the messages that are due, and tell the page. Returns the issues. */
  #sync(): ValidationIssue[] {
    const form = this.#form;
    if (!form) return [];
    const value = this.value;
    this.#issues = this.#schema ? validateAgainstSchema(this.#schema, value) : [];

    const keyOf = (keyName: string): string =>
      (form.elements.namedItem(keyName) as Control | null)?.value ?? '';

    for (const field of Array.from(form.querySelectorAll<WCField>('wc-field'))) {
      // Not upgraded yet: it has no setError. The next input tries again.
      if (typeof field.setError !== 'function') continue;
      const message = this.#messageFor(field, keyOf);
      const due = this.#submitted || this.#touched.has(field);
      field.setError(due ? message : '');
    }

    const output = this.getAttribute('output');
    if (output) {
      const target = document.querySelector(output);
      if (target) target.textContent = JSON.stringify(value, null, 2);
    }

    this.dispatchEvent(
      new CustomEvent('config-change', {
        detail: { value, issues: this.#issues },
        bubbles: true,
      }),
    );
    return this.#issues;
  }

  #messageFor(field: WCField, keyOf: (keyName: string) => string): string {
    for (const control of field.controls) {
      if (!control.name) continue;
      const path = docPathOf(control.name, keyOf);
      if (!path) continue;
      const message = messageAt(this.#issues, path);
      if (message) return message;
    }
    return '';
  }

  #focusFirstInvalid(): void {
    const invalid = this.#form?.querySelector<Control>(
      'wc-field[data-invalid] :is(input, select, textarea):not([type="hidden"])',
    );
    invalid?.focus();
  }

  /* ── Adding rows ─────────────────────────────────────────────────────────── */

  /**
   * The last row of a keyed map is blank on purpose: with no script it is how a visitor adds an
   * entry. Once its key is filled in it stops being the blank one and a new blank row follows it.
   */
  #useBlankRow(target: EventTarget | null): void {
    if (!(target instanceof HTMLElement)) return;
    const key = target as Control;
    const parsed = parseKeyName(key.name ?? '');
    if (!parsed || key.value.trim() === '') return;
    const row = target.closest<HTMLElement>('.field__row[data-blank]');
    if (!row) return;
    // `<wc-multifield>` has taken over adding rows (an Add button, and Delete): leave the blank one alone.
    if (row.closest('wc-multifield[data-ready]')) return;

    const next = row.cloneNode(true) as HTMLElement;
    row.removeAttribute('data-blank');
    scrubRow(next, parsed.base, parsed.index, parsed.index + 1);
    row.after(next);
  }
}

if (!customElements.get('wc-config-form')) {
  customElements.define('wc-config-form', WCConfigForm);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-config-form': WCConfigForm;
  }
}
