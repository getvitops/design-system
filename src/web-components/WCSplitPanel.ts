import { html, css, type PropertyValues } from 'lit';
import { BaseElement } from './BaseElement.js';
import { DragController } from './utils/DragController.js';

/**
 * Resizable split panel web component.
 *
 * @element wc-split-panel
 * @slot start - First panel content
 * @slot end - Second panel content
 *
 * @csspart container - The grid container
 * @csspart handle - The draggable divider
 * @csspart panel-start - First panel wrapper
 * @csspart panel-end - Second panel wrapper
 *
 * @cssprop --offset - Current position (0 to 1), defaults to internal --_offset
 * @cssprop --handle-size - Handle width/height (default: 8px)
 * @cssprop --handle-color - Handle background color
 * @cssprop --handle-hover-color - Handle hover/active color
 * @cssprop --min-panel-size - Minimum panel size (default: 100px)
 *
 * @fires split-change - Position changed, detail: { position: number }
 */
export class WCSplitPanel extends BaseElement {
  static styles = [
    BaseElement.styles,
    css`
      :host {
        --_offset: var(--offset, 0.5);
        --_handle-size: var(--handle-size, 8px);
        --_handle-color: var(--handle-color, oklch(0.85 0 0));
        --_handle-hover: var(--handle-hover-color, oklch(0.7 0 0));
        --_min-size: var(--min-panel-size, 100px);

        display: block;
      }

      .splitter {
        display: grid;
        block-size: 100%;
        inline-size: 100%;
      }

      :host(:not([vertical])) .splitter {
        grid-template-columns:
          calc(var(--_offset) * (100% - var(--_handle-size)))
          var(--_handle-size)
          calc((1 - var(--_offset)) * (100% - var(--_handle-size)));
        grid-template-rows: 1fr;
      }

      :host([vertical]) .splitter {
        grid-template-rows:
          calc(var(--_offset) * (100% - var(--_handle-size)))
          var(--_handle-size)
          calc((1 - var(--_offset)) * (100% - var(--_handle-size)));
        grid-template-columns: 1fr;
      }

      .panel {
        overflow: auto;
        min-inline-size: 0;
        min-block-size: 0;
      }

      .panel--start {
        grid-area: 1 / 1;
      }

      :host(:not([vertical])) .panel--end {
        grid-area: 1 / 3;
      }

      :host([vertical]) .panel--end {
        grid-area: 3 / 1;
      }

      .handle {
        flex-shrink: 0;
        background: var(--_handle-color);
        transition: background-color 0.15s ease;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .handle:hover,
      .handle:focus-visible {
        background: var(--_handle-hover);
      }

      .handle:focus-visible {
        outline: 2px solid oklch(0.6 0.2 250);
        outline-offset: -2px;
      }

      /* Horizontal handle */
      :host(:not([vertical])) .handle {
        cursor: col-resize;
        grid-area: 1 / 2;
      }

      /* Vertical handle */
      :host([vertical]) .handle {
        cursor: row-resize;
        grid-area: 2 / 1;
      }

      /* Handle grip indicator */
      .handle::after {
        content: '';
        background: currentColor;
        opacity: 0.3;
        border-radius: 1px;
      }

      :host(:not([vertical])) .handle::after {
        inline-size: 2px;
        block-size: 24px;
      }

      :host([vertical]) .handle::after {
        inline-size: 24px;
        block-size: 2px;
      }

      /* Dragging state */
      .handle.dragging {
        background: var(--_handle-hover);
      }

      .handle.dragging::after {
        opacity: 0.5;
      }

      /* Touch-friendly hit area */
      @media (any-pointer: coarse) {
        :host(:not([vertical])) .handle {
          min-inline-size: 44px;
        }

        :host([vertical]) .handle {
          min-block-size: 44px;
        }
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .handle {
          transition: none;
        }
      }
    `,
  ];

  // Static reactive properties (not decorators) to match the rest of the
  // web-components and keep the bundle decorator-free (tsdown ships browser JS).
  static properties = {
    position: { type: Number },
    vertical: { type: Boolean, reflect: true },
    discrete: { type: Boolean, reflect: true },
    minSize: { type: Number, attribute: 'min-size' },
    maxSize: { type: Number, attribute: 'max-size' },
    keyboardStep: { type: Number, attribute: 'keyboard-step' },
    collapseThreshold: { type: Number, attribute: 'collapse-threshold' },
    snapPoints: { type: String, attribute: 'snap-points' },
    snapDistance: { type: Number, attribute: 'snap-distance' },
    _offset: { state: true },
  };

