import { noChange } from 'lit';
import { BaseElement } from './BaseElement.js';
import { controlValue, counterText, mergeDescribedBy, messageFor } from './utils/field.js';
import { initFromLightDom } from './utils/upgrade.js';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Wires a label, help text and an error message to a native control, as progressive enhancement over
 * markup that is already a complete field.
 *
 * **The fallback is a nested label.** With no JS this is a labelled control, the label associated by
 * nesting so no `id`/`for` pair has to be invented (and a generator can emit the same field twice on
 * a page without a collision):
 *
 * ```html
 * <wc-field class="field">
 *   <label class="field__control">
 *     <span class="field__label">First name</span>
 *     <input name="firstName" required autocomplete="given-name" />
 *   </label>
 *   <small class="field__help">As it appears on your ID.</small>
 * </wc-field>
 * ```
 *
 * **What it adds is only what the platform cannot do alone:**
 * - links the help text and the error to the control with `aria-describedby` (native has no way to
 *   point at help text without author-chosen ids), and sets `aria-invalid` while an error shows;
 * - writes an error under the field, in a polite live region, once the visitor has left the control
 *   or a submit has reported it. Not while they are still reading the form, which is `:user-invalid`'s
 *   timing, so an empty required field is not an error on arrival;
 * - `setError(message)` for a host that validates against something richer than HTML constraints (a
 *   schema). It goes through `setCustomValidity`, so the form's own `reportValidity()` blocks submit
 *   and reports it. Typing clears it, and the host asserts it again if it still applies;
 * - a character counter when the control has `maxlength`.
 *
 * **It is not form-associated, and that is deliberate.** The control it wraps already submits with
 * its form, validates, takes focus and is in the accessibility tree; a form-associated host around it
 * would submit twice or add nothing. It never moves or replaces the control, so a script holding a
 * reference to it loses nothing. `delegatesFocus` is a shadow-root option and this is light DOM, so
 * there is nothing to delegate: the browser focuses the control directly.
 *
 * The native error bubble still appears on a failed submit; the inline message is in addition, not a
 * replacement, so keyboard users keep the browser's focus-the-first-invalid behaviour.
 *
 * Light DOM, because `forms.css` styles the fallback and the enhanced result alike.
 *
 * @fires field-change `{ name, value, valid }`, bubbles and composed, when a control's value is committed.
 */
export class WCField extends BaseElement {
  override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Never let lit-html touch the control. */
  protected override render(): typeof noChange {
    return noChange;
  }

  static #serial = 0;

  #ready = false;
  #controls: Control[] = [];
  #help: HTMLElement | null = null;
  #error: HTMLElement | null = null;
  #counter: HTMLElement | null = null;
  #custom = '';
  /** An error the server rendered (a failed no-JS POST). Kept until the visitor edits the value. */
  #server = '';
  #touched = false;
  #reported = false;

