/**
 * @vitest-environment happy-dom
 *
 * `<wc-format>` wiring. Formatting, unit choice and refresh timing are in `utils/format.test.ts`
 * with the clock as a parameter; this is the DOM: that the authored text is replaced from the
 * machine value, kept in `title`, left alone when it can't be formatted, and re-rendered on a timer.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { WCFormat } from './WCFormat.ts';

beforeAll(async () => {
  await import('./WCFormat.ts');
});

const NOW = Date.parse('2026-11-11T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
});

async function mount(html: string): Promise<WCFormat> {
  document.body.innerHTML = html;
  const el = document.querySelector('wc-format') as WCFormat;
  await el.updateComplete;
  return el;
}
const text = (el: Element) => el.querySelector('time, data')!.textContent;

describe('<wc-format> relative', () => {
  const MARKUP = (attrs = '') =>
    `<wc-format type="relative" locale="en" ${attrs}><time datetime="2026-11-11T11:55:00Z">November 11, 2026</time></wc-format>`;

  it('replaces the authored text and keeps it in title', async () => {
    const el = await mount(MARKUP());
    expect(text(el)).toBe('5 minutes ago');
    expect(el.querySelector('time')!.getAttribute('title')).toBe('November 11, 2026');
  });

  it('keeps an author-written title rather than overwriting it', async () => {
    const el = await mount(
      '<wc-format locale="en"><time title="Posted by Sam" datetime="2026-11-11T11:55:00Z">Nov 11</time></wc-format>',
    );
    expect(el.querySelector('time')!.getAttribute('title')).toBe('Posted by Sam');
  });

  it('re-renders when the text would change, not before', async () => {
    const el = await mount(MARKUP());
    vi.advanceTimersByTime(30_000);
    expect(text(el)).toBe('5 minutes ago');
    vi.advanceTimersByTime(60_000);
    expect(text(el)).toBe('6 minutes ago');
  });

  it('stops while the tab is hidden and catches up when it returns', async () => {
    const el = await mount(MARKUP());
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(10 * 60_000);
    expect(text(el)).toBe('5 minutes ago');
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(text(el)).toBe('15 minutes ago');
  });

  it('stops its timer when removed', async () => {
    const el = await mount(MARKUP());
    el.remove();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('follows the nearest lang when it has no locale of its own', async () => {
    const el = await mount(
      '<div lang="fr"><wc-format><time datetime="2026-11-10T12:00:00Z">hier</time></wc-format></div>',
    );
    expect(text(el)).toBe('hier');
  });

  it('re-renders when its type changes', async () => {
    const el = await mount(MARKUP());
    el.type = 'date';
    el.dateStyle = 'long';
    await el.updateComplete;
    expect(text(el)).toBe('November 11, 2026');
  });
});

describe('<wc-format> values', () => {
  it('formats a currency from <data value>', async () => {
    const el = await mount(
      '<wc-format type="currency" currency="CAD" locale="en-CA"><data value="1234.5">1234.5 dollars</data></wc-format>',
    );
    expect(text(el)).toBe('$1,234.50');
  });

  it('formats a percentage and a number', async () => {
    expect(
      text(
        await mount(
          '<wc-format type="percent" locale="en"><data value="0.256">a quarter</data></wc-format>',
        ),
      ),
    ).toBe('26%');
    expect(
      text(
        await mount(
          '<wc-format type="number" locale="en"><data value="1234567">lots</data></wc-format>',
        ),
      ),
    ).toBe('1,234,567');
  });
});

describe('<wc-format> leaves the fallback alone when it cannot format', () => {
  it.each([
    ['an unparseable date', '<time datetime="soon">Soon</time>', 'relative', ''],
    ['a currency with no code', '<data value="5">$5 CAD</data>', 'currency', ''],
    ['a non-numeric value', '<data value="lots">Lots</data>', 'number', ''],
  ])('%s', async (_name, inner, type, attrs) => {
    const el = await mount(`<wc-format type="${type}" ${attrs}>${inner}</wc-format>`);
    expect(text(el)).toBe(inner.replace(/<[^>]+>/g, ''));
  });

  it('does nothing for an unknown type', async () => {
    const el = await mount(
      '<wc-format type="bogus"><time datetime="2026-11-11T11:55:00Z">as written</time></wc-format>',
    );
    expect(text(el)).toBe('as written');
  });

  it('does nothing, and does not throw, with no <time> or <data> inside', async () => {
    const el = await mount('<wc-format>plain text</wc-format>');
    expect(el.textContent).toBe('plain text');
  });
});