  /** Initial position (0-100). */
  declare position: number;
  /** Vertical orientation. */
  declare vertical: boolean;
  /** Discrete mode: only update on drag end (snap on release, not continuous). */
  declare discrete: boolean;
  /** Minimum panel size in pixels. */
  declare minSize: number;
  /** Maximum panel size in pixels (0 = no max). */
  declare maxSize: number;
  /** Keyboard step percentage. */
  declare keyboardStep: number;
  /** Collapse threshold — if dragged below this %, collapse to 0. */
  declare collapseThreshold: number;
  /** Snap points (comma-separated percentages, e.g. "25,50,75"). */
  declare snapPoints: string;
  /** Snap distance in pixels. */
  declare snapDistance: number;

  declare private _offset: number;

  private dragController!: DragController;
  private containerSize = 0;

  constructor() {
    super();
    this.position = 50;
    this.vertical = false;
    this.discrete = false;
    this.minSize = 100;
    this.maxSize = 0;
    this.keyboardStep = 1;
    this.collapseThreshold = 0;
    this.snapPoints = '';
    this.snapDistance = 10;
    this._offset = 0.5;
    this.initDragController();
  }

  private initDragController() {
    this.dragController = new DragController(this, {
      handleSelector: '[part="handle"]',
      orientation: this.vertical ? 'vertical' : 'horizontal',
      smooth: !this.discrete,
      onDragStart: () => this.handleDragStart(),
      onDrag: (pos) => this.handleDrag(pos),
      onDragEnd: (pos) => this.handleDragEnd(pos),
      keyboardStep: this.keyboardStep / 100,
      keyboardLargeStep: this.keyboardStep / 10,
    });
  }

  willUpdate(changed: PropertyValues) {
    if (changed.has('position') && !changed.has('_offset')) {
      this._offset = this.position / 100;
      this.dragController.setPosition(this._offset);
    }
    if (changed.has('vertical') || changed.has('discrete') || changed.has('keyboardStep')) {
      this.dragController.updateOptions({
        orientation: this.vertical ? 'vertical' : 'horizontal',
        smooth: !this.discrete,
        keyboardStep: this.keyboardStep / 100,
        keyboardLargeStep: this.keyboardStep / 10,
      });
    }
  }

  private handleDragStart() {
    const container = this.renderRoot.querySelector('.splitter') as HTMLElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      this.containerSize = this.vertical ? rect.height : rect.width;
    }
  }

  private applyConstraints(rawPosition: number): number {
    let position = rawPosition;

    // Apply min/max constraints
    if (this.containerSize > 0) {
      const minPercent = this.minSize / this.containerSize;
      const maxPercent = this.maxSize > 0 ? this.maxSize / this.containerSize : 1 - minPercent;

      position = Math.max(minPercent, Math.min(1 - minPercent, position));
      position = Math.min(maxPercent, position);
    }

    // Apply snap points
    if (this.snapPoints && this.containerSize > 0) {
      const points = this.snapPoints.split(',').map((p) => parseFloat(p.trim()) / 100);
      const snapDistPercent = this.snapDistance / this.containerSize;

      for (const point of points) {
        if (Math.abs(position - point) < snapDistPercent) {
          position = point;
          break;
        }
      }
    }

    // Apply collapse threshold
    if (this.collapseThreshold > 0) {
      const threshold = this.collapseThreshold / 100;
      if (position < threshold) {
        position = 0;
      } else if (position > 1 - threshold) {
        position = 1;
      }
    }

    return position;
  }

  private handleDrag(rawPosition: number) {
    const position = this.applyConstraints(rawPosition);
    this._offset = position;
    this.style.setProperty('--_offset', String(this._offset));
  }

  private handleDragEnd(rawPosition: number) {
    const position = this.applyConstraints(rawPosition);
    this._offset = position;
    this.style.setProperty('--_offset', String(this._offset));

    this.dispatchEvent(
      new CustomEvent('split-change', {
        detail: { position: this._offset * 100 },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    return html`
      <div class="splitter" part="container" style="--_offset: ${this._offset}">
        <div class="panel panel--start" part="panel-start">
          <slot name="start"></slot>
        </div>
        <div
          class="handle"
          part="handle"
          role="separator"
          aria-label="Panel resize handle"
          aria-orientation="${this.vertical ? 'vertical' : 'horizontal'}"
        ></div>
        <div class="panel panel--end" part="panel-end">
          <slot name="end"></slot>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('wc-split-panel')) {
  customElements.define('wc-split-panel', WCSplitPanel);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-split-panel': WCSplitPanel;
  }
}
