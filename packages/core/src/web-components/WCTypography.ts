import { css, type CSSResultGroup } from 'lit';
import { html } from '@lit-labs/signals';
import { BaseElement } from './BaseElement.js';
import './WCSplitPanel.js';

// Common typographic scale ratios
const TYPOGRAPHIC_SCALES = {
  'Minor Second': 1.067,
  'Major Second': 1.125,
  'Minor Third': 1.2,
  'Major Third': 1.25,
  'Perfect Fourth': 1.333,
  'Augmented Fourth': 1.414,
  'Perfect Fifth': 1.5,
  'Golden Ratio': 1.618,
} as const;

// Font weights
const FONT_WEIGHTS = [
  { value: '100', label: 'Thin (100)' },
  { value: '200', label: 'Extra Light (200)' },
  { value: '300', label: 'Light (300)' },
  { value: '400', label: 'Regular (400)' },
  { value: '500', label: 'Medium (500)' },
  { value: '600', label: 'Semibold (600)' },
  { value: '700', label: 'Bold (700)' },
  { value: '800', label: 'Extra Bold (800)' },
  { value: '900', label: 'Black (900)' },
] as const;

// Font styles
const FONT_STYLES = [
  { value: 'normal', label: 'Normal' },
  { value: 'italic', label: 'Italic' },
] as const;

// Text transforms
const TEXT_TRANSFORMS = [
  { value: 'none', label: 'None' },
  { value: 'uppercase', label: 'UPPERCASE' },
  { value: 'lowercase', label: 'lowercase' },
  { value: 'capitalize', label: 'Capitalize' },
] as const;

// Font variants
const FONT_VARIANTS = [
  { value: 'normal', label: 'Normal' },
  { value: 'small-caps', label: 'Small Caps' },
  { value: 'all-small-caps', label: 'All Small Caps' },
  { value: 'petite-caps', label: 'Petite Caps' },
  { value: 'unicase', label: 'Unicase' },
] as const;

// Text decorations
const TEXT_DECORATIONS = [
  { value: 'none', label: 'None' },
  { value: 'underline', label: 'Underline' },
  { value: 'line-through', label: 'Strikethrough' },
  { value: 'overline', label: 'Overline' },
] as const;

// Text wrap modes
const TEXT_WRAPS = [
  { value: 'inherit', label: 'Inherit' },
  { value: 'balance', label: 'Balance' },
  { value: 'pretty', label: 'Pretty' },
  { value: 'stable', label: 'Stable' },
  { value: 'nowrap', label: 'No Wrap' },
] as const;

// Typography roles (matches font role utilities in utilities-typography.css)
const TYPOGRAPHY_ROLES = [
  'display',
  'headline',
  'title',
  'flair',
  'body',
  'quote',
  'caption',
  'cta',
  'label',
  'eyebrow',
] as const;

type TypographyRole = (typeof TYPOGRAPHY_ROLES)[number];

interface RoleConfig {
  fontFamily: string;
  weight: string;
  style: string;
  fontVariant: string;
  lineHeight: string;
  letterSpacing: string;
  textDecoration: string;
  textTransform: string;
  textWrap: string;
  color: string;
}

interface FluidConfig {
  enabled: boolean;
  min: string;
  preferred: string;
  max: string;
}

interface MeasureConfig {
  value: number;
  unit: string;
}

interface FontEntry {
  name: string;
  provider: 'google' | 'system' | 'custom';
  loaded: boolean;
}

// Declaration merging for TypeScript
export interface WCTypography {
  fonts: FontEntry[];
  scale: string;
  baseSize: number;
  roles: Record<TypographyRole, RoleConfig>;
  fluid: FluidConfig;
  measure: MeasureConfig;
  _searchQuery: string;
  _searchResults: string[];
  _isSearching: boolean;
  _activeRole: TypographyRole;
  _previewText: string;
}

