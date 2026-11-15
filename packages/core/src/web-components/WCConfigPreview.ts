import type { JsonObject } from '@getvitops/config/forms';
import { initFromLightDom } from './utils/upgrade.js';

/** What a host's `render` returns: `previewCss` from `@getvitops/generator/preview`, or the like. */
export interface PreviewOutput {
  css: string;
  errors: readonly string[];
  warnings?: readonly string[];
}

type Source = HTMLElement & {
  value?: JsonObject;
  merged?: (base: JsonObject) => JsonObject;
};

const STYLE_ID = 'vitops-preview';

/**
 * Shows what a config edit does to the page it is made on, before anything is built.
 *
 * Point it at a `<wc-config-form>` with `for`. On every `config-change` (debounced) it takes the
 * document the form describes, hands it to `render`, and writes the CSS that comes back into one
 * `<style id="vitops-preview">` in `<head>`. The CSS is the generator's own token layers in the
 * bundle's cascade layers (`@getvitops/generator/preview`), placed after the page's stylesheet, so
 * the edited values win exactly where the built ones are used. Reset removes the style. A document
 * the generator refuses (a palette hue a role names that does not exist, a contrast failure) leaves
 * the last good CSS in place and says why in a polite live region.
 *
 * **The generator is injected, not imported.** `@getvitops/core` cannot depend on
 * `@getvitops/generator` (the generator snapshots core), and a page that has no preview should not
 * download a colour engine. The host sets `element.render` (see `<ConfigPreview>`, which does it
 * with a dynamic import, fetched on the first edit).
 *
 * - `for`: the id of the `<wc-config-form>` (or anything with `value`, and optionally
 *   `merged(base)`).
 * - `base`: the id of a `<script type="application/json">` holding the document to merge the form
 *   over. Without it the form's own `value` is what is previewed.
 *
 * Tooling, not a page pattern: with no JS it renders nothing, which is stated rather than excused.
 *
 * @fires config-preview `{ errors, warnings }`, after each render.
 *
 * @fallback none a live preview has no meaning without script
 */
export class WCConfigPreview extends HTMLElement {
  /** Turns a config document into CSS. Set by the host. */
  render: ((config: JsonObject) => PreviewOutput | Promise<PreviewOutput>) | null = null;

  #ready = false;
  #source: Source | null = null;
  #status: HTMLElement | null = null;
  #toggle: HTMLInputElement | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #run = 0;

  connectedCallback(): void {
    initFromLightDom(this, () => this.#setup());
  }

  disconnectedCallback(): void {
    clearTimeout(this.#timer);
    this.#source?.removeEventListener('config-change', this.#onChange);
    this.#source = null;
    this.#ready = false;
  }

  /** Remove the preview style, restoring the page as it was built. */
  reset(): void {
    document.getElementById(STYLE_ID)?.remove();
    this.#say('');
  }

  #setup(): boolean {
    if (this.#ready) return true;
    const id = this.getAttribute('for');
    const source = id ? (document.getElementById(id) as Source | null) : null;
    if (!source) return false;
    this.#source = source;

    const label = document.createElement('label');
    label.className = 'field__control';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = true;
    toggle.addEventListener('change', () => {
      if (toggle.checked) this.#schedule();
      else this.reset();
    });
    label.append(toggle, ' Preview these changes on this page');
    this.#toggle = toggle;

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'btn';
    reset.textContent = 'Reset preview';
    reset.addEventListener('click', () => {
      toggle.checked = false;
      this.reset();
    });

    const status = document.createElement('p');
    status.className = 'field__status';
    status.setAttribute('role', 'status');
    this.#status = status;

    this.replaceChildren(label, reset, status);
    source.addEventListener('config-change', this.#onChange);
    this.#ready = true;
    this.#schedule();
    return true;
  }

  #onChange = (): void => this.#schedule();

  #schedule(): void {
    if (!this.#toggle?.checked) return;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => void this.#apply(), 200);
  }

  #document(): JsonObject {
    const source = this.#source;
    if (!source) return {};
    const baseId = this.getAttribute('base');
    const text = baseId ? document.getElementById(baseId)?.textContent : null;
    if (text && typeof source.merged === 'function') {
      try {
        return source.merged(JSON.parse(text) as JsonObject);
      } catch {
        // A base that does not parse: preview the form on its own.
      }
    }
    return source.value ?? {};
  }

  async #apply(): Promise<void> {
    const render = this.render;
    if (!render) return;
    const run = ++this.#run;
    let output: PreviewOutput;
    try {
      output = await render(this.#document());
    } catch (e) {
      output = { css: '', errors: [(e as Error).message] };
    }
    // A slower earlier render must not overwrite a later one.
    if (run !== this.#run || !this.#toggle?.checked) return;

    if (output.errors.length === 0) {
      let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
      if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ID;
      }
      style.textContent = output.css;
      // Last in <head>, every time: a stylesheet added since must not end up after it.
      document.head.append(style);
      this.#say('');
    } else {
      this.#say(`Not previewed: ${output.errors.slice(0, 3).join('; ')}`);
    }
    this.dispatchEvent(
      new CustomEvent('config-preview', {
        detail: { errors: output.errors, warnings: output.warnings ?? [] },
        bubbles: true,
      }),
    );
  }

  #say(message: string): void {
    if (this.#status) this.#status.textContent = message;
  }
}

if (!customElements.get('wc-config-preview')) {
  customElements.define('wc-config-preview', WCConfigPreview);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-config-preview': WCConfigPreview;
  }
}
