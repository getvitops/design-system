/**
 * @vitest-environment happy-dom
 *
 * `<wc-tabs>` wiring. The pure decisions (ids, which tab starts selected) are in `utils/tabs.test.ts`;
 * this is the DOM: the tablist that gets built, the ARIA wiring, the keyboard model and the hash
 * behaviour. happy-dom has no layout, so nothing here depends on one: visibility is the `hidden`
 * attribute, which is also how the element does it.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { WCTabs } from './WCTabs.ts';

beforeAll(async () => {
  await import('./WCTabs.ts');
});

const SECTIONS = `
  <section id="overview"><h3>Overview</h3><p>About us.</p></section>
  <section id="pricing"><h3>Pricing</h3><p>Plans.</p><a href="/buy">Buy</a></section>
  <section><h3>Our Team</h3><p>People.</p></section>`;

async function mount(attrs = '', body = SECTIONS): Promise<WCTabs> {
  document.body.innerHTML = `<wc-tabs class="tabs" ${attrs}>${body}</wc-tabs>`;
  const el = document.querySelector('wc-tabs') as WCTabs;
  await el.updateComplete;
  return el;
}

const tabs = (el: Element) => Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
const panels = (el: Element) => Array.from(el.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
const visible = (el: Element) =>
  panels(el)
    .filter((p) => !p.hidden)
    .map((p) => p.id);
const press = (target: HTMLElement, key: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

beforeEach(() => {
  document.body.innerHTML = '';
  window.location.hash = '';
  vi.restoreAllMocks();
});

describe('<wc-tabs> upgrade', () => {
  it('builds a tablist from the headings and shows only the first panel', async () => {
    const el = await mount();
    const list = el.querySelector('[role="tablist"]')!;
    expect(list.getAttribute('aria-orientation')).toBe('horizontal');
    expect(tabs(el).map((t) => t.textContent)).toEqual(['Overview', 'Pricing', 'Our Team']);
    expect(visible(el)).toEqual(['overview']);
    expect(el.classList.contains('tabs--enhanced')).toBe(true);
  });

  it('wires each tab to its panel both ways', async () => {
    const el = await mount();
    tabs(el).forEach((tab, i) => {
      const panel = panels(el)[i]!;
      expect(tab.getAttribute('aria-controls')).toBe(panel.id);
      expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
    });
  });

  it('keeps author ids and derives one for a section without', async () => {
    const el = await mount();
    expect(panels(el).map((p) => p.id)).toEqual([
      'overview',
      'pricing',
      expect.stringMatching(/-our-team$/),
    ]);
  });

  it('hides the heading, since the tab already names the panel', async () => {
    const el = await mount();
    expect(el.querySelectorAll('section > h3:not([hidden])')).toHaveLength(0);
    expect(el.querySelectorAll('section > h3')).toHaveLength(3);
  });

  it('leaves the author markup in place: nothing is removed or reordered', async () => {
    const el = await mount();
    expect(
      Array.from(el.querySelectorAll(':scope > section')).map((s) => s.id.split('-').pop()),
    ).toEqual(['overview', 'pricing', 'team']);
    expect(el.querySelector('#pricing a')?.getAttribute('href')).toBe('/buy');
  });

  it('labels a section with no heading from aria-label, then from its position', async () => {
    const el = await mount(
      '',
      '<section aria-label="Specs"><p>x</p></section><section><p>y</p></section>',
    );
    expect(tabs(el).map((t) => t.textContent)).toEqual(['Specs', 'Tab 2']);
  });

  it('does not enhance an element with no sections, and does not throw', async () => {
    const el = await mount('', '<p>nothing to tab</p>');
    expect(el.querySelector('[role="tablist"]')).toBeNull();
    expect(el.classList.contains('tabs--enhanced')).toBe(false);
  });

  it('enhances markup that lands a moment after the element upgrades', async () => {
    const el = document.createElement('wc-tabs') as WCTabs;
    document.body.append(el);
    el.insertAdjacentHTML('beforeend', SECTIONS);
    await Promise.resolve();
    await Promise.resolve();
    expect(tabs(el)).toHaveLength(3);
  });

  it('is idempotent across a reconnect', async () => {
    const el = await mount();
    el.remove();
    document.body.append(el);
    expect(el.querySelectorAll('[role="tablist"]')).toHaveLength(1);
    expect(tabs(el)).toHaveLength(3);
  });
});

describe('<wc-tabs> selection', () => {
  it('selects on click and announces tabs-change', async () => {
    const el = await mount();
    const seen: Array<{ index: number; id: string }> = [];
    el.addEventListener('tabs-change', (e) => seen.push((e as CustomEvent).detail));
    tabs(el)[1]!.click();
    expect(visible(el)).toEqual(['pricing']);
    expect(tabs(el)[1]!.getAttribute('aria-selected')).toBe('true');
    expect(tabs(el)[0]!.getAttribute('aria-selected')).toBe('false');
    expect(seen).toEqual([{ index: 1, id: 'pricing' }]);
  });

  it('does not announce the initial selection, nor a re-click on the selected tab', async () => {
    const el = await mount();
    const onChange = vi.fn();
    el.addEventListener('tabs-change', onChange);
    tabs(el)[0]!.click();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps exactly one tab in the tab order', async () => {
    const el = await mount();
    expect(tabs(el).map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    tabs(el)[2]!.click();
    expect(tabs(el).map((t) => t.tabIndex)).toEqual([-1, -1, 0]);
  });

  it('starts at the selected attribute', async () => {
    expect(visible(await mount('selected="2"'))).toHaveLength(1);
    const el = await mount('selected="2"');
    expect(tabs(el)[2]!.getAttribute('aria-selected')).toBe('true');
  });

  it('selects when the selected property changes later', async () => {
    const el = await mount();
    el.selected = 1;
    await el.updateComplete;
    expect(visible(el)).toEqual(['pricing']);
  });

  it('makes a panel with nothing focusable in it focusable, and not one that has a link', async () => {
    const el = await mount();
    expect(panels(el)[0]!.tabIndex).toBe(0);
    tabs(el)[1]!.click();
    expect(panels(el)[1]!.hasAttribute('tabindex')).toBe(false);
  });
});

describe('<wc-tabs> keyboard', () => {
  it('moves and selects with the arrows, wrapping at the ends', async () => {
    const el = await mount();
    press(tabs(el)[0]!, 'ArrowRight');
    expect(visible(el)).toEqual(['pricing']);
    press(tabs(el)[1]!, 'ArrowRight');
    press(tabs(el)[2]!, 'ArrowRight');
    expect(visible(el)).toEqual(['overview']);
    press(tabs(el)[0]!, 'ArrowLeft');
    expect(tabs(el)[2]!.getAttribute('aria-selected')).toBe('true');
  });

  it('jumps with Home and End', async () => {
    const el = await mount('selected="1"');
    press(tabs(el)[1]!, 'End');
    expect(tabs(el)[2]!.getAttribute('aria-selected')).toBe('true');
    press(tabs(el)[2]!, 'Home');
    expect(tabs(el)[0]!.getAttribute('aria-selected')).toBe('true');
  });

  it('puts DOM focus on the newly selected tab', async () => {
    const el = await mount();
    tabs(el)[0]!.focus();
    press(tabs(el)[0]!, 'ArrowRight');
    expect(document.activeElement).toBe(tabs(el)[1]);
  });

  it('answers to the axis it is oriented on', async () => {
    const el = await mount('orientation="vertical"');
    expect(el.querySelector('[role="tablist"]')!.getAttribute('aria-orientation')).toBe('vertical');
    expect(el.classList.contains('tabs--vertical')).toBe(true);
    press(tabs(el)[0]!, 'ArrowRight');
    expect(visible(el)).toEqual(['overview']);
    press(tabs(el)[0]!, 'ArrowDown');
    expect(visible(el)).toEqual(['pricing']);
  });

  it('leaves other keys alone', async () => {
    const el = await mount();
    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    tabs(el)[0]!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(visible(el)).toEqual(['overview']);
  });
});

describe('<wc-tabs> URL fragment', () => {
  it('starts on the panel the URL points at', async () => {
    window.location.hash = '#pricing';
    const el = await mount('selected="2"');
    expect(visible(el)).toEqual(['pricing']);
  });

  it('starts on the panel that contains the element the URL points at', async () => {
    window.location.hash = '#deep';
    const el = await mount('', SECTIONS.replace('<p>Plans.</p>', '<p id="deep">Plans.</p>'));
    expect(visible(el)).toEqual(['pricing']);
  });

  it('selects when the fragment changes', async () => {
    const el = await mount();
    window.location.hash = '#pricing';
    window.dispatchEvent(new Event('hashchange'));
    expect(visible(el)).toEqual(['pricing']);
  });

  it('ignores a fragment that matches nothing', async () => {
    window.location.hash = '#elsewhere';
    expect(visible(await mount())).toEqual(['overview']);
  });

  it('writes the fragment only when asked to', async () => {
    const replace = vi.spyOn(history, 'replaceState');
    const quiet = await mount();
    tabs(quiet)[1]!.click();
    expect(replace).not.toHaveBeenCalled();
    const loud = await mount('hash');
    tabs(loud)[1]!.click();
    expect(replace).toHaveBeenCalledWith(null, '', '#pricing');
  });
});
