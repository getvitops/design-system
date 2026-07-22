import { html, css, svg, type CSSResultGroup, type PropertyValues } from 'lit';
import { BaseElement } from './BaseElement.js';
import {
  oklchToHex,
  hexToOklch,
  HARMONY_TYPES,
  HARMONY_DEFINITIONS,
  type HarmonyType,
} from '../utils/colors.js';

interface ColorOutput {
  oklch: string;
  hex: string;
  h: number;
  c: number;
  l: number;
}

export class WCColorWheel extends BaseElement {
  static styles: CSSResultGroup = [
    BaseElement.styles,
    css`
      :host {
        --_wheel-size: var(--wheel-size, 200px);
        --_marker-size: var(--marker-size, 20px);
        --_marker-size-primary: var(--marker-size-primary, 28px);
        --_marker-border: var(--marker-border, 2px);
        --_marker-border-primary: var(--marker-border-primary, 3px);
        --_line-color: var(--line-color, oklch(1 0 0 / 0.8));
        --_line-width: var(--line-width, 2px);
        --_focus-color: var(--focus-color, oklch(0.6 0.2 250));
        --_swatch-size: var(--swatch-size, 60px);

        display: none;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
      }

      :host(:defined) {
        display: flex;
      }

      .controls {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        justify-content: center;
      }

      .harmony-select {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .harmony-select label {
        font-size: 0.875rem;
        color: oklch(0.5 0 0);
      }

      .harmony-select select {
        padding: 0.375rem 0.75rem;
        border: 1px solid oklch(0.8 0 0);
        border-radius: 0.25rem;
        background: oklch(0.98 0 0);
        font-size: 0.875rem;
        cursor: pointer;
      }

      .harmony-select select:focus-visible {
        outline: 2px solid var(--_focus-color);
        outline-offset: 2px;
      }

      .wheel-container {
        position: relative;
        inline-size: var(--_wheel-size);
        block-size: var(--_wheel-size);
      }

      .wheel {
        inline-size: 100%;
        block-size: 100%;
        border-radius: 50%;
        background: conic-gradient(
          from 0deg,
          oklch(var(--_l, 0.7) var(--_c, 0.15) 0),
          oklch(var(--_l, 0.7) var(--_c, 0.15) 30),
          oklch(var(--_l, 0.7) var(--_c, 0.15) 60),
          oklch(var(--_l, 0.7) var(--_c, 0.15) 90),
          oklch(var(--_l, 0.7) var(--_c, 0.15) 120),
          oklch(var(--_l, 0.7) var(--_c, 0.15) 150),
          oklch(var(--_l, 0.7) var(--_c, 0.15) 180),
          oklch(var(--_l, 0.7) var(--_c, 0.15) 210),
          oklch(var(--_l, 0.7) var(--_c, 0.15) 240),
          oklch(var(--_l, 0.7) var(--_c, 0.15) 270),
          oklch(var(--_l, 0.7) var(--_c, 0.15) 300),
          oklch(var(--_l, 0.7) var(--_c, 0.15) 330),
          oklch(var(--_l, 0.7) var(--_c, 0.15) 360)
        );
      }

      .lines {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .markers {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .marker {
        position: absolute;
        inset-block-start: 50%;
        inset-inline-start: 50%;
        inline-size: var(--_marker-size);
        block-size: var(--_marker-size);
        margin-block-start: calc(var(--_marker-size) / -2);
        margin-inline-start: calc(var(--_marker-size) / -2);
        border-radius: 50%;
        border: var(--_marker-border) solid oklch(1 0 0);
        box-shadow:
          0 2px 4px oklch(0 0 0 / 0.3),
          inset 0 0 0 1px oklch(0 0 0 / 0.1);
        pointer-events: auto;
        transform: translate(var(--_x, 0), var(--_y, 0));
        transition:
          scale 0.15s ease,
          box-shadow 0.15s ease;
      }

      .marker--primary {
        --_marker-size: var(--_marker-size-primary);
        border-width: var(--_marker-border-primary);
        border-color: oklch(1 0 0);
        box-shadow:
          0 0 0 2px oklch(0 0 0 / 0.3),
          0 4px 8px oklch(0 0 0 / 0.4),
          inset 0 0 0 1px oklch(1 0 0 / 0.3);
        cursor: grab;
        z-index: 1;
      }

      .marker--primary:hover {
        scale: 1.1;
        box-shadow:
          0 0 0 2px oklch(0 0 0 / 0.4),
          0 6px 12px oklch(0 0 0 / 0.5),
          inset 0 0 0 1px oklch(1 0 0 / 0.3);
      }

      .marker--primary:focus-visible {
        outline: 2px solid var(--_focus-color);
        outline-offset: 2px;
      }

      .marker--primary.dragging {
        cursor: grabbing;
        scale: 1.15;
      }

      .marker--secondary {
        cursor: default;
        opacity: 0.85;
        border-color: oklch(1 0 0 / 0.8);
      }

      .marker--secondary:hover {
        scale: 1.05;
      }

      /* Swatches layout */
      .swatches {
        display: flex;
        align-items: stretch;
        gap: 0;
        flex-wrap: wrap;
        justify-content: center;
      }

      .swatch-group {
        display: flex;
        gap: 0.25rem;
      }

      .swatch-group--primary {
        padding-inline-end: 0.75rem;
      }

      .swatch-separator {
        inline-size: 1px;
        align-self: stretch;
        background: oklch(0.7 0 0);
        margin-inline: 0.5rem;
      }

      .swatch-group--computed {
        padding-inline-start: 0.75rem;
      }

      .swatch-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
      }

      .swatch {
        inline-size: var(--_swatch-size);
        block-size: var(--_swatch-size);
        border-radius: 0.25rem;
        cursor: pointer;
        transition: transform 0.15s ease;
        border: 1px solid oklch(0 0 0 / 0.1);
      }

      .swatch:hover {
        transform: translateY(-2px);
      }

      .swatch--primary {
        inline-size: calc(var(--_swatch-size) * 1.2);
        block-size: calc(var(--_swatch-size) * 1.2);
        box-shadow: 0 2px 8px oklch(0 0 0 / 0.3);
      }

      .swatch__label {
        font-family: monospace;
        font-size: 0.625rem;
        font-weight: 600;
        text-transform: uppercase;
        color: oklch(0.5 0 0);
      }

      .swatch__hex {
        font-family: monospace;
        font-size: 0.75rem;
        font-weight: 500;
        color: oklch(0.4 0 0);
      }

      /* Color picker popover */
      .picker-trigger {
        position: relative;
      }

      .picker-popover {
        position: absolute;
        inset-block-start: 100%;
        inset-inline-start: 50%;
        translate: -50% 0.5rem;
        background: oklch(0.98 0 0);
        border: 1px solid oklch(0.85 0 0);
        border-radius: 0.5rem;
        padding: 1rem;
        box-shadow: 0 4px 16px oklch(0 0 0 / 0.15);
        z-index: 10;
        display: none;
      }

      .picker-popover[open] {
        display: block;
      }

      .picker-popover input[type='color'] {
        inline-size: 100%;
        block-size: 48px;
        border: none;
        border-radius: 0.25rem;
        cursor: pointer;
        padding: 0;
      }

      .picker-popover input[type='color']::-webkit-color-swatch-wrapper {
        padding: 0;
      }

      .picker-popover input[type='color']::-webkit-color-swatch {
        border: none;
        border-radius: 0.25rem;
      }

      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      @media (prefers-reduced-motion: reduce) {
        .marker,
        .swatch-wrapper color-swatch {
          transition: none;
        }
      }
    `,
  ];

