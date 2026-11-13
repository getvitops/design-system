/**
 * @vitest-environment happy-dom
 *
 * `<wc-field>` wiring. The pure decisions (describedby merging, when an error shows) are in
 * `utils/field.test.ts`; this is the DOM: that help and error are linked to the real control,
 * the error appears at the right moment, a host message blocks `reportValidity()`, and the control
 * itself is never moved or replaced.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { WCField } from './WCField.ts';

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

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('<wc-field> wiring', () => {
  it('links the help text to the control, and gives the error node an id and a live region', async () => {
    const el = await mount();
    const help = el.querySelector('.field__help')!;
    expect(help.id).toMatch(/^wc-field-\d+-help$/);
    expect(control(el).getAttribute('aria-describedby')).toBe(help.id);
    expect(error(el).id).toMatch(/-error$/);
    expect(error(el).getAttribute('aria-live')).toBe('polite');
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

  it('shows the invalid message on blur and ties it to the control', async () => {
    const el = await mount();
    vi.spyOn(control(el), 'validationMessage', 'get').mockReturnValue('Fill this in.');
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
    fire(input, 'blur');
    expect(error(el).textContent).not.toBe('');
    input.value = 'Ada';
    fire(input, 'input');
    expect(error(el).textContent).toBe('');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
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
    expect(control(el).validity.customError).toBe(false);
    expect(error(el).textContent).toBe('');
  });

  it('lets the host assert it again from its own input listener', async () => {
    const el = await mount(FIELD('<input name="email" />'));
    el.closest('form')!.addEventListener('input', () => el.setError('Still wrong.'));
    control(el).value = 'x';
    control(el).dispatchEvent(new Event('input', { bubbles: true }));
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
    expect(error(el).textContent).toBe('');
    expect(control(el).hasAttribute('aria-invalid')).toBe(false);
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
