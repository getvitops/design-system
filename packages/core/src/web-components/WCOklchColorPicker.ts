import { LitElement, css, type CSSResultGroup, type PropertyValues } from 'lit';
import { html } from '@lit-labs/signals';
import { BaseElement } from './BaseElement.js';
import {
  oklchToSrgb,
  oklchToP3,
  gamutMapOklchToHex,
  hexToOklch,
  type RgbResult,
} from '../utils/colors.js';

const MAX_CHROMA = 0.4;
/** Vertical sampling stride for rectangle mode block optimization. */
const SAMPLE_BLOCK = 4;

export class WCOklchColorPicker extends BaseElement {
  static formAssociated = true;
  static shadowRootOptions = { ...LitElement.shadowRootOptions, delegatesFocus: true };

  static styles: CSSResultGroup = [
    BaseElement.styles,
    css`
      :host {
        --_picker-size: var(--picker-size, 256px);
        --_slider-height: var(--slider-height, 24px);
        --_marker-size: var(--marker-size, 16px);
        --_focus-color: var(--focus-color, oklch(0.6 0.2 250));
        --_swatch-size: var(--swatch-size, 40px);
        --_gap: var(--gap, 0.75rem);
        --_radius: var(--radius, 0.5rem);

        display: none;
        flex-direction: column;
        align-items: center;
        gap: var(--_gap);
      }

      :host(:defined) {
        display: flex;
      }

      :host([disabled]) {
        opacity: 0.5;
        pointer-events: none;
      }

      .canvas-area {
        position: relative;
        inline-size: var(--_picker-size);
        block-size: var(--_picker-size);
        background: var(--_canvas-bg, oklch(0.95 0 0));
        border-radius: var(--_radius);
      }

      :host([mode="wheel"]) .canvas-area {
        border-radius: 50%;
      }

      canvas {
        inline-size: 100%;
        block-size: 100%;
        border-radius: var(--_radius);
        image-rendering: crisp-edges;
        cursor: crosshair;
      }

      :host([mode="wheel"]) canvas {
        border-radius: 50%;
      }

      .axis-label {
        position: absolute;
        font-size: 0.625rem;
        color: oklch(0.5 0 0);
        pointer-events: none;
        user-select: none;
      }

      .axis-label--x {
        inset-block-end: -1.25rem;
        inset-inline: 0;
        text-align: center;
      }

      .axis-label--y {
        inset-inline-start: -1.25rem;
        inset-block: 0;
        writing-mode: vertical-lr;
        rotate: 180deg;
        text-align: center;
      }

      :host([mode="wheel"]) .axis-label {
        display: none;
      }

      .marker {
        position: absolute;
        inset-block-start: 0;
        inset-inline-start: 0;
        inline-size: var(--_marker-size);
        block-size: var(--_marker-size);
        margin-block-start: calc(var(--_marker-size) / -2);
        margin-inline-start: calc(var(--_marker-size) / -2);
        border-radius: 50%;
        border: 2px solid oklch(1 0 0);
        box-shadow:
          0 0 0 1px oklch(0 0 0 / 0.3),
          0 2px 4px oklch(0 0 0 / 0.3);
        pointer-events: none;
        translate: calc(var(--_mx, 0) / 100 * var(--_picker-size)) calc(var(--_my, 0) / 100 * var(--_picker-size));
        transition: scale 0.1s ease;
      }

      .marker:focus-visible {
        outline: 2px solid var(--_focus-color);
        outline-offset: 2px;
        pointer-events: auto;
      }

      .marker--dragging {
        scale: 1.2;
        transition: none;
      }

      .slider-area {
        inline-size: var(--_picker-size);
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .slider-area label {
        font-size: 0.75rem;
        color: oklch(0.5 0 0);
        white-space: nowrap;
      }

      input[type="range"] {
        -webkit-appearance: none;
        appearance: none;
        flex: 1;
        block-size: var(--_slider-height);
        border-radius: calc(var(--_slider-height) / 2);
        border: 1px solid oklch(0.8 0 0);
        cursor: pointer;
      }

      input[type="range"].dragging {
        background: repeating-linear-gradient(
          -45deg,
          oklch(0.9 0 0),
          oklch(0.9 0 0) 3px,
          oklch(0.95 0 0) 3px,
          oklch(0.95 0 0) 6px
        ) !important;
      }

      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        inline-size: calc(var(--_slider-height) + 4px);
        block-size: calc(var(--_slider-height) + 4px);
        border-radius: 50%;
        background: oklch(1 0 0);
        border: 2px solid oklch(0.5 0 0);
        box-shadow: 0 1px 3px oklch(0 0 0 / 0.3);
      }

      input[type="range"]::-moz-range-thumb {
        inline-size: calc(var(--_slider-height) + 4px);
        block-size: calc(var(--_slider-height) + 4px);
        border-radius: 50%;
        background: oklch(1 0 0);
        border: 2px solid oklch(0.5 0 0);
        box-shadow: 0 1px 3px oklch(0 0 0 / 0.3);
      }

      input[type="range"]:focus-visible {
        outline: 2px solid var(--_focus-color);
        outline-offset: 2px;
      }

      .controls {
        display: flex;
        align-items: center;
        gap: var(--_gap);
        flex-wrap: wrap;
        justify-content: center;
      }

      .mode-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        inline-size: 2rem;
        block-size: 2rem;
        border-radius: 0.25rem;
        border: 1px solid oklch(0.8 0 0);
        background: oklch(0.98 0 0);
        cursor: pointer;
        padding: 0;
        color: oklch(0.4 0 0);
      }

      .mode-toggle:hover {
        background: oklch(0.95 0 0);
      }

      .mode-toggle:focus-visible {
        outline: 2px solid var(--_focus-color);
        outline-offset: 2px;
      }

      .mode-toggle svg {
        inline-size: 1.25rem;
        block-size: 1.25rem;
      }

      .swatch {
        inline-size: var(--_swatch-size);
        block-size: var(--_swatch-size);
        border-radius: 0.25rem;
        border: 1px solid oklch(0 0 0 / 0.1);
        box-shadow: 0 1px 3px oklch(0 0 0 / 0.1);
      }

      .output {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
      }

      .output__hex {
        font-family: monospace;
        font-size: 0.875rem;
        font-weight: 600;
        color: oklch(0.3 0 0);
      }

      .output__oklch {
        font-family: monospace;
        font-size: 0.75rem;
        color: oklch(0.5 0 0);
      }

      .output__gamut {
        font-size: 0.625rem;
        color: oklch(0.6 0.15 60);
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
        .marker {
          transition: none;
        }
      }
    `,
  ];

