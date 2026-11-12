/**
 * @vitest-environment happy-dom
 *
 * `<wc-image-compare>` wiring. It is the one tier-2 element that is not light DOM (`DragController` finds
 * its handle through `renderRoot`, and the slots carry the before/after images), which is why this tests the
 * shadow tree directly. happy-dom has no layout, so a pointer drag can't be simulated meaningfully; the
 * keyboard path goes through the same `onDrag`/`onDragEnd` the pointer path ends in, so it covers the
 * position state, the ARIA value and the `compare-change` event.
 *
 * The no-JS promise (both images are in the light DOM and readable unenhanced) is asserted by
 * `site/e2e/no-js-fallback.e2e.ts` in a real browser; here the matching check is that upgrading removes
 * nothing from the light DOM.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { WCImageCompare } from './WCImageCompare.ts';

beforeAll(async () => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  }));
  await import('./WCImageCompare.ts');
});

const MARKUP = (attrs = '') => `
<wc-image-compare ${attrs}>
  <img slot="before" src="before.jpg" alt="Before the repair" />
  <img slot="after" src="after.jpg" alt="After the repair" />
</wc-image-compare>`;

async function mount(attrs = ''): Promise<WCImageCompare> {
  document.body.innerHTML = MARKUP(attrs);
  const el = document.querySelector('wc-image-compare') as WCImageCompare;
  await el.updateComplete;
  return el;
}

const handle = (el: WCImageCompare) =>
  el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
const press = (el: WCImageCompare, key: string, shiftKey = false) =>
  handle(el).dispatchEvent(
    new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }),
  );

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('<wc-image-compare>', () => {
  it('upgrades without removing either image from the light DOM', async () => {
    const el = await mount();
    expect(el.querySelector('img[slot="before"]')?.getAttribute('alt')).toBe('Before the repair');
    expect(el.querySelector('img[slot="after"]')?.getAttribute('alt')).toBe('After the repair');
    expect(el.shadowRoot!.querySelector('slot[name="before"]')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('slot[name="after"]')).not.toBeNull();
  });

  it('exposes a focusable separator with a 0-100 value', async () => {
    const h = handle(await mount());
    expect(h.getAttribute('role')).toBe('separator');
    expect(h.getAttribute('tabindex')).toBe('0');
    expect(h.getAttribute('aria-valuemin')).toBe('0');
    expect(h.getAttribute('aria-valuemax')).toBe('100');
    expect(h.getAttribute('aria-valuenow')).toBe('50');
  });

  it('starts at the position attribute, in the ARIA value and the container offset', async () => {
    const el = await mount('position="25"');
    expect(handle(el).getAttribute('aria-valuenow')).toBe('25');
    const container = el.shadowRoot!.querySelector('[part="container"]') as HTMLElement;
    expect(container.getAttribute('style')).toContain('--_offset: 0.25');
  });

  it('moves by keyboard-step with the arrow keys and announces compare-change', async () => {
    const el = await mount('keyboard-step="5"');
    const seen: number[] = [];
    el.addEventListener('compare-change', (e) =>
      seen.push((e as CustomEvent<{ position: number }>).detail.position),
    );
    press(el, 'ArrowRight');
    expect(handle(el).getAttribute('aria-valuenow')).toBe('55');
    press(el, 'ArrowLeft');
    press(el, 'ArrowLeft');
    expect(handle(el).getAttribute('aria-valuenow')).toBe('45');
    expect(seen.map((n) => Math.round(n))).toEqual([55, 50, 45]);
  });

  it('compare-change bubbles and crosses the shadow boundary', async () => {
    const el = await mount();
    const onBody = vi.fn();
    document.body.addEventListener('compare-change', onBody);
    press(el, 'ArrowRight');
    expect(onBody).toHaveBeenCalledTimes(1);
    document.body.removeEventListener('compare-change', onBody);
  });

  it('jumps to the ends with Home and End, and never leaves 0-100', async () => {
    const el = await mount('position="90"');
    press(el, 'Home');
    expect(handle(el).getAttribute('aria-valuenow')).toBe('0');
    press(el, 'ArrowLeft');
    expect(handle(el).getAttribute('aria-valuenow')).toBe('0');
    press(el, 'End');
    expect(handle(el).getAttribute('aria-valuenow')).toBe('100');
    press(el, 'ArrowRight');
    expect(handle(el).getAttribute('aria-valuenow')).toBe('100');
  });

  it('Shift takes the large step', async () => {
    const el = await mount();
    press(el, 'ArrowRight', true);
    expect(Number(handle(el).getAttribute('aria-valuenow'))).toBeGreaterThan(51);
  });

  it('responds to the axis it is oriented on, and says which in aria-orientation', async () => {
    const el = await mount('vertical');
    expect(handle(el).getAttribute('aria-orientation')).toBe('vertical');
    press(el, 'ArrowRight');
    expect(handle(el).getAttribute('aria-valuenow')).toBe('50');
    press(el, 'ArrowDown');
    expect(Number(handle(el).getAttribute('aria-valuenow'))).toBeGreaterThan(50);
  });

  it('ignores keys that are not its own', async () => {
    const el = await mount();
    const onChange = vi.fn();
    el.addEventListener('compare-change', onChange);
    press(el, 'a');
    press(el, 'Tab');
    expect(onChange).not.toHaveBeenCalled();
  });
});
