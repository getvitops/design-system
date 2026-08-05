import { css, type CSSResultGroup } from 'lit';
import { html } from '@lit-labs/signals';
import { BaseElement } from './BaseElement.js';
// Type-only, and it must stay that way: this element ships in `elements.js` and
// the consent gate is a separate Lit-free bundle, so a value import would drag
// the gate — and its top-level `scan()` — into every page with a theme toggle.
import type {} from '../consent/runtime.js';

/**
 * Mirrors `CONSENT_EVENT` in `../consent/store.js`, deliberately copied rather
 * than imported — the same arrangement, for the same reason, as
 * `@getvitops/astro`'s `analytics.ts` mirroring the category vocabulary.
 *
 * Importing it made `store.ts` a shared chunk between `elements.js` and
 * `consent.js`, so every page with a theme toggle fetched an extra 688-byte
 * module for one string, including sites with no consent gate at all. The
 * bundles are meant to be independent; `store.test.ts` pins the two spellings
 * together so this can't drift.
 */
const CONSENT_EVENT = 'vitops:consent';

type ColorScheme = 'system' | 'light' | 'dark';

/**
 * Color scheme toggle web component with segmented control UI.
 *
 * Provides three explicit buttons for System, Light, and Dark modes.
 * Hidden until JS loads (progressive enhancement).
 *
 * @example
 * ```html
 * <color-scheme-toggle></color-scheme-toggle>
 * ```
 *
 * @fires scheme-change - When the color scheme changes, with detail: { scheme: 'system' | 'light' | 'dark' }
 *
 * The chosen scheme always applies immediately; **remembering** it across visits
 * goes through the `preferences` consent category when the site has a gate — see
 * `_persist()`. Picking a non-`system` scheme is therefore what raises the banner
 * on a site that gates nothing else.
 */
export class WCColorSchemeToggle extends BaseElement {
  static styles: CSSResultGroup = [
    BaseElement.styles,
    css`
      :host {
        display: none;
      }

      :host(:defined) {
        display: inline-flex;
      }

      .toggle__group {
        display: inline-flex;
        border-radius: var(--color-scheme-toggle-radius, 0.5rem);
        overflow: hidden;
        border: var(--color-scheme-toggle-border, 1px solid oklch(0.5 0 0 / 0.2));
      }

      .toggle__segment {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.375rem;
        padding: var(--color-scheme-toggle-padding, 0.5rem 0.75rem);
        border: none;
        background: var(--color-scheme-toggle-bg, oklch(0.95 0 0));
        color: var(--color-scheme-toggle-color, oklch(0.3 0 0));
        font-size: var(--color-scheme-toggle-font-size, 0.875rem);
        font-family: inherit;
        cursor: pointer;
        transition:
          background-color 0.15s ease,
          color 0.15s ease;
      }

      .toggle__segment:not(:last-child) {
        border-inline-end: 1px solid oklch(0.5 0 0 / 0.15);
      }

      .toggle__segment:hover {
        background: var(--color-scheme-toggle-hover-bg, oklch(0.9 0 0));
      }

      .toggle__segment[aria-pressed='true'] {
        background: var(--color-scheme-toggle-active-bg, oklch(0.25 0.02 260));
        color: var(--color-scheme-toggle-active-color, oklch(0.95 0 0));
      }

      .toggle__segment:focus-visible {
        outline: 2px solid var(--color-scheme-toggle-focus-color, oklch(0.6 0.2 250));
        outline-offset: 2px;
        z-index: 1;
        position: relative;
      }

      .toggle__icon {
        inline-size: 1em;
        block-size: 1em;
        flex-shrink: 0;
      }

      /* Sun icon */
      .toggle__icon--light {
        background: currentColor;
        mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='5'/%3E%3Cline x1='12' y1='1' x2='12' y2='3'/%3E%3Cline x1='12' y1='21' x2='12' y2='23'/%3E%3Cline x1='4.22' y1='4.22' x2='5.64' y2='5.64'/%3E%3Cline x1='18.36' y1='18.36' x2='19.78' y2='19.78'/%3E%3Cline x1='1' y1='12' x2='3' y2='12'/%3E%3Cline x1='21' y1='12' x2='23' y2='12'/%3E%3Cline x1='4.22' y1='19.78' x2='5.64' y2='18.36'/%3E%3Cline x1='18.36' y1='5.64' x2='19.78' y2='4.22'/%3E%3C/svg%3E");
        mask-size: contain;
        mask-repeat: no-repeat;
      }

      /* Moon icon */
      .toggle__icon--dark {
        background: currentColor;
        mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'/%3E%3C/svg%3E");
        mask-size: contain;
        mask-repeat: no-repeat;
      }

      /* System icon (monitor) */
      .toggle__icon--system {
        background: currentColor;
        mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='2' y='3' width='20' height='14' rx='2' ry='2'/%3E%3Cline x1='8' y1='21' x2='16' y2='21'/%3E%3Cline x1='12' y1='17' x2='12' y2='21'/%3E%3C/svg%3E");
        mask-size: contain;
        mask-repeat: no-repeat;
      }

      .toggle__label {
        display: none;
      }

      @container (min-width: 400px) {
        .toggle__label {
          display: inline;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .toggle__segment {
          transition: none;
        }
      }
    `,
  ];