  static properties = {
    value: { type: String, reflect: true },
    name: { type: String, reflect: true },
    lightness: { type: Number },
    hue: { type: Number },
    chroma: { type: Number },
    mode: { type: String, reflect: true },
    disabled: { type: Boolean, reflect: true },
    _isDragging: { type: Boolean, state: true },
  };

  declare value: string;
  declare name: string;
  declare lightness: number;
  declare hue: number;
  declare chroma: number;
  declare mode: 'rectangle' | 'wheel';
  declare disabled: boolean;
  declare _isDragging: boolean;

  private _internals!: ElementInternals;
  private _canvasCtx: CanvasRenderingContext2D | null = null;
  private _imageData: ImageData | null = null;
  private _canvasW: number = 0;
  private _canvasH: number = 0;
  private _rafId: number | null = null;
  private _canvasRect: DOMRect | null = null;
  private _initialValue: string = '';
  private _useP3: boolean = false;
  private _convertFn: (l: number, c: number, h: number) => RgbResult = oklchToSrgb;


  constructor() {
    super();
    this._internals = this.attachInternals();
    this.init();
  }

  init() {
    this.value = '#636363';
    this.name = '';
    this.lightness = 0.5;
    this.hue = 0;
    this.chroma = 0;
    this.mode = 'rectangle';
    this.disabled = false;
    this._isDragging = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this._initialValue = this.value;

    if (this.value !== '#636363') {
      const { l, c, h } = hexToOklch(this.value);
      this.lightness = l;
      this.chroma = c;
      this.hue = h;
    }

    this._internals.setFormValue(this.value);
  }

