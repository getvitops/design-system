/**
 * @vitest-environment happy-dom
 *
 * `<wc-field>` wiring. The pure decisions (describedby merging, when an error shows) are in
 * `utils/field.test.ts`; this is the DOM: that help and error are linked to the real control,
 * the error appears at the right moment, a host message blocks `reportValidity()`, and the control
 * itself is never moved or replaced.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { WCField } from './WCField.ts';
import { ANNOUNCE_DELAY_MS, resetAnnouncer } from './utils/announcer.ts';

beforeAll(async () => {
  await import('./WCField.ts');
});

const FIELD = (input = '<input name="first" required />', extra = '') => `
  <label class="field__control">
    <span class="field__label">First name</span>
    ${input}
  </label>
  <small class="field__help">As on your ID.</small>
  ${extra}`;

async function mount(body = FIELD()): Promise<WCField> {
  document.body.innerHTML = `<form><wc-field class="field">${body}</wc-field></form>`;
  const el = document.querySelector('wc-field') as WCField;
  await el.updateComplete;
  return el;
}
const control = (el: Element) => el.querySelector('input, select, textarea') as HTMLInputElement;
const error = (el: Element) => el.querySelector('.field__error') as HTMLElement;
const fire = (target: Element, type: string) =>
  target.dispatchEvent(new Event(type, { bubbles: false }));
/** One animation frame: input-driven renders are deferred to it. */
const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
const announcer = () => document.querySelector('[data-wc-announcer]') as HTMLElement | null;

beforeEach(() => {
  document.body.innerHTML = '';
  resetAnnouncer();
});

describe('<wc-field> wiring', () => {
  it('links the help text to the control, and gives the error node an id but NOT a live region', async () => {
    const el = await mount();
    const help = el.querySelector('.field__help')!;
    expect(help.id).toMatch(/^wc-field-\d+-help$/);
    expect(control(el).getAttribute('aria-describedby')).toBe(help.id);
    expect(error(el).id).toMatch(/-error$/);
    // A node that is shown rather than changed is announced unreliably; one page-level region
    // does the speaking instead (see the announcer tests below).
    expect(error(el).hasAttribute('aria-live')).toBe(false);
  });

  it('starts every control at aria-invalid="false", not unset', async () => {
    // Firefox and Safari expose an empty `required` control as invalid on arrival when the
    // attribute is simply absent, announcing "invalid entry" before the visitor has done anything.
    const el = await mount();
    expect(control(el).getAttribute('aria-invalid')).toBe('false');
  });

  it('creates the shared announcer region at upgrade, before anything is written to it', async () => {
    await mount();
    expect(announcer()).not.toBeNull();
    expect(announcer()!.getAttribute('aria-live')).toBe('polite');
    expect(announcer()!.textContent).toBe('');
  });

  it('keeps an aria-describedby the author wrote', async () => {
    const el = await mount(FIELD('<input name="first" aria-describedby="mine" />'));
    expect(control(el).getAttribute('aria-describedby')).toBe(
      `mine ${el.querySelector('.field__help')!.id}`,
    );
  });

  it('never moves or replaces the control it wraps', async () => {
    document.body.innerHTML = `<form><wc-field>${FIELD()}</wc-field></form>`;
    const before = control(document.body);
    const parent = before.parentElement;
    await (document.querySelector('wc-field') as WCField).updateComplete;
    expect(control(document.body)).toBe(before);
    expect(before.parentElement).toBe(parent);
  });

  it('is fine with no help text at all', async () => {
    const el = await mount('<label><span>Name</span><input name="first" /></label>');
    expect(control(el).hasAttribute('aria-describedby')).toBe(false);
  });

  it('does nothing, and does not throw, around no control', async () => {
    const el = await mount('<p>just text</p>');
    expect(el.controls).toHaveLength(0);
    expect(el.querySelector('.field__error')).toBeNull();
  });
});