  static properties = {
    hue: { type: Number, reflect: true },
    chroma: { type: Number, reflect: true },
    lightness: { type: Number, reflect: true },
    harmony: { type: String, reflect: true },
    harmonies: {
      converter: {
        fromAttribute(value: string | null) {
          if (!value) return undefined;
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed;
          } catch {
            /* not JSON, ignore */
          }
          return undefined;
        },
        toAttribute(value: HarmonyType[] | undefined) {
          if (!value) return null;
          return JSON.stringify(value);
        },
      },
    },
    showSwatches: { type: Boolean, attribute: 'show-swatches' },
    showPicker: { type: Boolean, attribute: 'show-picker' },
    _isDragging: { type: Boolean, state: true },
    _wheelSize: { type: Number, state: true },
    _pickerOpen: { type: Boolean, state: true },
  };

  declare hue: number;
  declare chroma: number;
  declare lightness: number;
  declare harmony: HarmonyType;
  declare harmonies: HarmonyType[] | undefined;
  declare showSwatches: boolean;
  declare showPicker: boolean;
  declare _wheelSize: number;
  declare _pickerOpen: boolean;
  private _isDragging: boolean = false;

  #wheelCenter: { x: number; y: number } | null = null;
  #wheelRadius: number = 0;
  #resizeObserver: ResizeObserver | null = null;

  constructor() {
    super();
    this.init();
  }

  init() {
    this.hue = 0;
    this.chroma = 0.15;
    this.lightness = 0.7;
    this.harmony = 'single';
    this.harmonies = undefined;
    this.showSwatches = true;
    this.showPicker = false;
    this._isDragging = false;
    this._wheelSize = 200;
    this._pickerOpen = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this.#setupResizeObserver();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
  }

  #setupResizeObserver() {
    this.#resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target.classList.contains('wheel-container')) {
          this._wheelSize = entry.contentRect.width;
        }
      }
    });
  }

  protected firstUpdated() {
    const wheelContainer = this.renderRoot.querySelector('.wheel-container');
    if (wheelContainer) {
      this.#resizeObserver?.observe(wheelContainer);
      this._wheelSize = (wheelContainer as HTMLElement).offsetWidth || 200;
    }
  }

  protected updated(changedProperties: PropertyValues): void {
    if (changedProperties.has('lightness') || changedProperties.has('chroma')) {
      this.#updateWheelGradient();
    }
  }

  #updateWheelGradient() {
    const wheel = this.renderRoot.querySelector<HTMLElement>('.wheel');
    if (wheel) {
      wheel.style.setProperty('--_l', String(this.lightness));
      wheel.style.setProperty('--_c', String(this.chroma));
    }
  }

  #normalizeHue(hue: number): number {
    return ((hue % 360) + 360) % 360;
  }

  #getHarmonyHues(): number[] {
    const definition = HARMONY_DEFINITIONS[this.harmony];
    if (!definition) return [this.hue];
    return definition.offsets.map((offset) => this.#normalizeHue(this.hue + offset));
  }

  #getPrimaryIndex(): number {
    const definition = HARMONY_DEFINITIONS[this.harmony];
    return definition?.primaryIndex ?? 0;
  }

  #getHarmonyColors(): ColorOutput[] {
    return this.#getHarmonyHues().map((h) => {
      const l = this.lightness;
      const c = this.chroma;
      const oklch = `oklch(${(l * 100).toFixed(1)}% ${c} ${h})`;
      return {
        oklch,
        hex: oklchToHex({ l, c, h }),
        h,
        c,
        l,
      };
    });
  }

  #getPrimaryColor(): ColorOutput {
    const colors = this.#getHarmonyColors();
    const primaryIndex = this.#getPrimaryIndex();
    // Harmony always yields at least one colour; primaryIndex is in range.
    return colors[primaryIndex] as ColorOutput;
  }

  #getComputedColors(): ColorOutput[] {
    const colors = this.#getHarmonyColors();
    const primaryIndex = this.#getPrimaryIndex();
    return colors.filter((_, i) => i !== primaryIndex);
  }

  #getMarkerPosition(hue: number): { x: number; y: number } {
    const size = this._wheelSize;
    const radius = size * 0.42;
    const angleRad = (hue - 90) * (Math.PI / 180);
    return {
      x: Math.cos(angleRad) * radius,
      y: Math.sin(angleRad) * radius,
    };
  }

  #onPointerDown = (e: PointerEvent) => {
    const marker = (e.target as HTMLElement).closest('.marker--primary');
    if (!marker) return;

    e.preventDefault();
    this._isDragging = true;
    marker.classList.add('dragging');

    const wheelEl = this.renderRoot.querySelector<HTMLElement>('.wheel-container');
    if (wheelEl) {
      const rect = wheelEl.getBoundingClientRect();
      this.#wheelCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      this.#wheelRadius = rect.width / 2;
    }

    (marker as HTMLElement).setPointerCapture(e.pointerId);
    document.addEventListener('pointermove', this.#onPointerMove);
    document.addEventListener('pointerup', this.#onPointerUp);
  };

  #onPointerMove = (e: PointerEvent) => {
    if (!this._isDragging || !this.#wheelCenter) return;

    const dx = e.clientX - this.#wheelCenter.x;
    const dy = e.clientY - this.#wheelCenter.y;

    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    angle = this.#normalizeHue(angle + 90);

    this.hue = Math.round(angle);
    this.#dispatchColorChange(false);
  };

  #onPointerUp = () => {
    if (!this._isDragging) return;

    this._isDragging = false;
    const marker = this.renderRoot.querySelector('.marker--primary');
    marker?.classList.remove('dragging');

    document.removeEventListener('pointermove', this.#onPointerMove);
    document.removeEventListener('pointerup', this.#onPointerUp);

    this.#dispatchColorChange(true);
  };

  #onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1;

    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        this.hue = this.#normalizeHue(this.hue - step);
        this.#dispatchColorChange();
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        this.hue = this.#normalizeHue(this.hue + step);
        this.#dispatchColorChange();
        break;
      case 'Home':
        e.preventDefault();
        this.hue = 0;
        this.#dispatchColorChange();
        break;
      case 'End':
        e.preventDefault();
        this.hue = 359;
        this.#dispatchColorChange();
        break;
    }
  };

  #onHarmonyChange = (e: Event) => {
    const select = e.target as HTMLSelectElement;
    this.harmony = select.value as HarmonyType;
    this.#dispatchColorChange();
  };

  #onPickerColorChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const hex = input.value;
    const { l, c, h } = hexToOklch(hex);
    this.lightness = l;
    this.chroma = c;
    this.hue = h;
    this.#dispatchColorChange();
  };

  #togglePicker = () => {
    this._pickerOpen = !this._pickerOpen;
  };

  #dispatchColorChange(isFinal = true): void {
    const colors = this.#getHarmonyColors();
    const primaryIndex = this.#getPrimaryIndex();

    this.dispatchEvent(
      new CustomEvent('color-change', {
        detail: {
          primary: colors[primaryIndex],
          harmony: this.harmony,
          colors,
          isFinal,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #onSwatchClick = async (color: ColorOutput) => {
    try {
      await navigator.clipboard.writeText(color.hex);
    } catch {
      // Clipboard not available
    }
  };

  #getAccessibleDescription(): string {
    const colors = this.#getHarmonyColors();
    return `Primary hue: ${this.hue} degrees. ${colors.length} colors in ${this.harmony} harmony.`;
  }

  #renderConnectingLines() {
    const hues = this.#getHarmonyHues();
    if (hues.length < 2) return null;

    const size = this._wheelSize;
    const center = size / 2;

    const positions = hues.map((h) => {
      const pos = this.#getMarkerPosition(h);
      return { x: center + pos.x, y: center + pos.y };
    });

    const lines = [];

    for (let i = 0; i < positions.length; i++) {
      const nextIndex = (i + 1) % positions.length;
      if (i === positions.length - 1 && positions.length <= 2) continue;
      const from = positions[i];
      const to = positions[nextIndex];
      if (!from || !to) continue;

      lines.push(svg`
        <line
          x1="${from.x}"
          y1="${from.y}"
          x2="${to.x}"
          y2="${to.y}"
          stroke="var(--_line-color)"
          stroke-width="var(--_line-width)"
        />
      `);
    }

    return svg`
      <svg class="lines" part="lines" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        ${lines}
      </svg>
    `;
  }

  #renderMarker(hue: number, index: number, color: ColorOutput, primaryIndex: number) {
    const pos = this.#getMarkerPosition(hue);
    const isPrimary = index === primaryIndex;

    return html`
      <div
        class="marker ${isPrimary ? 'marker--primary' : 'marker--secondary'}"
        part="marker${isPrimary ? ' marker-primary' : ''}"
        style="--_x: ${pos.x}px; --_y: ${pos.y}px; background: ${color.oklch}"
        role="${isPrimary ? 'slider' : 'presentation'}"
        aria-label="${isPrimary ? 'Primary color hue' : ''}"
        aria-valuenow="${isPrimary ? this.hue : ''}"
        aria-valuemin="${isPrimary ? '0' : ''}"
        aria-valuemax="${isPrimary ? '360' : ''}"
        tabindex="${isPrimary ? '0' : '-1'}"
        @pointerdown=${isPrimary ? this.#onPointerDown : null}
        @keydown=${isPrimary ? this.#onKeyDown : null}
      ></div>
    `;
  }

  render() {
    const harmonyHues = this.#getHarmonyHues();
    const colors = this.#getHarmonyColors();
    const primaryIndex = this.#getPrimaryIndex();
    const primaryColor = this.#getPrimaryColor();
    const computedColors = this.#getComputedColors();

    return html`
      <div class="container" part="container">
        <div class="controls" part="controls">
          ${this.harmonies
            ? html`
                <div class="harmony-select" part="harmony-select">
                  <label for="harmony-type">Harmony</label>
                  <select
                    id="harmony-type"
                    part="select"
                    .value=${this.harmony}
                    @change=${this.#onHarmonyChange}
                  >
                    ${this.harmonies.map(
                      (key) => html`
                        <option value=${key} ?selected=${this.harmony === key}>
                          ${HARMONY_DEFINITIONS[key].label}
                        </option>
                      `,
                    )}
                  </select>
                </div>
              `
            : ''}
        </div>

        <div class="wheel-container" part="wheel-container">
          <div
            class="wheel"
            part="wheel"
            style="--_l: ${this.lightness}; --_c: ${this.chroma}"
          ></div>

          ${this.#renderConnectingLines()}

          <div class="markers" part="markers">
            ${harmonyHues.map((hue, index) =>
              this.#renderMarker(hue, index, colors[index] as ColorOutput, primaryIndex),
            )}
          </div>
        </div>

        ${this.showSwatches
          ? html`
              <div class="swatches" part="swatches">
                <div class="swatch-group swatch-group--primary">
                  <div class="swatch-wrapper swatch-wrapper--primary picker-trigger">
                    <div
                      class="swatch swatch--primary"
                      part="swatch swatch-primary"
                      style="background: ${primaryColor.oklch}"
                      @click=${this.showPicker
                        ? this.#togglePicker
                        : () => this.#onSwatchClick(primaryColor)}
                      title="${this.showPicker ? 'Click to edit' : 'Click to copy'}"
                      role="button"
                      tabindex="0"
                    ></div>
                    <span class="swatch__label">Primary</span>
                    <span class="swatch__hex">${primaryColor.hex}</span>
                    ${this.showPicker
                      ? html`
                          <div class="picker-popover" part="picker" ?open=${this._pickerOpen}>
                            <input
                              type="color"
                              .value=${primaryColor.hex}
                              @input=${this.#onPickerColorChange}
                              aria-label="Pick primary color"
                            />
                          </div>
                        `
                      : ''}
                  </div>
                </div>

                ${computedColors.length > 0
                  ? html`
                      <div class="swatch-separator" part="separator"></div>
                      <div class="swatch-group swatch-group--computed">
                        ${computedColors.map(
                          (color) => html`
                            <div class="swatch-wrapper">
                              <div
                                class="swatch"
                                part="swatch"
                                style="background: ${color.oklch}"
                                @click=${() => this.#onSwatchClick(color)}
                                title="Click to copy"
                                role="button"
                                tabindex="0"
                              ></div>
                              <span class="swatch__hex">${color.hex}</span>
                            </div>
                          `,
                        )}
                      </div>
                    `
                  : ''}
              </div>
            `
          : ''}

        <div class="visually-hidden" role="status" aria-live="polite">
          ${this.#getAccessibleDescription()}
        </div>
      </div>
    `;
  }
}

if (!customElements.get('color-wheel')) {
  customElements.define('color-wheel', WCColorWheel);
}

declare global {
  interface HTMLElementTagNameMap {
    'color-wheel': WCColorWheel;
  }
}
