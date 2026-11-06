/**
 * @vitest-environment happy-dom
 *
 * `<wc-entries>` upgrade wiring: the semantic `<h3>` + `<dl>` fallback must survive, the
 * generated table is presentation only, and the column selector is the one part of it a
 * keyboard user touches — so it must not be hidden from assistive tech while focusable.
 *
 * Per-file environment: see WCCards.dom.test.ts.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vite-plus/test';

const MARKUP = (attrs = '') => `
  <wc-entries ${attrs}>
    <h3>Alpha</h3>
    <dl><dt>Price</dt><dd>$10</dd><dt data-label="Wt">Weight</dt><dd>1 kg</dd></dl>
    <h3>Beta</h3>
    <dl><dt>Price</dt><dd>$20</dd><dt>Weight</dt><dd>2 kg</dd></dl>
  </wc-entries>`;

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';

async function mount(attrs = ''): Promise<HTMLElement> {
  document.body.innerHTML = MARKUP(attrs);
  await customElements.whenDefined('wc-entries');
  await new Promise((r) => requestAnimationFrame(r));
  return document.querySelector('wc-entries') as HTMLElement;
}

beforeAll(async () => {
  await import('./WCEntries.ts');
});

describe('<wc-entries>', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps the semantic heading + dl fallback in the DOM after upgrade', async () => {
    const el = await mount();
    expect(el.querySelectorAll(':scope > h3')).toHaveLength(2);
    expect(el.querySelectorAll(':scope > dl')).toHaveLength(2);
  });

  it('builds one row per entry and one column per distinct key', async () => {
    const el = await mount();
    const table = el.querySelector('table')!;
    expect(table.querySelectorAll('tbody tr')).toHaveLength(2);
    // First header cell is the (empty) title column, then Price and Weight.
    expect([...table.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual([
      '',
      'Price',
      'Weight',
    ]);
  });

  it('hides the duplicate table from assistive tech, and it holds nothing focusable', async () => {
    const el = await mount();
    const table = el.querySelector('table')!;
    expect(table.getAttribute('aria-hidden')).toBe('true');
    expect(table.querySelectorAll(FOCUSABLE)).toHaveLength(0);
  });

  it('does not build the table twice', async () => {
    const el = await mount();
    el.remove();
    document.body.append(el);
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.querySelectorAll('table')).toHaveLength(1);
  });

  describe('projection mode', () => {
    it('exposes the column selector — focusable buttons are never aria-hidden', async () => {
      const el = await mount('projection');
      const nav = el.querySelector('nav.entries__nav')!;
      expect(nav).not.toBeNull();
      expect(nav.getAttribute('aria-label')).toBe('Column selector');
      const buttons = [...nav.querySelectorAll('button')];
      expect(buttons.map((b) => b.textContent)).toEqual(['Price', 'Wt']);
      for (const button of buttons) {
        expect(
          button.closest('[aria-hidden="true"]'),
          `${button.textContent} is hidden`,
        ).toBeNull();
      }
    });

    it('marks the active column button as pressed', async () => {
      const el = await mount('projection');
      const [first, second] = [...el.querySelectorAll<HTMLButtonElement>('nav button')];
      expect(first!.getAttribute('aria-pressed')).toBe('true');
      expect(second!.getAttribute('aria-pressed')).toBe('false');
      second!.click();
      expect(first!.getAttribute('aria-pressed')).toBe('false');
      expect(second!.getAttribute('aria-pressed')).toBe('true');
    });
  });
});