  protected shouldUpdate(changedProperties: PropertyValues): boolean {
    // During drag, only allow the render that enters/exits drag state.
    // All other updates (hue, chroma) are handled imperatively by _updateDragUI.
    if (this._isDragging && !changedProperties.has('_isDragging')) {
      return false;
    }
    return true;
  }

  protected firstUpdated() {
    const canvas = this.renderRoot.querySelector<HTMLCanvasElement>('canvas');
    if (!canvas) return;

    // Match CSS pixel dimensions for sharp rendering
    const rect = canvas.getBoundingClientRect();
    this._canvasW = Math.round(rect.width);
    this._canvasH = Math.round(rect.height);
    canvas.width = this._canvasW;
    canvas.height = this._canvasH;

    // Try P3 canvas context
    let ctx = canvas.getContext('2d', { colorSpace: 'display-p3' } as any) as CanvasRenderingContext2D | null;
    if (ctx) {
      this._useP3 = true;
      this._convertFn = oklchToP3;
    } else {
      ctx = canvas.getContext('2d');
      this._useP3 = false;
      this._convertFn = oklchToSrgb;
    }

    this._canvasCtx = ctx;
    this._imageData = new ImageData(this._canvasW, this._canvasH);
    this._renderCanvas();
  }

  protected updated(changedProperties: PropertyValues): void {
    if (changedProperties.has('lightness') || changedProperties.has('mode')) {
      this._renderCanvas();
    }

    if (
      changedProperties.has('hue') ||
      changedProperties.has('chroma') ||
      changedProperties.has('lightness')
    ) {
      if (this._isDragging) {
        this.value = '-';
      } else {
        this._commitValue();
      }
    }
  }

  // -- Form callbacks --

  formResetCallback(): void {
    this.value = this._initialValue;
    const { l, c, h } = hexToOklch(this._initialValue);
    this.lightness = l;
    this.chroma = c;
    this.hue = h;
  }

  formDisabledCallback(disabled: boolean): void {
    this.disabled = disabled;
  }

  formStateRestoreCallback(state: string): void {
    this.value = state;
    const { l, c, h } = hexToOklch(state);
    this.lightness = l;
    this.chroma = c;
    this.hue = h;
  }

  // -- Canvas rendering --

  private _renderCanvas() {
    if (!this._canvasCtx || !this._imageData) return;

    const data = this._imageData.data;
    const convert = this._convertFn;
    const l = this.lightness;

    if (this.mode === 'rectangle') {
      this._renderRectangle(data, convert, l);
    } else {
      this._renderWheel(data, convert, l);
    }

    this._drawGamutBorder(data);
    this._canvasCtx.putImageData(this._imageData, 0, 0);
  }

