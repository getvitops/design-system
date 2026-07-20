import type { ReactiveController, ReactiveControllerHost } from 'lit';

export interface DragControllerHost extends ReactiveControllerHost {
  // Matches LitElement.renderRoot (HTMLElement | DocumentFragment). Only
  // querySelector is used, which both Element and DocumentFragment provide.
  renderRoot: Element | DocumentFragment;
}

export interface DragControllerOptions {
  /** CSS selector for the draggable handle element */
  handleSelector: string;
  /** Axis constraint: 'horizontal' | 'vertical' */
  orientation?: 'horizontal' | 'vertical';
  /** Use RAF during drag for smooth updates (default true) */
  smooth?: boolean;
  /** Callback with normalized position (0-1) during drag */
  onDrag?: (position: number) => void;
  /** Callback when drag starts */
  onDragStart?: () => void;
  /** Callback when drag ends with final position */
  onDragEnd?: (position: number) => void;
  /** Keyboard step increment (0-1 scale, default 0.01) */
  keyboardStep?: number;
  /** Keyboard large step for shift+arrow (0-1 scale, default 0.1) */
  keyboardLargeStep?: number;
}

/**
 * Reactive Controller for drag-based position control.
 * Handles pointer events, keyboard navigation, and accessibility.
 */
export class DragController implements ReactiveController {
  private host: DragControllerHost;
  private options: Required<DragControllerOptions>;
  private handleEl: HTMLElement | null = null;
  private isDragging = false;
  private rafId: number | null = null;
  private pendingPosition: number | null = null;
  private containerRect: DOMRect | null = null;
  private currentPosition = 0.5;
  private prefersReducedMotion = false;

  constructor(host: DragControllerHost, options: DragControllerOptions) {
    this.host = host;
    this.options = {
      handleSelector: options.handleSelector,
      orientation: options.orientation ?? 'horizontal',
      smooth: options.smooth ?? true,
      onDrag: options.onDrag ?? (() => {}),
      onDragStart: options.onDragStart ?? (() => {}),
      onDragEnd: options.onDragEnd ?? (() => {}),
      keyboardStep: options.keyboardStep ?? 0.01,
      keyboardLargeStep: options.keyboardLargeStep ?? 0.1,
    };
    host.addController(this);
  }

  hostConnected() {
    // Check reduced motion preference
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  hostUpdated() {
    this.setupHandle();
  }

  hostDisconnected() {
    this.cleanup();
  }

  /** Check if smooth updates should be used */
  private get shouldSmooth(): boolean {
    return this.options.smooth && !this.prefersReducedMotion;
  }

  private setupHandle() {
    const newHandle = this.host.renderRoot.querySelector(
      this.options.handleSelector,
    ) as HTMLElement | null;

    if (newHandle === this.handleEl) return;

    // Remove old listeners
    if (this.handleEl) {
      this.handleEl.removeEventListener('pointerdown', this.onPointerDown);
      this.handleEl.removeEventListener('keydown', this.onKeyDown);
    }

    this.handleEl = newHandle;

    if (this.handleEl) {
      this.handleEl.addEventListener('pointerdown', this.onPointerDown);
      this.handleEl.addEventListener('keydown', this.onKeyDown);

      // Ensure handle is focusable and has ARIA role
      if (!this.handleEl.hasAttribute('tabindex')) {
        this.handleEl.setAttribute('tabindex', '0');
      }
      if (!this.handleEl.hasAttribute('role')) {
        this.handleEl.setAttribute('role', 'separator');
      }
      this.handleEl.setAttribute('aria-valuemin', '0');
      this.handleEl.setAttribute('aria-valuemax', '100');
      this.updateAriaValue(this.currentPosition);
    }
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return; // Left click only

    e.preventDefault();
    this.isDragging = true;

    // Capture pointer for reliable tracking outside element
    this.handleEl?.setPointerCapture(e.pointerId);

    // Cache container rect for performance
    const container = this.handleEl?.parentElement;
    this.containerRect = container?.getBoundingClientRect() ?? null;

    // Add document-level listeners
    document.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerup', this.onPointerUp);
    document.addEventListener('pointercancel', this.onPointerUp);

    // Add visual feedback class
    this.handleEl?.classList.add('dragging');

    this.options.onDragStart();

    // Process initial position
    this.processPointerEvent(e);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.isDragging) return;
    this.processPointerEvent(e);
  };