  static properties = {
    scheme: { type: String, reflect: true },
  };

  declare scheme: ColorScheme;

  private _mediaQuery: MediaQueryList | null = null;
  private _boundMediaHandler: ((e: MediaQueryListEvent) => void) | null = null;

  constructor() {
    super();
    this.init();
  }

  init() {
    this.scheme = WCColorSchemeToggle.readStored() ?? 'system';
  }

  /**
   * Where the explicit choice is remembered across navigations.
   *
   * MUST match the key used by the pre-paint script in `@getvitops/astro`'s
   * `<Head />` — that script applies the stored value before first paint, so the
   * page doesn't render light and then flip once this component upgrades.
   * `color-scheme-toggle.test.ts` asserts the two stay in step.
   */
  static readonly STORAGE_KEY = 'vitops-color-scheme';

  /**
   * Read the persisted choice; storage can throw in private/partitioned modes.
   *
   * Deliberately **not** gated on consent, unlike the write. A value already in
   * storage was either consented to or predates the gate; refusing to read it
   * would throw away the visitor's own setting to protect them from themselves.
   */
  static readStored(): ColorScheme | null {
    try {
      const v = localStorage.getItem(WCColorSchemeToggle.STORAGE_KEY);
      return v === 'light' || v === 'dark' || v === 'system' ? v : null;
    } catch {
      return null;
    }
  }

  /**
   * Persist the choice, if we're allowed to.
   *
   * The scheme itself always applies — `_applyColorScheme()` is not gated, so the
   * click does what the visitor asked immediately. Only the *storage* waits on the
   * `preferences` category, which is the honest split: remembering a choice across
   * visits is the part that needs permission, and changing the current page is not.
   *
   * `require()` both asks and registers the demand, so picking a scheme on a site
   * with no analytics is what puts the banner up — the one interaction that needs
   * the permission is the one that requests it. If it is refused, nothing is
   * written and `_onConsent` picks it up should the visitor grant it later.
   *
   * **No gate on the page means no gate**, not deny: a site that never enabled
   * `consent` keeps storing exactly as before. `<Head />` emits an inline stub
   * whenever the gate *is* enabled, so an absent `window.vitopsConsent` here is a
   * reliable "this site has no gate" rather than "consent.js hasn't loaded yet".
   */
  private _persist(): void {
    const consent = window.vitopsConsent;
    if (!consent || consent.require('preferences')) this._write();
  }

  /**
   * Flush the current scheme once `preferences` is granted.
   *
   * A standing listener rather than a promise on the outstanding `require()`,
   * because a grant can arrive long after the click that asked for it — the
   * visitor declines the banner, keeps browsing, then enables preferences from
   * "Cookie settings". A one-shot promise resolves `false` at the decline and
   * never fires again, which left the toggle visibly on Dark, permission given,
   * and nothing stored: the setting silently reverted on the next navigation.
   *
   * Listening for the event rather than calling `subscribe()` also sidesteps the
   * load-order problem — this element can upgrade before `consent.js` evaluates,
   * so there may be no API object to subscribe to yet, but the event fires either
   * way.
   */
  private _onConsent = (): void => {
    if (window.vitopsConsent?.granted('preferences')) this._write();
  };