  override connectedCallback(): void {
    super.connectedCallback();
    initFromLightDom(this, () => this.#setup());
  }

  /* ── Public API ──────────────────────────────────────────────────────────── */

  /**
   * Show `message` against this field, and make the form's `reportValidity()` refuse to submit until
   * it is cleared. An empty string clears it.
   */
  setError(message: string): void {
    this.#custom = message;
    this.#controls[0]?.setCustomValidity(message);
    this.#render();
  }

  clearError(): void {
    this.setError('');
  }

  /** The controls this field wraps (several for a radio group). */
  get controls(): readonly Control[] {
    return this.#controls;
  }

  /* ── Setup ───────────────────────────────────────────────────────────────── */

  #setup(): boolean {
    if (this.#ready) return true;
    const controls = Array.from(
      this.querySelectorAll<Control>('input:not([type="hidden"]), select, textarea'),
    );
    if (controls.length === 0) return false;
    this.#controls = controls;

    const base = this.id || `wc-field-${++WCField.#serial}`;

    this.#help = this.querySelector<HTMLElement>('.field__help');
    if (this.#help && !this.#help.id) this.#help.id = `${base}-help`;

    // The error node is created here when the server did not render one. It exists, empty, before
    // anything is written into it: a live region announces changes to a node that was already there.
    let error = this.querySelector<HTMLElement>('.field__error');
    if (!error) {
      error = document.createElement('span');
      error.className = 'field__error';
      this.append(error);
    }
    if (!error.id) error.id = `${base}-error`;
    error.setAttribute('aria-live', 'polite');
    this.#error = error;
    this.#server = error.textContent?.trim() ?? '';

    if (this.#help) this.#describe([this.#help.id], []);

    const [first] = controls;
    const max = controls.length === 1 && first!.hasAttribute('maxlength') ? maxOf(first!) : null;
    if (max !== null) {
      const counter = document.createElement('span');
      counter.className = 'field__counter';
      // The limit is already enforced by the control; announcing "5 / 80" on every key would be noise.
      counter.setAttribute('aria-hidden', 'true');
      this.append(counter);
      this.#counter = counter;
      this.#updateCounter();
    }

    for (const control of controls) {
      control.addEventListener('invalid', this.#onInvalid);
      control.addEventListener('input', this.#onInput);
      control.addEventListener('change', this.#onChange);
      control.addEventListener('blur', this.#onBlur);
    }

    this.classList.add('field--enhanced');
    this.#ready = true;
    this.#render();
    return true;
  }

  /* ── Events ──────────────────────────────────────────────────────────────── */

  #onInvalid = (): void => {
    // Not cancelled: the browser still shows its bubble and focuses the first invalid control.
    this.#reported = true;
    this.#render();
  };

  #onInput = (event: Event): void => {
    // Typing makes a host's message stale. Clear it so `reportValidity()` is not blocked by a
    // verdict on the previous value; the host asserts it again on its own `input` listener if the
    // new value is still wrong.
    if (this.#custom) {
      this.#custom = '';
      this.#controls[0]?.setCustomValidity('');
    }
    // The server's verdict was on the value as submitted; the visitor has since changed it.
    this.#server = '';
    if (event.target === this.#controls[0]) this.#updateCounter();
    this.#render();
  };

  #onChange = (event: Event): void => {
    this.#touched = true;
    this.#render();
    const control = event.target as Control;
    this.dispatchEvent(
      new CustomEvent('field-change', {
        detail: { name: control.name, value: controlValue(control), valid: control.validity.valid },
        bubbles: true,
        composed: true,
      }),
    );
  };

  #onBlur = (): void => {
    this.#touched = true;
    this.#render();
  };

  /* ── Rendering ───────────────────────────────────────────────────────────── */

  #render(): void {
    if (!this.#error) return;
    const failing = this.#controls.find((control) => !control.validity.valid);
    const message = messageFor({
      custom: this.#custom || this.#server,
      native: failing?.validationMessage ?? '',
      touched: this.#touched,
      reported: this.#reported,
    });

    if (this.#error.textContent !== message) this.#error.textContent = message;
    const shown = message !== '';
    this.toggleAttribute('data-invalid', shown);
    for (const control of this.#controls) {
      if (shown) control.setAttribute('aria-invalid', 'true');
      else control.removeAttribute('aria-invalid');
    }
    if (shown) this.#describe([this.#error.id], []);
    else this.#describe([], [this.#error.id]);
  }

  #describe(add: string[], remove: string[]): void {
    for (const control of this.#controls) {
      const next = mergeDescribedBy(control.getAttribute('aria-describedby'), add, remove);
      if (next === null) control.removeAttribute('aria-describedby');
      else if (next !== control.getAttribute('aria-describedby')) {
        control.setAttribute('aria-describedby', next);
      }
    }
  }

  #updateCounter(): void {
    const control = this.#controls[0];
    if (!this.#counter || !control) return;
    this.#counter.textContent = counterText(control.value.length, maxOf(control)) ?? '';
  }
}

function maxOf(control: Control): number | null {
  const raw = control.getAttribute('maxlength');
  const parsed = raw === null ? NaN : Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

if (!customElements.get('wc-field')) {
  customElements.define('wc-field', WCField);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-field': WCField;
  }
}
