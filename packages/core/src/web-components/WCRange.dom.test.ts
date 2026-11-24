/**
 * @vitest-environment happy-dom
 *
 * `<wc-range>` wiring. The pair-clamping and fill arithmetic are in `utils/range.test.ts`; this is
 * the DOM: that two native inputs become one track, thumbs can't cross, the output stays current, and
 * the inputs themselves are left as the real controls.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { WCRange } from './WCRange.ts';

beforeAll(async () => {
  await import('./WCRange.ts');
});

const DUAL = `
  <input type="range" id="lo" name="min" min="0" max="1000" value="200" aria-label="Minimum price" />
  <input type="range" id="hi" name="max" min="0" max="1000" value="800" aria-label="Maximum price" />
  <output></output>`;
const SINGLE = `<input type="range" id="v" name="volume" min="0" max="10" value="4" aria-label="Volume" /><output></output>`;

async function mount(body: string): Promise<WCRange> {
  document.body.innerHTML = `<wc-range class="range">${body}</wc-range>`;
  const el = document.querySelector('wc-range') as WCRange;
  await el.updateComplete;
  return el;
}
const inputs = (el: Element) => Array.from(el.querySelectorAll<HTMLInputElement>('input'));
const set = (input: HTMLInputElement, value: number) => {
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('<wc-range> two thumbs', () => {
  it('stacks the inputs on one track and fills the span between them', async () => {
    const el = await mount(DUAL);
    expect(el.classList.contains('range--dual')).toBe(true);
    expect(el.querySelector('.range__track')?.getAttribute('aria-hidden')).toBe('true');
    expect(el.style.getPropertyValue('--range-start')).toBe('20%');
    expect(el.style.getPropertyValue('--range-end')).toBe('80%');
  });

  it('leaves both inputs in place as the real, labelled, named controls', async () => {
    const el = await mount(DUAL);
    expect(inputs(el).map((i) => i.name)).toEqual(['min', 'max']);
    expect(inputs(el).map((i) => i.getAttribute('aria-label'))).toEqual([
      'Minimum price',
      'Maximum price',
    ]);
  });

  it('stops the lower thumb at the upper, and leaves the upper where it was', async () => {
    const el = await mount(DUAL);
    const [lo, hi] = inputs(el) as [HTMLInputElement, HTMLInputElement];
    set(lo, 900);
    expect(lo.value).toBe('800');
    expect(hi.value).toBe('800');
  });

  it('stops the upper thumb at the lower', async () => {
    const el = await mount(DUAL);
    const [lo, hi] = inputs(el) as [HTMLInputElement, HTMLInputElement];
    set(hi, 100);
    expect(hi.value).toBe('200');
    expect(lo.value).toBe('200');
  });

  it('moves the filled span as a thumb moves', async () => {
    const el = await mount(DUAL);
    set(inputs(el)[0]!, 500);
    expect(el.style.getPropertyValue('--range-start')).toBe('50%');
    expect(el.style.getPropertyValue('--range-end')).toBe('80%');
  });

  it('keeps the output current as `low – high`, and ties it to the inputs', async () => {
    const el = await mount(DUAL);
    const out = el.querySelector('output')!;
    expect(out.textContent).toBe('200 – 800');
    expect(out.getAttribute('for')).toBe('lo hi');
    set(inputs(el)[1]!, 950);
    expect(out.textContent).toBe('200 – 950');
  });

  it('announces range-change with both values', async () => {
    const el = await mount(DUAL);
    const seen: number[][] = [];
    el.addEventListener('range-change', (e) => seen.push((e as CustomEvent).detail.values));
    set(inputs(el)[0]!, 300);
    expect(seen).toEqual([[300, 800]]);
  });
});

describe('<wc-range> one thumb', () => {
  it('only keeps the output current: no track, no dual layout', async () => {
    const el = await mount(SINGLE);
    expect(el.classList.contains('range--dual')).toBe(false);
    expect(el.querySelector('.range__track')).toBeNull();
    expect(el.querySelector('output')!.textContent).toBe('4');
    set(inputs(el)[0]!, 7);
    expect(el.querySelector('output')!.textContent).toBe('7');
  });

  it('works with no output at all', async () => {
    const el = await mount('<input type="range" min="0" max="10" value="4" aria-label="Volume" />');
    expect(() => set(inputs(el)[0]!, 6)).not.toThrow();
  });
});

describe('<wc-range> edge cases', () => {
  it('does nothing, and does not throw, with no range input', async () => {
    const el = await mount('<p>nothing</p>');
    expect(el.classList.contains('range--dual')).toBe(false);
  });

  it('is idempotent across a reconnect', async () => {
    const el = await mount(DUAL);
    el.remove();
    document.body.append(el);
    expect(el.querySelectorAll('.range__track')).toHaveLength(1);
  });

  it('does not re-dispatch input when it corrects a crossing thumb', async () => {
    const el = await mount(DUAL);
    const onInput = vi.fn();
    el.addEventListener('input', onInput);
    set(inputs(el)[0]!, 900);
    expect(onInput).toHaveBeenCalledTimes(1);
  });
});