  /** Darken in-gamut pixels adjacent to transparent out-of-gamut pixels. */
  private _drawGamutBorder(data: Uint8ClampedArray) {
    const w = this._canvasW;
    const h = this._canvasH;
    const borderPixels: number[] = [];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        if (data[idx + 3] !== 255) continue;

        const hasTransparentNeighbor =
          (x > 0 && data[(y * w + x - 1) * 4 + 3] === 0) ||
          (x < w - 1 && data[(y * w + x + 1) * 4 + 3] === 0) ||
          (y > 0 && data[((y - 1) * w + x) * 4 + 3] === 0) ||
          (y < h - 1 && data[((y + 1) * w + x) * 4 + 3] === 0);

        if (hasTransparentNeighbor) borderPixels.push(idx);
      }
    }

    for (const idx of borderPixels) {
      data[idx] = Math.round(data[idx] * 0.35);
      data[idx + 1] = Math.round(data[idx + 1] * 0.35);
      data[idx + 2] = Math.round(data[idx + 2] * 0.35);
    }
  }

  /**
   * Rectangle mode: hue on X, chroma on Y.
   * Uses block-based vertical sampling: sample every SAMPLE_BLOCK rows,
   * fill uniformly when gamut state is consistent, refine per-pixel at boundaries.
   */
  private _renderRectangle(
    data: Uint8ClampedArray,
    convert: (l: number, c: number, h: number) => RgbResult,
    l: number,
  ) {
    const w = this._canvasW;
    const h = this._canvasH;
    const block = SAMPLE_BLOCK;

    for (let x = 0; x < w; x++) {
      const hueVal = (x / (w - 1)) * 360;

      for (let y = 0; y < h; y += block) {
        const end = Math.min(y + block, h);
        const chromaTop = (1 - y / (h - 1)) * MAX_CHROMA;
        const topResult = convert(l, chromaTop, hueVal);

        const yBottom = end - 1;
        const chromaBottom = (1 - yBottom / (h - 1)) * MAX_CHROMA;
        const bottomResult = convert(l, chromaBottom, hueVal);

        if (topResult.inGamut === bottomResult.inGamut) {
          // Uniform block: fill with top pixel color (chroma delta is negligible)
          for (let dy = y; dy < end; dy++) {
            const idx = (dy * w + x) * 4;
            if (topResult.inGamut) {
              data[idx] = topResult.r;
              data[idx + 1] = topResult.g;
              data[idx + 2] = topResult.b;
              data[idx + 3] = 255;
            } else {
              data[idx + 3] = 0;
            }
          }
        } else {
          // Boundary block: compute every pixel for accurate edge
          for (let dy = y; dy < end; dy++) {
            const chromaVal = (1 - dy / (h - 1)) * MAX_CHROMA;
            const { r, g, b, inGamut } = convert(l, chromaVal, hueVal);
            const idx = (dy * w + x) * 4;
            if (inGamut) {
              data[idx] = r;
              data[idx + 1] = g;
              data[idx + 2] = b;
              data[idx + 3] = 255;
            } else {
              data[idx + 3] = 0;
            }
          }
        }
      }
    }
  }

  /** Wheel mode: per-pixel polar rendering (no block optimization due to hue variance). */
  private _renderWheel(
    data: Uint8ClampedArray,
    convert: (l: number, c: number, h: number) => RgbResult,
    l: number,
  ) {
    const w = this._canvasW;
    const h = this._canvasH;
    const centerX = (w - 1) / 2;
    const centerY = (h - 1) / 2;
    const radius = Math.min(centerX, centerY);
    const radiusSq = radius * radius;

    for (let y = 0; y < h; y++) {
      const dy = y - centerY;
      for (let x = 0; x < w; x++) {
        const dx = x - centerX;
        const distSq = dx * dx + dy * dy;
        const idx = (y * w + x) * 4;

        if (distSq > radiusSq) {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 0;
          continue;
        }

        const dist = Math.sqrt(distSq);
        const chromaVal = (dist / radius) * MAX_CHROMA;
        const hueVal = ((Math.atan2(-dy, dx) * 180) / Math.PI + 360) % 360;
        const { r, g, b, inGamut } = convert(l, chromaVal, hueVal);
        if (inGamut) {
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        } else {
          data[idx + 3] = 0;
        }
      }
    }
  }

  // -- Value updates --

  /** CSS gamut-mapped hex. Called on pointer up, keyboard step, and slider release. */
  private _commitValue() {
    this.value = gamutMapOklchToHex(
      this.lightness,
      this.chroma,
      this.hue,
      this._useP3 ? 'p3' : 'srgb',
    );
    this._internals.setFormValue(this.value);
  }

  // -- Marker position --

  private _getMarkerPosition(): { x: number; y: number } {
    if (this.mode === 'rectangle') {
      return {
        x: (this.hue / 360) * 100,
        y: (1 - this.chroma / MAX_CHROMA) * 100,
      };
    }

    // Wheel mode: polar to cartesian (as % of container)
    const normalizedChroma = this.chroma / MAX_CHROMA;
    const hueRad = (this.hue * Math.PI) / 180;
    return {
      x: 50 + Math.cos(hueRad) * normalizedChroma * 50,
      y: 50 - Math.sin(hueRad) * normalizedChroma * 50,
    };
  }

  // -- Pointer interaction --

  private _onCanvasPointerDown = (e: PointerEvent) => {
    if (this.disabled || e.button !== 0) return;

    e.preventDefault();
    this._isDragging = true;

    const canvas = this.renderRoot.querySelector<HTMLCanvasElement>('canvas');
    if (!canvas) return;

    this._canvasRect = canvas.getBoundingClientRect();
    canvas.setPointerCapture(e.pointerId);
    document.addEventListener('pointermove', this._onPointerMove);
    document.addEventListener('pointerup', this._onPointerUp);

    this._processPointerPosition(e);
    this._dispatchInputEvent();
  };

  private _onPointerMove = (e: PointerEvent) => {
    if (!this._isDragging || !this._canvasRect) return;

    if (this._rafId !== null) return;

    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this._processPointerPosition(e);
      this._dispatchInputEvent();
    });
  };

  private _onPointerUp = (e: PointerEvent) => {
    if (!this._isDragging) return;

    this._isDragging = false;

    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    this._processPointerPosition(e);

    const canvas = this.renderRoot.querySelector<HTMLCanvasElement>('canvas');
    canvas?.releasePointerCapture(e.pointerId);

    document.removeEventListener('pointermove', this._onPointerMove);
    document.removeEventListener('pointerup', this._onPointerUp);
    this._canvasRect = null;

    this._commitValue();
    this._dispatchChangeEvent();
  };

  private _processPointerPosition(e: PointerEvent) {
    if (!this._canvasRect) return;

    const rect = this._canvasRect;
    const px = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const py = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    if (this.mode === 'rectangle') {
      this.hue = Math.round(px * 360) % 360;
      this.chroma = Math.max(0, Math.min(MAX_CHROMA, (1 - py) * MAX_CHROMA));
    } else {
      // Wheel: convert cartesian to polar
      const dx = px - 0.5;
      const dy = -(py - 0.5);
      const dist = Math.min(0.5, Math.sqrt(dx * dx + dy * dy));
      this.chroma = (dist / 0.5) * MAX_CHROMA;
      this.hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      this.hue = Math.round(this.hue);
    }

    if (this._isDragging) {
      this._updateDragUI();
    }
  }

  /** Imperative DOM updates during drag — bypasses Lit's render cycle. */
  private _updateDragUI() {
    const marker = this.renderRoot.querySelector<HTMLElement>('.marker');
    if (marker) {
      const pos = this._getMarkerPosition();
      marker.style.setProperty('--_mx', String(pos.x));
      marker.style.setProperty('--_my', String(pos.y));
      marker.style.background = `oklch(${this.lightness} ${this.chroma} ${this.hue})`;
    }
  }

  // -- Keyboard interaction --

  private _onKeyDown = (e: KeyboardEvent) => {
    if (this.disabled) return;

    const hueStep = e.shiftKey ? 10 : 1;
    const chromaStep = e.shiftKey ? 0.05 : 0.005;
    let handled = false;

    switch (e.key) {
      case 'ArrowLeft':
        this.hue = ((this.hue - hueStep) % 360 + 360) % 360;
        handled = true;
        break;
      case 'ArrowRight':
        this.hue = (this.hue + hueStep) % 360;
        handled = true;
        break;
      case 'ArrowUp':
        this.chroma = Math.min(MAX_CHROMA, this.chroma + chromaStep);
        handled = true;
        break;
      case 'ArrowDown':
        this.chroma = Math.max(0, this.chroma - chromaStep);
        handled = true;
        break;
      case 'Home':
        this.hue = 0;
        handled = true;
        break;
      case 'End':
        this.hue = 359;
        handled = true;
        break;
    }

    if (handled) {
      e.preventDefault();
      this._dispatchInputEvent();
      this._dispatchChangeEvent();
    }
  };

  // -- Lightness slider --

  private _onLightnessInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    this.lightness = parseFloat(input.value);
    this._dispatchInputEvent();
  };

  private _onLightnessChange = () => {
    this._dispatchChangeEvent();
  };

  // -- Mode toggle --

  private _onModeToggle = () => {
    this.mode = this.mode === 'rectangle' ? 'wheel' : 'rectangle';
  };

  // -- Events --

  private _dispatchInputEvent() {
    this.dispatchEvent(
      new InputEvent('input', { bubbles: true, composed: true }),
    );
  }

  private _dispatchChangeEvent() {
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  // -- Gamut check --

  private _isCurrentInGamut(): boolean {
    return this._convertFn(this.lightness, this.chroma, this.hue).inGamut;
  }

  // -- Accessible description --

  private _getOklchString(): string {
    return `oklch(${(this.lightness * 100).toFixed(1)}% ${this.chroma.toFixed(3)} ${this.hue.toFixed(1)})`;
  }

  // -- Render --

  render() {
    const markerPos = this._getMarkerPosition();
    const oklchStr = this._getOklchString();
    const inGamut = this._isCurrentInGamut();

    return html`
      <div class="canvas-area" part="canvas-area">
        <canvas
          part="canvas"
          @pointerdown=${this._onCanvasPointerDown}
        ></canvas>
        <div
          class="marker ${this._isDragging ? 'marker--dragging' : ''}"
          part="marker"
          role="slider"
          tabindex="0"
          aria-label="Color selection"
          aria-roledescription="2D color slider"
          aria-valuetext="Hue ${Math.round(this.hue)}, Chroma ${this.chroma.toFixed(2)}"
          style="--_mx: ${markerPos.x}; --_my: ${markerPos.y}; background: ${this.value}"
          @keydown=${this._onKeyDown}
        ></div>
        <span class="axis-label axis-label--x" aria-hidden="true">Hue</span>
        <span class="axis-label axis-label--y" aria-hidden="true">Chroma</span>
      </div>

      <div class="slider-area" part="lightness-area">
        <label for="lightness-slider">L</label>
        <input
          id="lightness-slider"
          part="lightness-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          class="${this._isDragging ? 'dragging' : ''}"
          .value=${String(this.lightness)}
          style="${this._isDragging ? '' : `background: linear-gradient(to right, oklch(0 ${this.chroma} ${this.hue}), oklch(0.5 ${this.chroma} ${this.hue}), oklch(1 ${this.chroma} ${this.hue}))`}"
          @input=${this._onLightnessInput}
          @change=${this._onLightnessChange}
          ?disabled=${this.disabled}
          aria-label="Lightness"
        />
      </div>

      <div class="controls" part="controls">
        <button
          class="mode-toggle"
          part="mode-toggle"
          type="button"
          aria-label="Switch to ${this.mode === 'rectangle' ? 'wheel' : 'rectangle'} mode"
          @click=${this._onModeToggle}
          ?disabled=${this.disabled}
        >
          ${this.mode === 'rectangle'
            ? html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>`
            : html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>`}
        </button>

        <div
          class="swatch"
          part="swatch"
          style="background: ${this.value}"
          aria-hidden="true"
        ></div>

        <div class="output" part="output">
          <span class="output__hex">${this.value}</span>
          <span class="output__oklch">${oklchStr}</span>
          ${!inGamut ? html`<span class="output__gamut">gamut-mapped</span>` : ''}
        </div>
      </div>

      <div class="visually-hidden" role="status" aria-live="polite">
        Selected color: ${oklchStr}, hex ${this.value}
      </div>
    `;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    document.removeEventListener('pointermove', this._onPointerMove);
    document.removeEventListener('pointerup', this._onPointerUp);
  }
}

if (!customElements.get('oklch-color-picker')) {
  customElements.define('oklch-color-picker', WCOklchColorPicker);
}

declare global {
  interface HTMLElementTagNameMap {
    'oklch-color-picker': WCOklchColorPicker;
  }
}
