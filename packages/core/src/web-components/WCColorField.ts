import { initFromLightDom } from './utils/upgrade.js';
import type { WCOklchColorPicker } from './WCOklchColorPicker.js';

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * A colour text input with the OKLCH picker (`<wc-oklch-color-picker>`, the control the theme editor
 * uses) offered beside it.
 *
 * **The fallback is the text input.** A colour in a config is a CSS colour string, and typing one
 * works with no JS and always did; the picker is an extra way to arrive at a hex. Nothing the picker
 * does is the only way to do it, and the text input stays the one control that is submitted, so there
 * is no second form value to reconcile.
 *
 * ```html
 * <wc-color-field>
 *   <label class="field__control"><span class="field__label">Colour</span>
 *     <input type="text" name="…seed" value="#1d4ed8" data-widget="color"></label>
 * </wc-color-field>
 * ```
 *
 * The picker sits in a `<details>` so it takes no room until it is wanted, and **it is not downloaded
 * until the details is first opened**: the picker is a Lit element over a colour-science library
 * (~40 KB gzipped), which a visitor who just types a hex should never pay for. Dragging it writes its hex
 * into the input and fires `input` there, so everything listening to the field (a config form's live
 * validation) hears it as typing. Typing a hex moves the picker; a value the picker cannot show
 * (`oklch(…)`, a name) leaves it where it was.
 * @fallback full a colour text input; JS adds the picker beside it
 */
export class WCColorField extends HTMLElement {
  #ready = false;
  #input: HTMLInputElement | null = null;
  #picker: WCOklchColorPicker | null = null;
  #loading = false;

  connectedCallback(): void {
    initFromLightDom(this, () => this.#setup());
  }

  #setup(): boolean {
    if (this.#ready) return true;
    const input = this.querySelector<HTMLInputElement>('input[data-widget="color"]');
    if (!input) return false;
    this.#input = input;

    const details = document.createElement('details');
    details.className = 'field__picker';
    const summary = document.createElement('summary');
    summary.textContent = this.getAttribute('picker-label') ?? 'Pick a colour';
    details.append(summary);
    this.append(details);
    details.addEventListener('toggle', () => {
      if (details.open) void this.#loadPicker(details);
    });

    input.addEventListener('input', this.#onText);
    this.#ready = true;
    return true;
  }

  /** Fetch the picker once, the first time it is wanted. */
  async #loadPicker(details: HTMLDetailsElement): Promise<void> {
    if (this.#picker || this.#loading) return;
    this.#loading = true;
    try {
      await import('./WCOklchColorPicker.js');
      const picker = document.createElement('wc-oklch-color-picker') as WCOklchColorPicker;
      picker.addEventListener('input', this.#onPicker);
      details.append(picker);
      this.#picker = picker;
      await this.#syncPicker();
    } catch {
      // Offline or blocked: the text input still does everything.
      this.#loading = false;
    }
  }

  async #syncPicker(): Promise<void> {
    const picker = this.#picker;
    const text = this.#input?.value.trim() ?? '';
    if (!picker || !HEX.test(text) || text.toLowerCase() === picker.value.toLowerCase()) return;
    const { hexToOklch } = await import('../utils/colors.js');
    const { l, c, h } = hexToOklch(text);
    picker.value = text;
    picker.lightness = l;
    picker.chroma = c;
    picker.hue = h;
  }

  #onPicker = (event: Event): void => {
    // Not the form's business: it is this element's own control talking to its own input.
    event.stopPropagation();
    const picker = this.#picker;
    const input = this.#input;
    // `-` is the picker's own "mid-drag" placeholder; the real hex arrives on release.
    if (!picker || !input || !HEX.test(picker.value)) return;
    input.value = picker.value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  #onText = (): void => {
    void this.#syncPicker();
  };
}

if (!customElements.get('wc-color-field')) {
  customElements.define('wc-color-field', WCColorField);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-color-field': WCColorField;
  }
}
