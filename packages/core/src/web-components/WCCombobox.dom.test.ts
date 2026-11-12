/**
 * @vitest-environment happy-dom
 *
 * `<wc-combobox>` wiring. The pure decisions (matching, ranking, how the active option moves, the
 * live-region text) are in `utils/combobox.test.ts`; this is the DOM: the ARIA 1.2 wiring, the
 * keyboard model, what choosing does to the input and the form, and the native fallback it replaces.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { WCCombobox } from './WCCombobox.ts';

beforeAll(async () => {
  await import('./WCCombobox.ts');
});

const MARKUP = `
  <input class="combobox__input" name="city" list="cities" />
  <datalist id="cities">
    <option value="Ottawa"></option>
    <option value="Toronto"></option>
    <option value="Gatineau"></option>
  </datalist>`;

async function mount(body = MARKUP, attrs = ''): Promise<WCCombobox> {
  document.body.innerHTML = `<form><wc-combobox class="combobox" ${attrs}>${body}</wc-combobox></form>`;
  const el = document.querySelector('wc-combobox') as WCCombobox;
  await el.updateComplete;
  return el;
}

const input = (el: Element) => el.querySelector('input') as HTMLInputElement;
const listbox = (el: Element) => el.querySelector('[role="listbox"]') as HTMLElement;
const options = (el: Element) => Array.from(el.querySelectorAll<HTMLElement>('[role="option"]'));
const shown = (el: Element) => options(el).map((o) => o.textContent);
const press = (el: Element, key: string) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  input(el).dispatchEvent(event);
  return event;
};
const type = (el: Element, text: string) => {
  input(el).value = text;
  input(el).dispatchEvent(new Event('input', { bubbles: true }));
};
const open = (el: Element) => input(el).dispatchEvent(new FocusEvent('focus'));

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('<wc-combobox> upgrade', () => {
  it('wires the input as an ARIA 1.2 combobox over a hidden listbox', async () => {
    const el = await mount();
    const i = input(el);
    expect(i.getAttribute('role')).toBe('combobox');
    expect(i.getAttribute('aria-autocomplete')).toBe('list');
    expect(i.getAttribute('aria-expanded')).toBe('false');
    expect(i.getAttribute('aria-controls')).toBe(listbox(el).id);
    expect(listbox(el).hidden).toBe(true);
    expect(i.autocomplete).toBe('off');
  });

  it('takes away the browser popup but keeps the datalist as the option source', async () => {
    const el = await mount();
    expect(input(el).hasAttribute('list')).toBe(false);
    expect(el.querySelectorAll('datalist option')).toHaveLength(3);
  });

  it('adds a polite live region', async () => {
    const el = await mount();
    const status = el.querySelector('[role="status"]')!;
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('leaves an input with no datalist alone', async () => {
    const el = await mount('<input class="combobox__input" name="x" />');
    expect(el.querySelector('[role="listbox"]')).toBeNull();
    expect(input(el).hasAttribute('role')).toBe(false);
  });

  it('is idempotent across a reconnect', async () => {
    const el = await mount();
    el.remove();
    document.querySelector('form')!.append(el);
    expect(el.querySelectorAll('[role="listbox"]')).toHaveLength(1);
  });
});

describe('<wc-combobox> list', () => {
  it('opens on focus with every option', async () => {
    const el = await mount();
    open(el);
    expect(listbox(el).hidden).toBe(false);
    expect(input(el).getAttribute('aria-expanded')).toBe('true');
    expect(shown(el)).toEqual(['Ottawa', 'Toronto', 'Gatineau']);
  });

  it('filters as you type and says how many match', async () => {
    const el = await mount();
    type(el, 'to');
    expect(shown(el)).toEqual(['Toronto']);
    expect(el.querySelector('[role="status"]')!.textContent).toBe('1 result available');
  });

  it('shows an empty row, with configurable text, when nothing matches', async () => {
    const el = await mount(MARKUP, 'empty-text="Nothing here"');
    type(el, 'zzz');
    expect(options(el)).toHaveLength(0);
    expect(el.querySelector('.combobox__empty')!.textContent).toBe('Nothing here');
    expect(el.querySelector('[role="status"]')!.textContent).toBe('Nothing here');
  });

  it('shows the label but chooses the value', async () => {
    const el = await mount(`
      <input class="combobox__input" name="p" list="p" />
      <datalist id="p"><option value="ON" label="Ontario"></option></datalist>`);
    open(el);
    expect(shown(el)).toEqual(['Ontario']);
    options(el)[0]!.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    expect(input(el).value).toBe('ON');
  });
});

describe('<wc-combobox> keyboard', () => {
  it('Down opens the list and activates the first option through aria-activedescendant', async () => {
    const el = await mount();
    press(el, 'ArrowDown');
    expect(listbox(el).hidden).toBe(false);
    expect(options(el)[0]!.getAttribute('aria-selected')).toBe('true');
    expect(input(el).getAttribute('aria-activedescendant')).toBe(options(el)[0]!.id);
  });

  it('keeps DOM focus where it was: only the descendant changes', async () => {
    const el = await mount();
    input(el).focus();
    press(el, 'ArrowDown');
    expect(document.activeElement).toBe(input(el));
  });

  it('wraps in both directions and keeps one option active', async () => {
    const el = await mount();
    press(el, 'ArrowUp');
    expect(options(el)[2]!.getAttribute('aria-selected')).toBe('true');
    press(el, 'ArrowDown');
    expect(options(el)[0]!.getAttribute('aria-selected')).toBe('true');
    expect(options(el).filter((o) => o.getAttribute('aria-selected') === 'true')).toHaveLength(1);
  });

  it('Enter chooses the active option, fires the events, closes, and does not submit', async () => {
    const el = await mount();
    const seen: string[] = [];
    el.addEventListener('combobox-select', (e) => seen.push((e as CustomEvent).detail.value));
    const onInput = vi.fn();
    const onChange = vi.fn();
    input(el).addEventListener('input', onInput);
    input(el).addEventListener('change', onChange);
    press(el, 'ArrowDown');
    press(el, 'ArrowDown');
    const enter = press(el, 'Enter');
    expect(enter.defaultPrevented).toBe(true);
    expect(input(el).value).toBe('Toronto');
    expect(seen).toEqual(['Toronto']);
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(listbox(el).hidden).toBe(true);
  });

  it('Enter with nothing active is left to the form', async () => {
    const el = await mount();
    type(el, 'Ott');
    expect(press(el, 'Enter').defaultPrevented).toBe(false);
    expect(input(el).value).toBe('Ott');
  });

  it('Escape closes, and a second Escape clears', async () => {
    const el = await mount();
    type(el, 'Ott');
    expect(press(el, 'Escape').defaultPrevented).toBe(true);
    expect(listbox(el).hidden).toBe(true);
    expect(input(el).value).toBe('Ott');
    press(el, 'Escape');
    expect(input(el).value).toBe('');
  });

  it('Tab closes the list', async () => {
    const el = await mount();
    open(el);
    press(el, 'Tab');
    expect(listbox(el).hidden).toBe(true);
  });

  it('leaves other keys alone', async () => {
    const el = await mount();
    open(el);
    expect(press(el, 'a').defaultPrevented).toBe(false);
    expect(press(el, 'Home').defaultPrevented).toBe(false);
  });

  it('keeps a free-typed value that matches nothing', async () => {
    const el = await mount();
    type(el, 'Kingston');
    press(el, 'Tab');
    expect(input(el).value).toBe('Kingston');
    expect(el.match).toBeUndefined();
    type(el, 'ottawa');
    expect(el.match?.value).toBe('Ottawa');
  });
});

describe('<wc-combobox> pointer', () => {
  it('choosing with the pointer does not blur the input first', async () => {
    const el = await mount();
    open(el);
    const down = new Event('pointerdown', { bubbles: true, cancelable: true });
    options(el)[1]!.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(input(el).value).toBe('Toronto');
  });

  it('closes on a press outside, not on one inside', async () => {
    const el = await mount();
    open(el);
    el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(listbox(el).hidden).toBe(false);
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(listbox(el).hidden).toBe(true);
  });
});