describe('<wc-field> errors', () => {
  it('shows nothing while a required field is untouched', async () => {
    const el = await mount();
    expect(error(el).textContent).toBe('');
    expect(el.hasAttribute('data-invalid')).toBe(false);
  });

  it('does not report a field the visitor only tabbed past', async () => {
    // `:user-invalid` waits for an edit, and so does this: an empty required control that was
    // merely passed through must not announce an error.
    const el = await mount();
    vi.spyOn(control(el), 'validationMessage', 'get').mockReturnValue('Fill this in.');
    fire(control(el), 'blur');
    expect(error(el).textContent).toBe('');
    expect(control(el).getAttribute('aria-invalid')).toBe('false');
    expect(el.hasAttribute('data-invalid')).toBe(false);
  });

  it('shows the invalid message on blur after an edit and ties it to the control', async () => {
    const el = await mount();
    vi.spyOn(control(el), 'validationMessage', 'get').mockReturnValue('Fill this in.');
    fire(control(el), 'input');
    fire(control(el), 'blur');
    expect(error(el).textContent).toBe('Fill this in.');
    expect(control(el).getAttribute('aria-invalid')).toBe('true');
    expect(control(el).getAttribute('aria-describedby')).toContain(error(el).id);
    expect(el.hasAttribute('data-invalid')).toBe(true);
  });

  it('shows it when a submit reports the control invalid, without cancelling the event', async () => {
    const el = await mount();
    vi.spyOn(control(el), 'validationMessage', 'get').mockReturnValue('Fill this in.');
    const event = new Event('invalid', { cancelable: true });
    control(el).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(error(el).textContent).toBe('Fill this in.');
  });

  it('clears the message, and the aria wiring, once the value is valid', async () => {
    const el = await mount();
    const input = control(el);
    // happy-dom reports an empty `validationMessage`; a real browser words it itself.
    vi.spyOn(input, 'validationMessage', 'get').mockReturnValue('Fill this in.');
    input.value = '';
    fire(input, 'input');
    fire(input, 'blur');
    expect(error(el).textContent).not.toBe('');
    input.value = 'Ada';
    fire(input, 'input');
    await frame();
    expect(error(el).textContent).toBe('');
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(input.getAttribute('aria-describedby')).toBe(el.querySelector('.field__help')!.id);
  });
});

describe('<wc-field> setError', () => {
  it('shows a host message at once and blocks reportValidity()', async () => {
    const el = await mount(FIELD('<input name="email" />'));
    el.setError('Must be a full URL, including https://');
    expect(error(el).textContent).toBe('Must be a full URL, including https://');
    expect(control(el).validity.customError).toBe(true);
    expect(control(el).checkValidity()).toBe(false);
  });

  it('clearError restores a valid control', async () => {
    const el = await mount(FIELD('<input name="email" />'));
    el.setError('Nope.');
    el.clearError();
    expect(error(el).textContent).toBe('');
    expect(control(el).checkValidity()).toBe(true);
  });

  it("drops a stale host message when the visitor types, so the form isn't blocked by it", async () => {
    const el = await mount(FIELD('<input name="email" />'));
    el.setError('Nope.');
    control(el).value = 'a@b.ca';
    fire(control(el), 'input');
    // The validity is released at once, so the form is never blocked by a stale verdict...
    expect(control(el).validity.customError).toBe(false);
    // ...and the text follows on the next frame, so a host that re-asserts it does not flicker.
    await frame();
    expect(error(el).textContent).toBe('');
  });

  it('does not touch the text when a host re-asserts an unchanged message on every keystroke', async () => {
    const el = await mount(FIELD('<input name="email" />'));
    el.closest('form')!.addEventListener('input', () => el.setError('Still wrong.'));
    control(el).dispatchEvent(new Event('input', { bubbles: true }));
    await frame();
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) => mutations.push(...records));
    observer.observe(error(el), { childList: true, characterData: true, subtree: true });
    for (let i = 0; i < 5; i++) {
      control(el).dispatchEvent(new Event('input', { bubbles: true }));
      await frame();
    }
    await Promise.resolve();
    observer.disconnect();
    // Blank-then-restore on each key is what a live region reads as a new error every time.
    expect(mutations).toHaveLength(0);
    expect(error(el).textContent).toBe('Still wrong.');
  });

  it('ignores setError with the message it already has', async () => {
    const el = await mount(FIELD('<input name="email" />'));
    el.setError('Nope.');
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) => mutations.push(...records));
    observer.observe(error(el), { childList: true, characterData: true, subtree: true });
    el.setError('Nope.');
    await Promise.resolve();
    observer.disconnect();
    expect(mutations).toHaveLength(0);
  });

  it('lets the host assert it again from its own input listener', async () => {
    const el = await mount(FIELD('<input name="email" />'));
    el.closest('form')!.addEventListener('input', () => el.setError('Still wrong.'));
    control(el).value = 'x';
    control(el).dispatchEvent(new Event('input', { bubbles: true }));
    await frame();
    expect(error(el).textContent).toBe('Still wrong.');
    expect(control(el).checkValidity()).toBe(false);
  });
});