  private _write(): void {
    try {
      // 'system' is the absence of a choice, so clear rather than store it —
      // that way a visitor who returns to System follows the OS again.
      if (this.scheme === 'system') localStorage.removeItem(WCColorSchemeToggle.STORAGE_KEY);
      else localStorage.setItem(WCColorSchemeToggle.STORAGE_KEY, this.scheme);
    } catch {
      /* storage unavailable — the toggle still works for this page */
    }
  }

  connectedCallback(): void {
    super.connectedCallback();

    // Listen for system preference changes
    this._mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this._boundMediaHandler = this._handleMediaChange.bind(this);
    this._mediaQuery.addEventListener('change', this._boundMediaHandler);

    // Fires on the gate's startup publish and on every change thereafter.
    document.addEventListener(CONSENT_EVENT, this._onConsent);

    // Apply initial scheme
    this._applyColorScheme();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    if (this._mediaQuery && this._boundMediaHandler) {
      this._mediaQuery.removeEventListener('change', this._boundMediaHandler);
    }

    document.removeEventListener(CONSENT_EVENT, this._onConsent);

    // Deliberately does NOT clear `color-scheme` / `data-theme`: the colour
    // scheme is a document-level user preference, not this element's state.
    // Tearing it down on disconnect meant unmounting the toggle (a view
    // transition, or a second toggle replacing this one) silently reverted the
    // page to light.
  }

  private _handleMediaChange(_e: MediaQueryListEvent): void {
    // Only need to re-render if in system mode to update visual state
    if (this.scheme === 'system') {
      this.requestUpdate();
    }
  }

  private _applyColorScheme(): void {
    const root = document.documentElement;

    if (this.scheme === 'system') {
      root.style.removeProperty('color-scheme');
      // No attribute = no explicit choice. The generated dark block keys off
      // [data-theme="dark"] (and Bricks' [data-brx-theme="dark"]), so removing it
      // falls back to the light token set.
      delete root.dataset.theme;
    } else {
      root.style.colorScheme = `${this.scheme} only`;
      root.dataset.theme = this.scheme;
    }
  }

  private _handleSegmentClick(newScheme: ColorScheme): void {
    if (this.scheme === newScheme) return;

    this.scheme = newScheme;
    this._applyColorScheme();
    this._persist();

    this.dispatchEvent(
      new CustomEvent('scheme-change', {
        detail: { scheme: this.scheme },
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected updated(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has('scheme')) {
      this._applyColorScheme();
    }
  }

  render() {
    return html`
      <div class="toggle__group" role="group" aria-label="Color scheme" part="group">
        <button
          class="toggle__segment"
          part="system"
          type="button"
          aria-pressed=${this.scheme === 'system'}
          @click=${() => this._handleSegmentClick('system')}
        >
          <span class="toggle__icon toggle__icon--system" aria-hidden="true"></span>
          <span class="toggle__label">System</span>
        </button>
        <button
          class="toggle__segment"
          part="light"
          type="button"
          aria-pressed=${this.scheme === 'light'}
          @click=${() => this._handleSegmentClick('light')}
        >
          <span class="toggle__icon toggle__icon--light" aria-hidden="true"></span>
          <span class="toggle__label">Light</span>
        </button>
        <button
          class="toggle__segment"
          part="dark"
          type="button"
          aria-pressed=${this.scheme === 'dark'}
          @click=${() => this._handleSegmentClick('dark')}
        >
          <span class="toggle__icon toggle__icon--dark" aria-hidden="true"></span>
          <span class="toggle__label">Dark</span>
        </button>
      </div>
    `;
  }
}

if (!customElements.get('color-scheme-toggle')) {
  customElements.define('color-scheme-toggle', WCColorSchemeToggle);
}

declare global {
  interface HTMLElementTagNameMap {
    'color-scheme-toggle': WCColorSchemeToggle;
  }
}
