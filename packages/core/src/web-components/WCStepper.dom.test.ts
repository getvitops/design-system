/**
 * @vitest-environment happy-dom
 *
 * `<wc-stepper>` wiring. The pure decisions (where a move lands, which step a fragment names) are in
 * `utils/stepper.test.ts`; this is the DOM: one step shown, the nav marked, a forward move stopped by
 * an invalid step, and the fallback left intact when nothing enhances it.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { WCStepper } from './WCStepper.ts';

beforeAll(async () => {
  await import('./WCStepper.ts');
});

const MARKUP = `
  <wc-stepper>
    <ol class="stepper">
      <li class="stepper__item"><a href="#a">A</a></li>
      <li class="stepper__item"><a href="#b">B</a></li>
      <li class="stepper__item"><a href="#c">C</a></li>
    </ol>
    <form method="post">
      <section id="a" data-step><h2>A</h2><input name="a" required></section>
      <section id="b" data-step><h2>B</h2><input name="b"></section>
      <section id="c" data-step><h2>C</h2><input name="c"><button>Save</button></section>
    </form>
  </wc-stepper>`;

async function mount(html = MARKUP, hash = ''): Promise<WCStepper> {
  location.hash = hash;
  document.body.innerHTML = html;
  await Promise.resolve();
  await Promise.resolve();
  return document.querySelector('wc-stepper') as WCStepper;
}

const section = (id: string) => document.getElementById(id) as HTMLElement;
const link = (id: string) => document.querySelector(`.stepper a[href="#${id}"]`) as HTMLElement;
const input = (name: string) =>
  Array.from(document.querySelectorAll<HTMLInputElement>('input')).find((i) => i.name === name)!;
const action = (kind: string, within: string) =>
  section(within).querySelector(`[data-stepper-action="${kind}"]`) as HTMLButtonElement;
const shown = () => Array.from(document.querySelectorAll('section')).filter((s) => !s.hidden);

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('<wc-stepper> upgrade', () => {
  it('shows only the first step and marks it current', async () => {
    await mount();
    expect(shown().map((s) => s.id)).toEqual(['a']);
    expect(link('a').getAttribute('aria-current')).toBe('step');
    expect(link('b').hasAttribute('aria-current')).toBe(false);
  });

  it('gives each step the buttons that make sense: no Back on the first, no Next on the last', async () => {
    await mount();
    expect(action('back', 'a')).toBeNull();
    expect(action('next', 'a')).not.toBeNull();
    expect(action('back', 'b')).not.toBeNull();
    expect(action('next', 'b')).not.toBeNull();
    expect(action('back', 'c')).not.toBeNull();
    expect(action('next', 'c')).toBeNull();
  });

  it('starts on the step a URL fragment names, or contains', async () => {
    await mount(MARKUP, '#b');
    expect(shown().map((s) => s.id)).toEqual(['b']);
    await mount(MARKUP.replace('<input name="c">', '<input name="c" id="deep">'), '#deep');
    expect(shown().map((s) => s.id)).toEqual(['c']);
  });

  it('does nothing to a page that has no steps', async () => {
    await mount('<wc-stepper><p>nothing</p></wc-stepper>');
    expect(document.querySelectorAll('button')).toHaveLength(0);
  });

  it('uses the labels it is given', async () => {
    await mount(MARKUP.replace('<wc-stepper>', '<wc-stepper next-label="Continue">'));
    expect(action('next', 'a').textContent).toBe('Continue');
  });
});

describe('<wc-stepper> moving', () => {
  it('stops at a step with an invalid field, and goes on once it is fixed', async () => {
    const el = await mount();
    const changed = vi.fn();
    el.addEventListener('stepper-change', (e) => changed((e as CustomEvent).detail.id));
    action('next', 'a').click();
    expect(el.current).toBe(0);
    expect(shown().map((s) => s.id)).toEqual(['a']);

    input('a').value = 'x';
    action('next', 'a').click();
    expect(el.current).toBe(1);
    expect(shown().map((s) => s.id)).toEqual(['b']);
    expect(changed).toHaveBeenCalledWith('b');
  });

  it('lets a visitor go back without checking anything', async () => {
    const el = await mount();
    input('a').value = 'x';
    action('next', 'a').click();
    input('a').value = '';
    action('back', 'b').click();
    expect(el.current).toBe(0);
  });

  it('will not jump forward over an invalid step through the nav', async () => {
    const el = await mount();
    link('c').click();
    expect(el.current).toBe(0);
    input('a').value = 'x';
    link('c').click();
    expect(el.current).toBe(2);
  });

  it('marks a passed step complete, or invalid once it has been broken', async () => {
    await mount();
    input('a').value = 'x';
    action('next', 'a').click();
    expect(link('a').closest('li')!.classList.contains('stepper__item--complete')).toBe(true);
    input('a').value = '';
    action('next', 'b').click();
    expect(link('a').closest('li')!.classList.contains('stepper__item--invalid')).toBe(true);
  });

  it('moves the focus to the new step heading, for a move the visitor made', async () => {
    await mount();
    input('a').value = 'x';
    const heading = section('b').querySelector('h2') as HTMLElement;
    const focus = vi.spyOn(heading, 'focus');
    action('next', 'a').click();
    expect(focus).toHaveBeenCalled();
  });

  it('turns Enter in a field into Next instead of a submit', async () => {
    const el = await mount();
    input('a').value = 'x';
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input('a').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(el.current).toBe(1);
  });

  it('leaves Enter alone on the last step', async () => {
    const el = await mount(MARKUP, '#c');
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input('c').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(el.current).toBe(2);
  });

  it('brings forward the step a blocked submit is about', async () => {
    const el = await mount(MARKUP, '#c');
    input('a').dispatchEvent(new Event('invalid'));
    expect(el.current).toBe(0);
  });

  it('does not send the visitor back to a step just because it checked it', async () => {
    const el = await mount();
    input('a').value = 'x';
    action('next', 'a').click();
    input('a').value = '';
    action('next', 'b').click();
    expect(el.current).toBe(2);
  });

  it('follows the URL fragment', async () => {
    const el = await mount();
    location.hash = '#b';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(el.current).toBe(1);
  });
});