/**
 * Typography configuration web component.
 *
 * Provides an interactive interface for configuring typography settings
 * including font selection, scale, and role-based styling.
 *
 * @element typography-config
 *
 * @csspart container - The main container
 * @csspart controls - Left panel with controls
 * @csspart preview - Right panel with preview
 * @csspart section - Each configuration section
 * @csspart section-title - Section headers
 *
 * @fires typography-change - When any typography setting changes
 */
export class WCTypography extends BaseElement {
  static styles: CSSResultGroup = [
    BaseElement.styles,
    css`
      :host {
        --_gap: var(--typography-config-gap, 1rem);
        --_section-gap: var(--typography-config-section-gap, 1.5rem);
        --_border-color: var(--typography-config-border-color, oklch(0.8 0 0));
        --_bg: var(--typography-config-bg, oklch(0.98 0 0));
        --_radius: var(--typography-config-radius, 0.5rem);
        --_input-padding: var(--typography-config-input-padding, 0.5rem 0.75rem);
        --_focus-color: var(--typography-config-focus-color, oklch(0.6 0.2 250));

        display: block;
        block-size: 100%;
        overflow: hidden;
      }

      wc-split-panel {
        block-size: 100%;
        --handle-color: var(--_border-color);
        --handle-hover-color: oklch(0.6 0 0);
        --min-panel-size: 280px;
      }

      .controls {
        padding: var(--_section-gap);
        overflow-y: auto;
        overflow-x: hidden;
        display: flex;
        flex-direction: column;
        gap: var(--_section-gap);
        background: var(--_bg);
        block-size: 100%;
        box-sizing: border-box;
      }

      .preview {
        padding: var(--_section-gap);
        overflow-y: auto;
        overflow-x: hidden;
        background: oklch(1 0 0);
        block-size: 100%;
        box-sizing: border-box;
        container-type: inline-size;
        container-name: preview;
      }

      .section {
        display: flex;
        flex-direction: column;
        gap: var(--_gap);
        min-inline-size: 0;
      }

      .section__title {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: oklch(0.5 0 0);
        margin: 0;
      }

      .section__content {
        display: flex;
        flex-direction: column;
        gap: var(--_gap);
        min-inline-size: 0;
      }

      /* Form controls */
      .field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .field--inline {
        flex-direction: row;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .field__label {
        font-size: 0.875rem;
        font-weight: 500;
        color: oklch(0.3 0 0);
      }

      .field__input,
      .field__select {
        padding: var(--_input-padding);
        border: 1px solid var(--_border-color);
        border-radius: calc(var(--_radius) * 0.75);
        font: inherit;
        font-size: 0.875rem;
        background: oklch(1 0 0);
        color: oklch(0.2 0 0);
      }

      .field__input:focus-visible,
      .field__select:focus-visible {
        outline: 2px solid var(--_focus-color);
        outline-offset: 2px;
      }

      .field__select {
        cursor: pointer;
      }

      .field__input--color {
        padding: 0.25rem;
        inline-size: 3rem;
        block-size: 2rem;
        cursor: pointer;
      }

      .field__input--number {
        inline-size: 5rem;
      }

      /* Checkbox field */
      .field--checkbox {
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
      }

      .field__checkbox {
        inline-size: 1rem;
        block-size: 1rem;
        accent-color: var(--_focus-color);
        cursor: pointer;
      }

      .field__checkbox:focus-visible {
        outline: 2px solid var(--_focus-color);
        outline-offset: 2px;
      }

      /* Fluid inputs group */
      .fluid-inputs {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.5rem;
      }

      .fluid-inputs .field {
        gap: 0.25rem;
        min-inline-size: 0;
      }

      .fluid-inputs .field__label {
        font-size: 0.75rem;
      }

      .fluid-inputs .field__input {
        font-size: 0.8125rem;
        padding: 0.375rem 0.5rem;
        inline-size: 100%;
        min-inline-size: 0;
      }

      .fluid-inputs .field__input:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background: oklch(0.95 0 0);
      }

      /* Measure inputs */
      .measure-inputs {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .measure-inputs .field__input--number {
        inline-size: 4rem;
      }

      .measure-inputs .field__select {
        inline-size: auto;
      }

      /* Font search */
      .font-search {
        position: relative;
      }

      .font-search__results {
        position: absolute;
        inset-block-start: 100%;
        inset-inline: 0;
        max-block-size: 200px;
        overflow-y: auto;
        background: oklch(1 0 0);
        border: 1px solid var(--_border-color);
        border-radius: calc(var(--_radius) * 0.75);
        box-shadow: 0 4px 12px oklch(0 0 0 / 0.1);
        z-index: 10;
        margin-block-start: 0.25rem;
      }

      .font-search__result {
        padding: 0.5rem 0.75rem;
        cursor: pointer;
        font-size: 0.875rem;
        border: none;
        background: transparent;
        inline-size: 100%;
        text-align: start;
        display: block;
      }

      .font-search__result:hover,
      .font-search__result:focus-visible {
        background: oklch(0.95 0 0);
      }

      .font-search__loading {
        padding: 0.75rem;
        text-align: center;
        color: oklch(0.5 0 0);
        font-size: 0.875rem;
      }

      /* Font list */
      .font-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .font-tag {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.375rem 0.625rem;
        background: oklch(0.95 0 0);
        border: 1px solid var(--_border-color);
        border-radius: 2rem;
        font-size: 0.8125rem;
      }

      .font-tag__remove {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 1rem;
        block-size: 1rem;
        padding: 0;
        background: oklch(0.85 0 0);
        border: none;
        border-radius: 50%;
        cursor: pointer;
        color: oklch(0.4 0 0);
        font-size: 0.75rem;
        line-height: 1;
      }

      .font-tag__remove:hover {
        background: oklch(0.7 0 0);
        color: oklch(0.2 0 0);
      }

      /* Role tabs */
      .role-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        padding: 0.25rem;
        background: oklch(0.95 0 0);
        border-radius: calc(var(--_radius) * 0.75);
      }

      .role-tab {
        padding: 0.375rem 0.75rem;
        border: none;
        background: transparent;
        border-radius: calc(var(--_radius) * 0.5);
        font: inherit;
        font-size: 0.8125rem;
        cursor: pointer;
        transition: background-color 0.15s ease;
      }

      .role-tab:hover {
        background: oklch(0.9 0 0);
      }

      .role-tab[aria-selected='true'] {
        background: oklch(1 0 0);
        box-shadow: 0 1px 3px oklch(0 0 0 / 0.1);
      }

      .role-tab:focus-visible {
        outline: 2px solid var(--_focus-color);
        outline-offset: 2px;
      }

      /* Role config grid */
      .role-config {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: var(--_gap);
      }

      .role-config .field__input,
      .role-config .field__select {
        inline-size: 100%;
        min-inline-size: 0;
      }

      /* Preview samples */
      .preview__samples {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.75rem 1.5rem;
        align-items: baseline;
      }

      .preview__sample-label {
        font-size: 0.6875rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: oklch(0.6 0 0);
        text-align: end;
        padding-block-start: 0.25em;
      }

      .preview__sample-text {
        margin: 0;
        transition: all 0.2s ease;
      }

      /* Scale visualization */
      .scale-viz {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
        flex-wrap: wrap;
        padding: 0.75rem;
        background: oklch(0.97 0 0);
        border-radius: calc(var(--_radius) * 0.75);
      }

      .scale-step {
        color: oklch(0.4 0 0);
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .role-tab,
        .preview__sample-text {
          transition: none;
        }
      }
    `,
  ];