describe('<wc-field> server-rendered error', () => {
  const WITH_ERROR = FIELD(
    '<input name="email" />',
    '<span class="field__error" aria-live="polite">Must be an email address.</span>',
  );

  it('keeps an error the server wrote, linked to the control, through upgrade', async () => {
    const el = await mount(WITH_ERROR);
    expect(error(el).textContent).toBe('Must be an email address.');
    expect(control(el).getAttribute('aria-invalid')).toBe('true');
    expect(control(el).getAttribute('aria-describedby')).toContain(error(el).id);
    expect(el.hasAttribute('data-invalid')).toBe(true);
  });

  it('drops it as soon as the visitor edits the value', async () => {
    const el = await mount(WITH_ERROR);
    control(el).value = 'a@b.ca';
    fire(control(el), 'input');
    await frame();
    expect(error(el).textContent).toBe('');
    expect(control(el).getAttribute('aria-invalid')).toBe('false');
  });

  it('removes the live region the server wrote on its error node', async () => {
    const el = await mount(WITH_ERROR);
    expect(error(el).hasAttribute('aria-live')).toBe(false);
  });
});

describe('<wc-field> announcements', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('speaks an error once, a moment later, through the shared region, with the field name', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const el = await mount();
    vi.spyOn(control(el), 'validationMessage', 'get').mockReturnValue('Fill this in.');
    fire(control(el), 'input');
    fire(control(el), 'blur');
    // Not immediately: the field that receives focus next is announced first.
    expect(announcer()!.textContent).toBe('');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(announcer()!.textContent).toBe('First name: Fill this in.');
  });

  it('does not speak the same error again while it is still showing', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const el = await mount();
    vi.spyOn(control(el), 'validationMessage', 'get').mockReturnValue('Fill this in.');
    fire(control(el), 'input');
    fire(control(el), 'blur');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    announcer()!.textContent = ''; // pretend the screen reader consumed it
    fire(control(el), 'blur');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(announcer()!.textContent).toBe('');
  });

  it('does not speak when a submit reports the control invalid (focus reads it instead)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const el = await mount();
    vi.spyOn(control(el), 'validationMessage', 'get').mockReturnValue('Fill this in.');
    control(el).dispatchEvent(new Event('invalid', { cancelable: true }));
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(error(el).textContent).toBe('Fill this in.');
    expect(announcer()!.textContent).toBe('');
  });

  it('shares ONE region across every field on the page', async () => {
    document.body.innerHTML = `<form>
      <wc-field class="field">${FIELD('<input name="a" required />')}</wc-field>
      <wc-field class="field">${FIELD('<input name="b" required />')}</wc-field>
    </form>`;
    await Promise.all(
      Array.from(document.querySelectorAll<WCField>('wc-field')).map((f) => f.updateComplete),
    );
    expect(document.querySelectorAll('[data-wc-announcer]')).toHaveLength(1);
  });

  it('announceError() speaks a host-set message, once', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const el = await mount(FIELD('<input name="email" />'));
    el.setError('Must be a full URL.');
    el.announceError();
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(announcer()!.textContent).toBe('First name: Must be a full URL.');
  });
});

describe('<wc-field> events and counter', () => {
  it('fires field-change with the name, the value and validity on change', async () => {
    const el = await mount(FIELD('<input name="first" />'));
    const handler = vi.fn();
    el.addEventListener('field-change', (e) => handler((e as CustomEvent).detail));
    control(el).value = 'Ada';
    fire(control(el), 'change');
    expect(handler).toHaveBeenCalledWith({ name: 'first', value: 'Ada', valid: true });
  });

  it('reports a checkbox as a boolean', async () => {
    const el = await mount(FIELD('<input type="checkbox" name="agree" />'));
    const handler = vi.fn();
    el.addEventListener('field-change', (e) => handler((e as CustomEvent).detail));
    control(el).checked = true;
    fire(control(el), 'change');
    expect(handler.mock.calls[0]![0]).toMatchObject({ name: 'agree', value: true });
  });

  it('adds a counter for a control with maxlength and keeps it current', async () => {
    const el = await mount(FIELD('<textarea name="bio" maxlength="20"></textarea>'));
    const counter = el.querySelector('.field__counter') as HTMLElement;
    expect(counter.textContent).toBe('0 / 20');
    expect(counter.getAttribute('aria-hidden')).toBe('true');
    control(el).value = 'hello';
    fire(control(el), 'input');
    expect(counter.textContent).toBe('5 / 20');
  });

  it('adds no counter without a limit', async () => {
    const el = await mount();
    expect(el.querySelector('.field__counter')).toBeNull();
  });
});

describe('<wc-field> groups', () => {
  it('wires every radio in a group', async () => {
    const el = await mount(
      FIELD(
        '<input type="radio" name="level" value="A" /><input type="radio" name="level" value="AA" />',
      ),
    );
    const radios = Array.from(el.querySelectorAll('input'));
    const help = el.querySelector('.field__help')!.id;
    expect(radios.map((r) => r.getAttribute('aria-describedby'))).toEqual([help, help]);
  });
});
