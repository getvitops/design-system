/**
 * @vitest-environment happy-dom
 *
 * `<wc-copy>` announces its outcome through a polite live region beside the button, and keeps
 * the button's accessible name stable. The clipboard is faked: happy-dom has none.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test';

beforeAll(async () => {
  await import('./WCCopy.ts');
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

type CopyEl = HTMLElement & { updateComplete: Promise<boolean> };

async function mount(attrs = ''): Promise<CopyEl> {
  document.body.innerHTML = `<wc-copy value="hello" ${attrs}>hello</wc-copy>`;
  const el = document.body.firstElementChild as CopyEl;
  await el.updateComplete;
  return el;
}

const status = (el: HTMLElement): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.copy__status')!;
const button = (el: HTMLElement): HTMLButtonElement =>
  el.shadowRoot!.querySelector<HTMLButtonElement>('.copy__button')!;

const flush = async (el: CopyEl): Promise<void> => {
  await Promise.resolve();
  await el.updateComplete;
};

describe('<wc-copy> announcements', () => {
  it('renders an EMPTY role=status node outside the button before any copy', async () => {
    const el = await mount();
    const node = status(el);
    expect(node.getAttribute('role')).toBe('status');
    expect(node.textContent?.trim()).toBe('');
    expect(button(el).contains(node)).toBe(false);
  });

  it('announces success and keeps the button name stable', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const el = await mount();
    button(el).click();
    await flush(el);
    expect(status(el).textContent?.trim()).toBe('Copied');
    expect(button(el).getAttribute('aria-label')).toBe('Copy to clipboard');
  });

  it('announces failure instead of staying silent', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const el = await mount();
    button(el).click();
    await flush(el);
    expect(status(el).textContent?.trim()).toBe('Copy failed');
  });

  it('uses the localized labels', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const el = await mount('copied-label="Copié"');
    button(el).click();
    await flush(el);
    expect(status(el).textContent?.trim()).toBe('Copié');
  });

  it('makes a repeat click a different string so it is announced again', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const el = await mount();
    button(el).click();
    await flush(el);
    const first = status(el).textContent;
    button(el).click();
    await flush(el);
    expect(status(el).textContent).not.toBe(first);
    expect(status(el).textContent?.trim()).toBe('Copied');
  });

  it('clears the message after the timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const el = await mount();
    button(el).click();
    await flush(el);
    vi.advanceTimersByTime(2100);
    await flush(el);
    expect(status(el).textContent?.trim()).toBe('');
  });
});
