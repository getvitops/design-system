/**
 * @vitest-environment happy-dom
 *
 * `<wc-config-preview>`: that an edit reaches the page as one style element, that a document the
 * generator refuses leaves the last good CSS in place and says why, and that reset restores the page.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { PreviewOutput, WCConfigPreview } from './WCConfigPreview.ts';

beforeAll(async () => {
  await import('./WCConfigPreview.ts');
});

let source: HTMLElement & { value: Record<string, unknown>; merged?: (b: never) => unknown };
let element: WCConfigPreview;
let calls: unknown[];

const flush = async () => {
  await vi.advanceTimersByTimeAsync(250);
};

beforeEach(async () => {
  vi.useFakeTimers();
  document.head.innerHTML = '';
  document.body.innerHTML = `
    <div id="src"></div>
    <script type="application/json" id="base">{"a":1}</script>
    <wc-config-preview for="src" base="base"></wc-config-preview>`;
  source = document.getElementById('src') as typeof source;
  source.value = { b: 2 };
  source.merged = (base: never) => ({ ...(base as object), ...source.value });
  calls = [];
  element = document.querySelector('wc-config-preview') as WCConfigPreview;
  element.render = (config): PreviewOutput => {
    calls.push(config);
    return (config as { bad?: boolean }).bad
      ? { css: '', errors: ['role "x" names no hue'] }
      : { css: `:root{--n:${calls.length}}`, errors: [] };
  };
  await vi.advanceTimersByTimeAsync(0);
  await flush();
});

afterEach(() => vi.useRealTimers());

const style = () => document.getElementById('vitops-preview');
const status = () => element.querySelector('[role="status"]')!;

describe('<wc-config-preview>', () => {
  it('renders the base merged with the form, once, as a single style element at the end of head', () => {
    expect(calls[0]).toEqual({ a: 1, b: 2 });
    expect(document.querySelectorAll('#vitops-preview')).toHaveLength(1);
    expect(document.head.lastElementChild).toBe(style());
  });

  it('debounces a burst of edits into one render', async () => {
    const before = calls.length;
    for (let i = 0; i < 5; i++) source.dispatchEvent(new Event('config-change'));
    await flush();
    expect(calls.length).toBe(before + 1);
    expect(document.querySelectorAll('#vitops-preview')).toHaveLength(1);
  });

  it('keeps the last good CSS and says why when the generator refuses a document', async () => {
    const good = style()!.textContent;
    source.value = { bad: true };
    source.dispatchEvent(new Event('config-change'));
    await flush();
    expect(style()!.textContent).toBe(good);
    expect(status().textContent).toContain('names no hue');
    source.value = { b: 3 };
    source.dispatchEvent(new Event('config-change'));
    await flush();
    expect(status().textContent).toBe('');
  });

  it('unticking the toggle removes the preview, and ticking it brings it back', async () => {
    const toggle = element.querySelector('input[type="checkbox"]') as HTMLInputElement;
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    expect(style()).toBeNull();
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    await flush();
    expect(style()).not.toBeNull();
  });

  it('Reset removes the style and stops previewing', async () => {
    (element.querySelector('button') as HTMLButtonElement).click();
    expect(style()).toBeNull();
    source.dispatchEvent(new Event('config-change'));
    await flush();
    expect(style()).toBeNull();
  });
});
