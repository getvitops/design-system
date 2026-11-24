/**
 * @vitest-environment happy-dom
 *
 * `<wc-contrast-toggle>` wiring. The decisions (what starts checked, what is stored) are tested
 * without a DOM in `utils/contrast-toggle.test.ts`; what needs a DOM is that the existing checkbox is
 * enhanced in place, `data-contrast` lands on `<html>`, and an empty element builds its own control.
 *
 * Per-file environment rather than a global one: most tests here are pure.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

function stubMedia(prefersMore: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-contrast') && prefersMore,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  }));
}

const FALLBACK =
  '<wc-contrast-toggle><label class="contrast-toggle"><input type="checkbox" /> High contrast</label></wc-contrast-toggle>';
const input = () => document.querySelector<HTMLInputElement>('wc-contrast-toggle input')!;
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeAll(async () => {
  await import('./WCContrastToggle.ts');
});

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.contrast;
  delete (window as { vitopsConsent?: unknown }).vitopsConsent;
  stubMedia(false);
});

describe('<wc-contrast-toggle> setup', () => {
  it('enhances the checkbox already in the markup, adding nothing', async () => {
    document.body.innerHTML = FALLBACK;
    await tick();
    expect(document.querySelectorAll('wc-contrast-toggle input')).toHaveLength(1);
  });

  it('builds a checkbox when the element is empty, rather than rendering nothing', async () => {
    document.body.innerHTML = '<wc-contrast-toggle></wc-contrast-toggle>';
    await tick();
    expect(input()).toBeTruthy();
    expect(document.querySelector('.contrast-toggle')).toBeTruthy();
  });

  it('starts checked under prefers-contrast: more, without writing the attribute', async () => {
    stubMedia(true);
    document.body.innerHTML = FALLBACK;
    await tick();
    expect(input().checked).toBe(true);
    // The media query already applies the layer; an attribute would be a second source.
    expect(document.documentElement.dataset.contrast).toBeUndefined();
  });

  it('restores a stored choice, and the choice beats the OS preference', async () => {
    stubMedia(true);
    localStorage.setItem('vitops-contrast', 'standard');
    document.body.innerHTML = FALLBACK;
    await tick();
    expect(input().checked).toBe(false);
    expect(document.documentElement.dataset.contrast).toBe('standard');
  });
});

describe('<wc-contrast-toggle> changes', () => {
  it('sets data-contrast, stores the choice, and fires contrast-change', async () => {
    document.body.innerHTML = FALLBACK;
    await tick();
    const seen: string[] = [];
    document.addEventListener('contrast-change', (e) =>
      seen.push((e as CustomEvent<{ contrast: string }>).detail.contrast),
    );
    input().checked = true;
    input().dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.documentElement.dataset.contrast).toBe('more');
    expect(localStorage.getItem('vitops-contrast')).toBe('more');
    expect(seen).toEqual(['more']);

    input().checked = false;
    input().dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.documentElement.dataset.contrast).toBe('standard');
  });

  it('applies to the page but does not store while a consent gate is refusing preferences', async () => {
    const require = vi.fn(() => false);
    (window as unknown as { vitopsConsent: unknown }).vitopsConsent = {
      require,
      granted: () => false,
    };
    document.body.innerHTML = FALLBACK;
    await tick();
    input().checked = true;
    input().dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.documentElement.dataset.contrast).toBe('more');
    expect(require).toHaveBeenCalledWith('preferences');
    expect(localStorage.getItem('vitops-contrast')).toBeNull();

    // A later grant flushes it: a standing listener, not a one-shot promise.
    (window as unknown as { vitopsConsent: { granted: () => boolean } }).vitopsConsent.granted =
      () => true;
    document.dispatchEvent(new Event('vitops:consent'));
    expect(localStorage.getItem('vitops-contrast')).toBe('more');
  });
});