  static properties = {
    fonts: { type: Array, state: true },
    scale: { type: String },
    baseSize: { type: Number, attribute: 'base-size' },
    roles: { type: Object, state: true },
    fluid: { type: Object, state: true },
    measure: { type: Object, state: true },
    _searchQuery: { type: String, state: true },
    _searchResults: { type: Array, state: true },
    _isSearching: { type: Boolean, state: true },
    _activeRole: { type: String, state: true },
    _previewText: { type: String, state: true },
  };

  private _searchDebounce: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.init();
  }

  init() {
    this.fonts = [
      { name: 'Inter', provider: 'google', loaded: true },
      { name: 'Georgia', provider: 'system', loaded: true },
    ];
    this.scale = 'Major Third';
    this.baseSize = 16;
    this.fluid = {
      enabled: false,
      min: '0.75',
      preferred: '0.5rem + 3cqi',
      max: '1.25',
    };
    this.measure = {
      value: 66,
      unit: 'ch',
    };
    this._searchQuery = '';
    this._searchResults = [];
    this._isSearching = false;
    this._activeRole = 'display';
    this._previewText = 'The quick brown fox jumps over the lazy dog';

    // Initialize role configs with defaults matching @utility font-* in utilities-typography.css
    const defaultConfig: RoleConfig = {
      fontFamily: 'Inter',
      weight: '400',
      style: 'normal',
      fontVariant: 'normal',
      lineHeight: '1.5',
      letterSpacing: 'normal',
      textDecoration: 'none',
      textTransform: 'none',
      textWrap: 'inherit',
      color: '#000000',
    };

    this.roles = {
      display: {
        ...defaultConfig,
        weight: '700',
        lineHeight: '1',
        letterSpacing: '-0.05em',
        textWrap: 'balance',
      },
      headline: {
        ...defaultConfig,
        weight: '700',
        lineHeight: '1.2',
        letterSpacing: '-0.025em',
        textWrap: 'balance',
      },
      title: {
        ...defaultConfig,
        weight: '600',
        lineHeight: '1.3',
        letterSpacing: '-0.015em',
        textWrap: 'balance',
      },
      flair: { ...defaultConfig, style: 'italic' },
      body: { ...defaultConfig, lineHeight: '1.5', textWrap: 'pretty' },
      quote: { ...defaultConfig, style: 'italic', lineHeight: '1.4', textWrap: 'balance' },
      caption: { ...defaultConfig, lineHeight: '1.4', color: '#666666' },
      cta: {
        ...defaultConfig,
        weight: '700',
        lineHeight: '1.2',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      },
      label: { ...defaultConfig, weight: '500', letterSpacing: '0.025em' },
      eyebrow: {
        ...defaultConfig,
        weight: '500',
        lineHeight: '1.2',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      },
    };
  }

  private async _searchFonts(query: string): Promise<void> {
    if (query.length < 2) {
      this._searchResults = [];
      return;
    }

    this._isSearching = true;

    try {
      // Using Google Fonts API (requires API key for production)
      // For demo, using a static list of popular fonts
      const popularFonts = [
        'Roboto',
        'Open Sans',
        'Lato',
        'Montserrat',
        'Oswald',
        'Source Sans Pro',
        'Raleway',
        'PT Sans',
        'Merriweather',
        'Noto Sans',
        'Playfair Display',
        'Poppins',
        'Ubuntu',
        'Roboto Condensed',
        'Roboto Slab',
        'Nunito',
        'Work Sans',
        'Fira Sans',
        'Quicksand',
        'Mulish',
        'Barlow',
        'Libre Baskerville',
        'IBM Plex Sans',
        'Inter',
        'Manrope',
        'DM Sans',
        'Space Grotesk',
      ];

      const filtered = popularFonts.filter((font) =>
        font.toLowerCase().includes(query.toLowerCase()),
      );

      this._searchResults = filtered.slice(0, 10);
    } catch (error) {
      console.error('Font search failed:', error);
      this._searchResults = [];
    } finally {
      this._isSearching = false;
    }
  }

  private _handleSearchInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    this._searchQuery = input.value;

    if (this._searchDebounce) {
      clearTimeout(this._searchDebounce);
    }

    this._searchDebounce = setTimeout(() => {
      this._searchFonts(this._searchQuery);
    }, 300);
  }

  private async _addFont(fontName: string): Promise<void> {
    if (this.fonts.some((f) => f.name === fontName)) return;

    // Load font from Google Fonts
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    this.fonts = [...this.fonts, { name: fontName, provider: 'google', loaded: true }];
    this._searchQuery = '';
    this._searchResults = [];

    this._dispatchChange();
  }

  private _removeFont(fontName: string): void {
    this.fonts = this.fonts.filter((f) => f.name !== fontName);
    this._dispatchChange();
  }

  private _handleScaleChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    this.scale = select.value;
    this._dispatchChange();
  }

  private _handleBaseSizeChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.baseSize = parseFloat(input.value) || 16;
    this._dispatchChange();
  }

  private _handleFluidToggle(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.fluid = { ...this.fluid, enabled: input.checked };
    this._dispatchChange();
  }

  private _handleFluidChange(property: 'min' | 'preferred' | 'max', value: string): void {
    this.fluid = { ...this.fluid, [property]: value };
    this._dispatchChange();
  }

  private _handleMeasureChange(property: 'value' | 'unit', value: string | number): void {
    this.measure = { ...this.measure, [property]: value };
    this._dispatchChange();
  }

  private _handleRoleChange(role: TypographyRole, property: keyof RoleConfig, value: string): void {
    this.roles = {
      ...this.roles,
      [role]: {
        ...this.roles[role],
        [property]: value,
      },
    };
    this._dispatchChange();
  }

  private _dispatchChange(): void {
    this.dispatchEvent(
      new CustomEvent('typography-change', {
        detail: {
          fonts: this.fonts,
          scale: this.scale,
          baseSize: this.baseSize,
          roles: this.roles,
          fluid: this.fluid,
          measure: this.measure,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _getScaleValue(): number {
    return TYPOGRAPHIC_SCALES[this.scale as keyof typeof TYPOGRAPHIC_SCALES] || 1.25;
  }

  private _calculateSize(step: number): number {
    const scale = this._getScaleValue();
    return this.baseSize * Math.pow(scale, step);
  }

  private _getRoleFontSize(role: TypographyRole): number {
    const sizeMap: Record<TypographyRole, number> = {
      display: 5,
      headline: 3,
      title: 2,
      flair: 0,
      body: 0,
      quote: 1,
      caption: -2,
      cta: 0,
      label: -1,
      eyebrow: -1,
    };
    return this._calculateSize(sizeMap[role]);
  }

  private _renderFontSection() {
    return html`
      <section class="section" part="section">
        <h3 class="section__title" part="section-title">Fonts</h3>
        <div class="section__content">
          <div class="font-search">
            <input
              type="text"
              class="field__input"
              placeholder="Search Google Fonts..."
              .value=${this._searchQuery}
              @input=${this._handleSearchInput}
              @focus=${() => this._searchQuery.length >= 2 && this._searchFonts(this._searchQuery)}
            />
            ${this._searchResults.length > 0 || this._isSearching
              ? html`
                  <div class="font-search__results">
                    ${this._isSearching
                      ? html`<div class="font-search__loading">Searching...</div>`
                      : this._searchResults.map(
                          (font) => html`
                            <button
                              type="button"
                              class="font-search__result"
                              style="font-family: '${font}', sans-serif"
                              @click=${() => this._addFont(font)}
                            >
                              ${font}
                            </button>
                          `,
                        )}
                  </div>
                `
              : null}
          </div>
          <div class="font-list">
            ${this.fonts.map(
              (font) => html`
                <span class="font-tag" style="font-family: '${font.name}', sans-serif">
                  ${font.name}
                  <button
                    type="button"
                    class="font-tag__remove"
                    aria-label="Remove ${font.name}"
                    @click=${() => this._removeFont(font.name)}
                  >
                    &times;
                  </button>
                </span>
              `,
            )}
          </div>
        </div>
      </section>
    `;
  }

  private _renderScaleSection() {
    return html`
      <section class="section" part="section">
        <h3 class="section__title" part="section-title">Scale</h3>
        <div class="section__content">
          <div class="field field--inline">
            <label class="field__label" for="scale-select">Ratio</label>
            <select
              id="scale-select"
              class="field__select"
              .value=${this.scale}
              @change=${this._handleScaleChange}
            >
              ${Object.entries(TYPOGRAPHIC_SCALES).map(
                ([name, value]) => html`
                  <option value=${name} ?selected=${this.scale === name}>${name} (${value})</option>
                `,
              )}
            </select>
          </div>
          <div class="field field--inline">
            <label class="field__label" for="base-size">Base Size</label>
            <input
              id="base-size"
              type="number"
              class="field__input field__input--number"
              .value=${String(this.baseSize)}
              min="10"
              max="24"
              step="1"
              @change=${this._handleBaseSizeChange}
            />
            <span>px</span>
          </div>
          <div class="scale-viz">
            ${[6, 5, 4, 3, 2, 1, 0].map((step) => {
              const size = this._calculateSize(step - 1);
              return html`
                <span
                  class="scale-step"
                  style="font-size: ${Math.min(size, 32)}px"
                  title="Step ${step}: ${size.toFixed(1)}px"
                >
                  Aa
                </span>
              `;
            })}
          </div>

          <div class="field field--checkbox">
            <input
              id="fluid-toggle"
              type="checkbox"
              class="field__checkbox"
              .checked=${this.fluid.enabled}
              @change=${this._handleFluidToggle}
            />
            <label class="field__label" for="fluid-toggle">Fluid Typography</label>
          </div>

          <div class="fluid-inputs">
            <div class="field">
              <label class="field__label" for="fluid-min">Min</label>
              <input
                id="fluid-min"
                type="text"
                class="field__input"
                placeholder="0.75"
                .value=${this.fluid.min}
                ?disabled=${!this.fluid.enabled}
                @change=${(e: Event) =>
                  this._handleFluidChange('min', (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="field">
              <label class="field__label" for="fluid-preferred">Preferred</label>
              <input
                id="fluid-preferred"
                type="text"
                class="field__input"
                placeholder="0.5rem + 3cqi"
                .value=${this.fluid.preferred}
                ?disabled=${!this.fluid.enabled}
                @change=${(e: Event) =>
                  this._handleFluidChange('preferred', (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="field">
              <label class="field__label" for="fluid-max">Max</label>
              <input
                id="fluid-max"
                type="text"
                class="field__input"
                placeholder="1.25"
                .value=${this.fluid.max}
                ?disabled=${!this.fluid.enabled}
                @change=${(e: Event) =>
                  this._handleFluidChange('max', (e.target as HTMLInputElement).value)}
              />
            </div>
          </div>

          <div class="field field--inline">
            <label class="field__label" for="measure-value">Measure</label>
            <div class="measure-inputs">
              <input
                id="measure-value"
                type="number"
                class="field__input field__input--number"
                .value=${String(this.measure.value)}
                min="20"
                max="120"
                step="1"
                @change=${(e: Event) =>
                  this._handleMeasureChange(
                    'value',
                    parseInt((e.target as HTMLInputElement).value) || 66,
                  )}
              />
              <select
                id="measure-unit"
                class="field__select"
                .value=${this.measure.unit}
                @change=${(e: Event) =>
                  this._handleMeasureChange('unit', (e.target as HTMLSelectElement).value)}
              >
                <option value="ch" ?selected=${this.measure.unit === 'ch'}>ch</option>
                <option value="rem" ?selected=${this.measure.unit === 'rem'}>rem</option>
                <option value="em" ?selected=${this.measure.unit === 'em'}>em</option>
                <option value="px" ?selected=${this.measure.unit === 'px'}>px</option>
              </select>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  private _renderRolesSection() {
    const config = this.roles[this._activeRole];

    return html`
      <section class="section" part="section">
        <h3 class="section__title" part="section-title">Roles</h3>
        <div class="section__content">
          <div class="role-tabs" role="tablist">
            ${TYPOGRAPHY_ROLES.map(
              (role) => html`
                <button
                  type="button"
                  class="role-tab"
                  role="tab"
                  aria-selected=${this._activeRole === role}
                  @click=${() => (this._activeRole = role)}
                >
                  ${role}
                </button>
              `,
            )}
          </div>

          <div class="role-config" role="tabpanel">
            <div class="field">
              <label class="field__label">Font Family</label>
              <select
                class="field__select"
                .value=${config.fontFamily}
                @change=${(e: Event) =>
                  this._handleRoleChange(
                    this._activeRole,
                    'fontFamily',
                    (e.target as HTMLSelectElement).value,
                  )}
              >
                ${this.fonts.map(
                  (font) => html`
                    <option value=${font.name} ?selected=${config.fontFamily === font.name}>
                      ${font.name}
                    </option>
                  `,
                )}
              </select>
            </div>

            <div class="field">
              <label class="field__label">Weight</label>
              <select
                class="field__select"
                .value=${config.weight}
                @change=${(e: Event) =>
                  this._handleRoleChange(
                    this._activeRole,
                    'weight',
                    (e.target as HTMLSelectElement).value,
                  )}
              >
                ${FONT_WEIGHTS.map(
                  (w) => html`
                    <option value=${w.value} ?selected=${config.weight === w.value}>
                      ${w.label}
                    </option>
                  `,
                )}
              </select>
            </div>

            <div class="field">
              <label class="field__label">Style</label>
              <select
                class="field__select"
                .value=${config.style}
                @change=${(e: Event) =>
                  this._handleRoleChange(
                    this._activeRole,
                    'style',
                    (e.target as HTMLSelectElement).value,
                  )}
              >
                ${FONT_STYLES.map(
                  (s) => html`
                    <option value=${s.value} ?selected=${config.style === s.value}>
                      ${s.label}
                    </option>
                  `,
                )}
              </select>
            </div>

            <div class="field">
              <label class="field__label">Line Height</label>
              <input
                type="text"
                class="field__input"
                .value=${config.lineHeight}
                @change=${(e: Event) =>
                  this._handleRoleChange(
                    this._activeRole,
                    'lineHeight',
                    (e.target as HTMLInputElement).value,
                  )}
              />
            </div>

            <div class="field">
              <label class="field__label">Letter Spacing</label>
              <input
                type="text"
                class="field__input"
                placeholder="e.g., -0.02em"
                .value=${config.letterSpacing}
                @change=${(e: Event) =>
                  this._handleRoleChange(
                    this._activeRole,
                    'letterSpacing',
                    (e.target as HTMLInputElement).value,
                  )}
              />
            </div>

            <div class="field">
              <label class="field__label">Variant</label>
              <select
                class="field__select"
                .value=${config.fontVariant}
                @change=${(e: Event) =>
                  this._handleRoleChange(
                    this._activeRole,
                    'fontVariant',
                    (e.target as HTMLSelectElement).value,
                  )}
              >
                ${FONT_VARIANTS.map(
                  (v) => html`
                    <option value=${v.value} ?selected=${config.fontVariant === v.value}>
                      ${v.label}
                    </option>
                  `,
                )}
              </select>
            </div>

            <div class="field">
              <label class="field__label">Decoration</label>
              <select
                class="field__select"
                .value=${config.textDecoration}
                @change=${(e: Event) =>
                  this._handleRoleChange(
                    this._activeRole,
                    'textDecoration',
                    (e.target as HTMLSelectElement).value,
                  )}
              >
                ${TEXT_DECORATIONS.map(
                  (d) => html`
                    <option value=${d.value} ?selected=${config.textDecoration === d.value}>
                      ${d.label}
                    </option>
                  `,
                )}
              </select>
            </div>

            <div class="field">
              <label class="field__label">Case</label>
              <select
                class="field__select"
                .value=${config.textTransform}
                @change=${(e: Event) =>
                  this._handleRoleChange(
                    this._activeRole,
                    'textTransform',
                    (e.target as HTMLSelectElement).value,
                  )}
              >
                ${TEXT_TRANSFORMS.map(
                  (t) => html`
                    <option value=${t.value} ?selected=${config.textTransform === t.value}>
                      ${t.label}
                    </option>
                  `,
                )}
              </select>
            </div>

            <div class="field">
              <label class="field__label">Wrap</label>
              <select
                class="field__select"
                .value=${config.textWrap}
                @change=${(e: Event) =>
                  this._handleRoleChange(
                    this._activeRole,
                    'textWrap',
                    (e.target as HTMLSelectElement).value,
                  )}
              >
                ${TEXT_WRAPS.map(
                  (w) => html`
                    <option value=${w.value} ?selected=${config.textWrap === w.value}>
                      ${w.label}
                    </option>
                  `,
                )}
              </select>
            </div>

            <div class="field">
              <label class="field__label">Colour</label>
              <input
                type="color"
                class="field__input field__input--color"
                .value=${config.color}
                @change=${(e: Event) =>
                  this._handleRoleChange(
                    this._activeRole,
                    'color',
                    (e.target as HTMLInputElement).value,
                  )}
              />
            </div>
          </div>
        </div>
      </section>
    `;
  }

  private _getFluidFontSize(staticSize: number): string {
    if (!this.fluid.enabled) {
      return `${staticSize}px`;
    }

    const { min, preferred, max } = this.fluid;

    // Parse min/max as multipliers or absolute values
    const minValue =
      min.includes('px') || min.includes('rem') ? min : `calc(${staticSize}px * ${min})`;
    const maxValue =
      max.includes('px') || max.includes('rem') ? max : `calc(${staticSize}px * ${max})`;

    // Preferred can be a complex expression
    const preferredValue =
      preferred.includes('cqi') || preferred.includes('vw') || preferred.includes('+')
        ? `calc(${staticSize}px * 0.5 + ${preferred.replace(/[\d.]+rem \+ /, '')})`
        : `calc(${staticSize}px * ${preferred})`;

    return `clamp(${minValue}, ${preferredValue}, ${maxValue})`;
  }

  private _renderPreviewContent() {
    const measureValue = `${this.measure.value}${this.measure.unit}`;

    return html`
      <div class="preview__samples">
        ${TYPOGRAPHY_ROLES.map((role) => {
          const config = this.roles[role];
          const staticSize = this._getRoleFontSize(role);
          const fontSize = this._getFluidFontSize(staticSize);

          return html`
            <div class="preview__sample-label">${role}</div>
            <p
              class="preview__sample-text"
              style="
                  font-family: '${config.fontFamily}', sans-serif;
                  font-size: ${fontSize};
                  font-weight: ${config.weight};
                  font-style: ${config.style};
                  font-variant: ${config.fontVariant};
                  line-height: ${config.lineHeight};
                  letter-spacing: ${config.letterSpacing};
                  text-decoration: ${config.textDecoration};
                  text-transform: ${config.textTransform};
                  text-wrap: ${config.textWrap};
                  color: ${config.color};
                  max-inline-size: ${measureValue};
                "
            >
              ${role === 'body'
                ? 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
                : this._previewText}
            </p>
          `;
        })}
      </div>
    `;
  }

  render() {
    return html`
      <wc-split-panel position="35" min-size="280" snap-points="35,50">
        <div slot="start" class="controls" part="controls">
          ${this._renderFontSection()} ${this._renderScaleSection()} ${this._renderRolesSection()}
        </div>
        <div slot="end" class="preview" part="preview">${this._renderPreviewContent()}</div>
      </wc-split-panel>
    `;
  }
}

if (!customElements.get('typography-config')) {
  customElements.define('typography-config', WCTypography);
}

declare global {
  interface HTMLElementTagNameMap {
    'typography-config': WCTypography;
  }
}
