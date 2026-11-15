/**
 * @vitest-environment happy-dom
 *
 * `js/tooltip.ts`: a plain tooltip is described by its text; a toggletip (`.tooltip--toggle`) is
 * reported through `aria-expanded`, opens on hover or focus like a tooltip, and once clicked open
 * stays open when the pointer or focus leaves, until Escape or a dismissal closes it.
 * happy-dom has no Popover API, so a small stand-in provides `showPopover`, `hidePopover`, the
 * `:popover-open` match and the `toggle` event the real one fires.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const open = new WeakSet<Element>();
const realMatches = Element.prototype.matches as (this: Element, selector: string) => boolean;

beforeAll(() => {
  (Element.prototype as { matches: unknown }).matches = function (
    this: Element,
    selector: string,
  ): boolean {
    if (selector === ':popover-open') return open.has(this);
    if (selector === ':hover' || selector === ':focus' || selector === ':focus-visible')
      return false;
    return realMatches.call(this, selector);
  };
  const toggle = (el: HTMLElement, isOpen: boolean) => {
    if (open.has(el) === isOpen) return;
    if (isOpen) open.add(el);
    else open.delete(el);
    el.dispatchEvent(new Event('toggle'));
  };
  HTMLElement.prototype.showPopover = function (this: HTMLElement) {
    toggle(this, true);
  };
  HTMLElement.prototype.hidePopover = function (this: HTMLElement) {
    toggle(this, false);
  };
});

beforeEach(async () => {
  document.body.innerHTML = `
    <button class="tooltip-trigger" id="plain" popovertarget="plain-tip">Save</button>
    <span class="tooltip" id="plain-tip" popover="manual">Keeps a draft.</span>
    <button class="tooltip-trigger" id="more" popovertarget="more-tip" popovertargetaction="show"
            aria-label="More about shipping">?</button>
    <div class="tooltip tooltip--toggle" id="more-tip" popover="auto">Free over $50.</div>`;
  vi.useFakeTimers();
  const { initTooltips } = await import('./tooltip.ts');
  initTooltips(document);
});

afterEach(() => {
  vi.useRealTimers();
});

const el = (id: string) => document.getElementById(id)!;
const fire = (target: Element, type: string, init: Record<string, unknown> = {}) =>
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, ...init }));
const escape = () =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

describe('a plain tooltip', () => {
  it('is described by its text and has the tooltip role', () => {
    fire(el('plain'), 'pointerover');
    expect(el('plain-tip').getAttribute('role')).toBe('tooltip');
    expect(el('plain').getAttribute('aria-describedby')).toBe('plain-tip');
    expect(el('plain').hasAttribute('aria-expanded')).toBe(false);
  });
});

describe('a toggletip', () => {
  it('reports aria-expanded, not aria-describedby', () => {
    fire(el('more'), 'pointerover');
    expect(el('more-tip').matches(':popover-open')).toBe(true);
    expect(el('more').getAttribute('aria-expanded')).toBe('true');
    expect(el('more').hasAttribute('aria-describedby')).toBe(false);
    expect(el('more-tip').getAttribute('role')).toBe('tooltip');
  });

  it('closes when the pointer leaves if it was only hovered', () => {
    fire(el('more'), 'pointerover');
    fire(el('more'), 'pointerout', { relatedTarget: document.body });
    vi.advanceTimersByTime(200);
    expect(el('more-tip').matches(':popover-open')).toBe(false);
    expect(el('more').getAttribute('aria-expanded')).toBe('false');
  });

  it('stays open after a click, however the pointer or focus moves', () => {
    fire(el('more'), 'pointerover');
    fire(el('more'), 'click');
    expect(el('more-tip').hasAttribute('data-pinned')).toBe(true);
    fire(el('more'), 'pointerout', { relatedTarget: document.body });
    el('more').dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    vi.advanceTimersByTime(500);
    expect(el('more-tip').matches(':popover-open')).toBe(true);
  });

  it('Escape closes a pinned one and unpins it', () => {
    fire(el('more'), 'pointerover');
    fire(el('more'), 'click');
    escape();
    expect(el('more-tip').matches(':popover-open')).toBe(false);
    expect(el('more-tip').hasAttribute('data-pinned')).toBe(false);
    expect(el('more').getAttribute('aria-expanded')).toBe('false');
  });

  it('follows the popover when something else closes it', () => {
    fire(el('more'), 'pointerover');
    fire(el('more'), 'click');
    el('more-tip').hidePopover();
    expect(el('more').getAttribute('aria-expanded')).toBe('false');
    expect(el('more-tip').hasAttribute('data-pinned')).toBe(false);
  });
});