  private processPointerEvent(e: PointerEvent) {
    if (!this.containerRect) return;

    const { orientation } = this.options;
    const rect = this.containerRect;

    let position: number;
    if (orientation === 'horizontal') {
      const x = e.clientX - rect.left;
      position = Math.max(0, Math.min(1, x / rect.width));
    } else {
      const y = e.clientY - rect.top;
      position = Math.max(0, Math.min(1, y / rect.height));
    }

    this.pendingPosition = position;

    if (this.shouldSmooth) {
      // RAF throttling - batch DOM updates
      if (this.rafId === null) {
        this.rafId = requestAnimationFrame(this.flushPosition);
      }
    }
    // Non-smooth mode: don't update during drag, only on end
  }

  private flushPosition = () => {
    this.rafId = null;
    if (this.pendingPosition !== null && this.isDragging) {
      this.currentPosition = this.pendingPosition;
      this.updateAriaValue(this.currentPosition);
      this.options.onDrag(this.currentPosition);
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.handleEl?.releasePointerCapture(e.pointerId);
    this.containerRect = null;

    // Cancel any pending RAF
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // Get final position
    const finalPosition = this.pendingPosition ?? this.currentPosition;
    this.currentPosition = finalPosition;
    this.pendingPosition = null;

    // Update ARIA and call onDragEnd
    this.updateAriaValue(finalPosition);
    this.options.onDragEnd(finalPosition);

    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerup', this.onPointerUp);
    document.removeEventListener('pointercancel', this.onPointerUp);

    this.handleEl?.classList.remove('dragging');
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const { orientation, keyboardStep, keyboardLargeStep } = this.options;
    const step = e.shiftKey ? keyboardLargeStep : keyboardStep;

    let delta = 0;

    if (orientation === 'horizontal') {
      if (e.key === 'ArrowLeft') delta = -step;
      else if (e.key === 'ArrowRight') delta = step;
    } else {
      if (e.key === 'ArrowUp') delta = -step;
      else if (e.key === 'ArrowDown') delta = step;
    }

    // Home/End for quick jumps
    if (e.key === 'Home') {
      e.preventDefault();
      this.currentPosition = 0;
      this.updateAriaValue(0);
      this.options.onDrag(0);
      this.options.onDragEnd(0);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      this.currentPosition = 1;
      this.updateAriaValue(1);
      this.options.onDrag(1);
      this.options.onDragEnd(1);
      return;
    }

    if (delta !== 0) {
      e.preventDefault();
      const newPosition = Math.max(0, Math.min(1, this.currentPosition + delta));
      this.currentPosition = newPosition;
      this.updateAriaValue(newPosition);
      this.options.onDrag(newPosition);
      this.options.onDragEnd(newPosition);
    }
  };

  private updateAriaValue(position: number) {
    const percentage = Math.round(position * 100);
    this.handleEl?.setAttribute('aria-valuenow', String(percentage));
  }

  private cleanup() {
    if (this.handleEl) {
      this.handleEl.removeEventListener('pointerdown', this.onPointerDown);
      this.handleEl.removeEventListener('keydown', this.onKeyDown);
    }
    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerup', this.onPointerUp);
    document.removeEventListener('pointercancel', this.onPointerUp);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
  }

  /** Programmatically set position (0-1) */
  setPosition(position: number) {
    this.currentPosition = Math.max(0, Math.min(1, position));
    this.updateAriaValue(this.currentPosition);
  }

  /** Get current position (0-1) */
  getPosition(): number {
    return this.currentPosition;
  }

  /** Update options dynamically */
  updateOptions(options: Partial<DragControllerOptions>) {
    Object.assign(this.options, options);
  }
}
