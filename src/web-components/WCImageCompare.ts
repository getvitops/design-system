import { html, css, type PropertyValues } from 'lit';
import { BaseElement } from './BaseElement.js';
import { DragController } from './utils/DragController.js';

/**
 * Image comparison slider web component.
 *
 * @element wc-image-compare
 * @slot before - The "before" image (clipped)
 * @slot after - The "after" image (background)
 *
 * @csspart container - The outer container
 * @csspart handle - The draggable handle element
 * @csspart grip - The circular grip button
 * @csspart before - The before image container
 * @csspart after - The after image container
 *
 * @cssprop --offset - Current position (0 to 1), defaults to internal --_offset
 * @cssprop --handle-size - Handle grip diameter (default: 40px)
 * @cssprop --handle-color - Handle grip background (default: white)
 * @cssprop --line-color - Divider line color (default: white)
 * @cssprop --line-width - Divider line width (default: 2px)
 *
 * @fires compare-change - Position changed, detail: { position: number }
 */
export class WCImageCompare extends BaseElement {
  static styles = [
    BaseElement.styles,
    css`
      :host {
        --_offset: var(--offset, 0.5);
        --_handle-size: var(--handle-size, 40px);
        --_handle-color: var(--handle-color, white);
        --_line-color: var(--line-color, white);
        --_line-width: var(--line-width, 2px);

        display: block;
        position: relative;
        overflow: hidden;
        touch-action: pan-y;
        user-select: none;
      }

      :host([vertical]) {
        touch-action: pan-x;
      }

      .container {
        position: relative;
        display: grid;
      }

      .after,
      .before {
        grid-area: 1 / 1;
      }

      .after ::slotted(img),
      .before ::slotted(img) {
        display: block;
        inline-size: 100%;
        block-size: auto;
      }

      .before {
        clip-path: inset(0 calc((1 - var(--_offset)) * 100%) 0 0);
      }

      :host([vertical]) .before {
        clip-path: inset(0 0 calc((1 - var(--_offset)) * 100%) 0);
      }

      /* Handle positioning */
      .handle {
        position: absolute;
        inset-block: 0;
        inset-inline-start: calc(var(--_offset) * 100%);
        translate: -50% 0;
        inline-size: var(--_handle-size);
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: ew-resize;
        z-index: 1;
      }

      :host([vertical]) .handle {
        inset-block: auto;
        inset-block-start: calc(var(--_offset) * 100%);
        inset-inline: 0;
        translate: 0 -50%;
        flex-direction: row;
        cursor: ns-resize;
        block-size: var(--_handle-size);
        inline-size: 100%;
      }

      /* Divider line */
      .handle::before {
        content: '';
        position: absolute;
        inset-block: 0;
        inset-inline-start: 50%;
        translate: -50% 0;
        inline-size: var(--_line-width);
        background: var(--_line-color);
        box-shadow: 0 0 4px oklch(0 0 0 / 0.3);
        pointer-events: none;
      }

      :host([vertical]) .handle::before {
        inset-inline: 0;
        inset-block: auto;
        inset-block-start: 50%;
        translate: 0 -50%;
        inline-size: 100%;
        block-size: var(--_line-width);
      }

      /* Grip button */
      .grip {
        position: absolute;
        inset-block-start: 50%;
        inset-inline-start: 50%;
        translate: -50% -50%;
        inline-size: var(--_handle-size);
        block-size: var(--_handle-size);
        background: var(--_handle-color);
        border-radius: 50%;
        box-shadow: 0 2px 8px oklch(0 0 0 / 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        transition:
          scale 0.15s ease,
          box-shadow 0.15s ease;
      }

      /* Grip arrows */
      .grip::before,
      .grip::after {
        content: '';
        position: absolute;
        border: 5px solid transparent;
      }

      .grip::before {
        border-inline-end-color: oklch(0.3 0 0);
        inset-inline-start: 6px;
      }

      .grip::after {
        border-inline-start-color: oklch(0.3 0 0);
        inset-inline-end: 6px;
      }

      :host([vertical]) .grip::before {
        border-inline-end-color: transparent;
        border-block-end-color: oklch(0.3 0 0);
        inset-inline-start: auto;
        inset-block-start: 6px;
      }

      :host([vertical]) .grip::after {
        border-inline-start-color: transparent;
        border-block-start-color: oklch(0.3 0 0);
        inset-inline-end: auto;
        inset-block-end: 6px;
      }

      /* Hover/focus states */
      .handle:hover .grip,
      .handle:focus-visible .grip {
        scale: 1.1;
        box-shadow: 0 4px 12px oklch(0 0 0 / 0.3);
      }

      .handle:focus-visible {
        outline: none;
      }

      .handle:focus-visible .grip {
        outline: 2px solid oklch(0.6 0.2 250);
        outline-offset: 2px;
      }

      /* Dragging state */
      .handle.dragging .grip {
        scale: 1.15;
        box-shadow: 0 6px 16px oklch(0 0 0 / 0.35);
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .grip {
          transition: none;
        }
      }

      /* Touch-friendly hit area */
      @media (any-pointer: coarse) {
        .handle {
          min-inline-size: 44px;
        }

        :host([vertical]) .handle {
          min-block-size: 44px;
        }
      }

      /* Screen reader only */
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
    `,
  ];

  static properties = {
    position: { type: Number },
    vertical: { type: Boolean, reflect: true },
    discrete: { type: Boolean, reflect: true },
    keyboardStep: { type: Number, attribute: 'keyboard-step' },
    beforeLabel: { type: String, attribute: 'before-label' },
    afterLabel: { type: String, attribute: 'after-label' },
    _offset: { type: Number, state: true },
  };

  declare position: number;
  declare vertical: boolean;
  declare discrete: boolean;
  declare keyboardStep: number;
  declare beforeLabel: string;
  declare afterLabel: string;
  declare _offset: number;

  private dragController!: DragController;

  constructor() {
    super();
    this.init();
    this.initDragController();
  }

  init() {
    this.position = 50;
    this.vertical = false;
    this.discrete = false;
    this.keyboardStep = 1;
    this.beforeLabel = 'Before';
    this.afterLabel = 'After';
    this._offset = 0.5;
  }

  private initDragController() {
    this.dragController = new DragController(this, {
      handleSelector: '[part="handle"]',
      orientation: this.vertical ? 'vertical' : 'horizontal',
      smooth: !this.discrete,
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

  private handleDrag(position: number) {
    this._offset = position;
    this.style.setProperty('--_offset', String(this._offset));
  }

  private handleDragEnd(position: number) {
    this._offset = position;
    this.style.setProperty('--_offset', String(this._offset));

    this.dispatchEvent(
      new CustomEvent('compare-change', {
        detail: { position: this._offset * 100 },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    return html`
      <div class="container" part="container" style="--_offset: ${this._offset}">
        <div class="after" part="after" aria-label="${this.afterLabel}">
          <slot name="after"></slot>
        </div>
        <div class="before" part="before" aria-label="${this.beforeLabel}">
          <slot name="before"></slot>
        </div>
        <div
          class="handle"
          part="handle"
          role="separator"
          aria-label="Image comparison handle"
          aria-orientation="${this.vertical ? 'vertical' : 'horizontal'}"
        >
          <div class="grip" part="grip">
            <span class="visually-hidden">Drag to compare</span>
          </div>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('wc-image-compare')) {
  customElements.define('wc-image-compare', WCImageCompare);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-image-compare': WCImageCompare;
  }
}
