import { noChange } from 'lit';
import { BaseElement } from './BaseElement.js';
import { clampPair, fillStops, outputText } from './utils/range.js';
import { initFromLightDom } from './utils/upgrade.js';

/**
 * Range sliders, for what a native `<input type="range">` cannot do: show its value, and be two
 * thumbs on one track.
 *
 * **The fallback is native, and complete.** One range input is a slider. Two are two sliders that
 * both submit (`min` and `max`), each with its own label. Nothing about that markup is a
 * placeholder, and a single slider needs no element at all: style the input with the
 * `range` rules in `forms.css`.
 *
 * ```html
 * <wc-range class="range">
 *   <input type="range" name="min" min="0" max="1000" value="200" aria-label="Minimum price" />
 *   <input type="range" name="max" min="0" max="1000" value="800" aria-label="Maximum price" />
 *   <output></output>
 * </wc-range>
 * ```
 *
 * With two inputs it overlays them on one track (`range--dual`), stops the thumbs crossing, and
 * fills the span between them. With an `<output>` it keeps that text current (`20 – 80`). The
 * inputs stay the real controls, so form submission, validation, keyboard (arrows, Home, End, Page
 * keys) and assistive technology are the browser's own; the element only coordinates them.
 *
 * Light DOM, because `.range`'s CSS has to style the inputs themselves.
 *
 * @fires range-change `{ values: number[] }`, bubbles and composed, as either value changes.
 */
export class WCRange extends BaseElement {
  override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Never let lit-html touch the inputs. */
  protected override render(): typeof noChange {
    return noChange;
  }

  #ready = false;
  #inputs: HTMLInputElement[] = [];
  #output: HTMLOutputElement | null = null;
  #track: HTMLElement | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    initFromLightDom(this, () => this.#setup());
  }

  #setup(): boolean {
    if (this.#ready) return true;
    const inputs = Array.from(this.querySelectorAll<HTMLInputElement>('input[type="range"]'));
    if (inputs.length === 0) return false;
    this.#inputs = inputs.slice(0, 2);
    this.#output = this.querySelector('output');

    if (this.#inputs.length === 2) {
      const track = document.createElement('div');
      track.className = 'range__track';
      track.setAttribute('aria-hidden', 'true');
      this.prepend(track);
      this.#track = track;
      this.classList.add('range--dual');
    }
    this.#output?.setAttribute(
      'for',
      this.#inputs
        .map((i) => i.id)
        .filter(Boolean)
        .join(' '),
    );

    this.#inputs.forEach((input, i) => input.addEventListener('input', () => this.#onInput(i)));
    this.#ready = true;
    this.#sync();
    return true;
  }

  #values(): number[] {
    return this.#inputs.map((i) => i.valueAsNumber);
  }

  #onInput(index: number): void {
    if (this.#inputs.length === 2) {
      const [lo, hi] = this.#inputs as [HTMLInputElement, HTMLInputElement];
      const [l, u] = clampPair(index === 0 ? 'lower' : 'upper', lo.valueAsNumber, hi.valueAsNumber);
      // Only write back what changed: assigning a value re-fires nothing, but it moves the thumb.
      if (lo.valueAsNumber !== l) lo.value = String(l);
      if (hi.valueAsNumber !== u) hi.value = String(u);
    }
    this.#sync();
    this.dispatchEvent(
      new CustomEvent('range-change', {
        detail: { values: this.#values() },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #sync(): void {
    const values = this.#values();
    if (this.#output) {
      this.#output.textContent = outputText(values, (n) => new Intl.NumberFormat().format(n));
    }
    if (this.#inputs.length === 2 && this.#track) {
      const first = this.#inputs[0]!;
      const { start, end } = fillStops(
        values[0]!,
        values[1]!,
        Number(first.min || 0),
        Number(first.max || 100),
      );
      this.style.setProperty('--range-start', `${start}%`);
      this.style.setProperty('--range-end', `${end}%`);
    }
  }
}

if (!customElements.get('wc-range')) {
  customElements.define('wc-range', WCRange);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-range': WCRange;
  }
}
