/**
 * @vitest-environment happy-dom
 *
 * `<wc-dismissable>` hands focus to a neighbour instead of dropping it to <body>.
 * `exit="0"` skips the fade so removal is synchronous; the fade path shares `#detach()`.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

beforeAll(async () => {
  await import('./WCDismissable.ts');
});

beforeEach(() => {
  document.body.innerHTML = '';
});

const mount = (html: string): void => {
  document.body.innerHTML = html;
};

describe('<wc-dismissable> focus return', () => {
  it('moves focus to the next focusable after the dismissed element', () => {
    mount(`
      <a id="before" href="#a">before</a>
      <wc-dismissable exit="0"><div><button id="close" data-dismiss>x</button></div></wc-dismissable>
      <a id="after" href="#b">after</a>`);
    (document.getElementById('close') as HTMLElement).focus();
    expect(document.activeElement?.id).toBe('close');
    (document.getElementById('close') as HTMLElement).click();
    expect(document.querySelector('wc-dismissable')).toBeNull();
    expect(document.activeElement?.id).toBe('after');
  });

  it('falls back to the nearest focusable before it when nothing follows', () => {
    mount(`
      <a id="first" href="#a">first</a>
      <a id="before" href="#b">before</a>
      <wc-dismissable exit="0"><button id="close" data-dismiss>x</button></wc-dismissable>`);
    (document.getElementById('close') as HTMLElement).focus();
    (document.getElementById('close') as HTMLElement).click();
    expect(document.activeElement?.id).toBe('before');
  });

  it('does not touch focus when focus was elsewhere', () => {
    mount(`
      <a id="elsewhere" href="#a">elsewhere</a>
      <wc-dismissable exit="0"><button id="close" data-dismiss>x</button></wc-dismissable>
      <a id="after" href="#b">after</a>`);
    (document.getElementById('elsewhere') as HTMLElement).focus();
    (document.getElementById('close') as HTMLElement).click();
    expect(document.activeElement?.id).toBe('elsewhere');
  });

  it('skips inert and hidden candidates', () => {
    mount(`
      <wc-dismissable exit="0"><button id="close" data-dismiss>x</button></wc-dismissable>
      <div inert><a id="inert" href="#a">inert</a></div>
      <a id="hidden" href="#b" hidden>hidden</a>
      <a id="real" href="#c">real</a>`);
    (document.getElementById('close') as HTMLElement).focus();
    (document.getElementById('close') as HTMLElement).click();
    expect(document.activeElement?.id).toBe('real');
  });

  it('removes cleanly with no candidates at all', () => {
    mount(`<wc-dismissable exit="0"><button id="close" data-dismiss>x</button></wc-dismissable>`);
    (document.getElementById('close') as HTMLElement).focus();
    (document.getElementById('close') as HTMLElement).click();
    expect(document.querySelector('wc-dismissable')).toBeNull();
  });
});

describe('<wc-dismissable> auto-dismiss countdown', () => {
  const fire = (target: Element, type: string, init: EventInit = {}) =>
    target.dispatchEvent(new Event(type, { bubbles: false, ...init }));
  const present = () => document.querySelector('wc-dismissable') !== null;
  /** happy-dom does not implement `:focus-visible`; say what the browser would for this target. */
  const focusVisible = (target: Element, visible: boolean) => {
    const real = Element.prototype.matches;
    vi.spyOn(target, 'matches').mockImplementation(function (this: Element, selector: string) {
      return selector === ':focus-visible' ? visible : real.call(this, selector);
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mount(
      '<wc-dismissable duration="1000" exit="0"><button id="close" data-dismiss>x</button></wc-dismissable>',
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('dismisses after the duration when nobody is interacting', () => {
    vi.advanceTimersByTime(999);
    expect(present()).toBe(true);
    vi.advanceTimersByTime(2);
    expect(present()).toBe(false);
  });

  it('stops counting while the pointer is over it, and resumes with the time that was left', () => {
    const el = document.querySelector('wc-dismissable')!;
    vi.advanceTimersByTime(600); // 400ms left
    fire(el, 'pointerenter');
    vi.advanceTimersByTime(60_000);
    expect(present()).toBe(true); // however long the reader takes
    fire(el, 'pointerleave');
    vi.advanceTimersByTime(399);
    expect(present()).toBe(true);
    vi.advanceTimersByTime(2);
    expect(present()).toBe(false);
  });

  it('stops counting while keyboard focus is inside, and resumes when it leaves', () => {
    const el = document.querySelector('wc-dismissable')!;
    focusVisible(el, true);
    fire(el, 'focusin');
    vi.advanceTimersByTime(10_000);
    expect(present()).toBe(true);
    el.dispatchEvent(new FocusEvent('focusout', { relatedTarget: document.body }));
    vi.advanceTimersByTime(1001);
    expect(present()).toBe(false);
  });

  it('does not wait for focus that came from a mouse click', () => {
    const el = document.querySelector('wc-dismissable')!;
    focusVisible(el, false);
    fire(el, 'focusin');
    vi.advanceTimersByTime(1001);
    expect(present()).toBe(false);
  });

  it('keeps waiting while focus moves between controls inside it', () => {
    const el = document.querySelector('wc-dismissable')!;
    focusVisible(el, true);
    fire(el, 'focusin');
    el.dispatchEvent(new FocusEvent('focusout', { relatedTarget: el.querySelector('button') }));
    vi.advanceTimersByTime(10_000);
    expect(present()).toBe(true);
  });

  it('does not restart the full duration after a pause', () => {
    const el = document.querySelector('wc-dismissable')!;
    vi.advanceTimersByTime(900);
    fire(el, 'pointerenter');
    fire(el, 'pointerleave');
    vi.advanceTimersByTime(101);
    expect(present()).toBe(false);
  });
});
