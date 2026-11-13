/**
 * @vitest-environment happy-dom
 *
 * `<wc-color-field>`: the text input is the fallback and the only submitted control; the picker is
 * fetched when the details is first opened and stays in step with the input.
 */
import { beforeAll, describe, expect, it } from 'vite-plus/test';

beforeAll(async () => {
  // happy-dom has no ElementInternals; the picker is form-associated and asks for them.
  (HTMLElement.prototype as unknown as { attachInternals: () => object }).attachInternals = () => ({
    setFormValue() {},
  });
  await import('./WCColorField.ts');
});

async function mount(value = '#1d4ed8') {
  document.body.innerHTML = `<form><wc-color-field><label class="field__control"><span class="field__label">Colour</span><input type="text" name="seed" value="${value}" data-widget="color"></label></wc-color-field></form>`;
  await Promise.resolve();
  await Promise.resolve();
  const host = document.querySelector('wc-color-field')!;
  const input = host.querySelector('input')!;
  const details = host.querySelector('details') as HTMLDetailsElement;
  return { host, input, details };
}

const open = async (details: HTMLDetailsElement) => {
  details.open = true;
  details.dispatchEvent(new Event('toggle'));
  // Two dynamic imports and a sync: wait for the picker, then a beat for the value to settle.
  for (let i = 0; i < 100 && !details.querySelector('wc-oklch-color-picker'); i++) {
    await new Promise((r) => setTimeout(r, 20));
  }
  await new Promise((r) => setTimeout(r, 100));
};

describe('<wc-color-field>', () => {
  it('adds a folded picker and leaves the text input as the only control', async () => {
    const { host, input, details } = await mount();
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')?.textContent).toBe('Pick a colour');
    expect(host.querySelector('wc-oklch-color-picker')).toBeNull();
    expect(input.name).toBe('seed');
  });

  it('fetches the picker on first open and seeds it from the input', async () => {
    const { host, details } = await mount('#ff0000');
    await open(details);
    const picker = host.querySelector('wc-oklch-color-picker') as HTMLElement & { value: string };
    expect(picker).not.toBeNull();
    expect(picker.getAttribute('name') ?? '').toBe('');
    expect(picker.value.toLowerCase()).toMatch(/^#(f00|ff0000)$/);
  });

  it('writes the picker hex into the input and announces it as typing', async () => {
    const { host, input, details } = await mount();
    await open(details);
    const picker = host.querySelector('wc-oklch-color-picker') as HTMLElement & { value: string };
    let heard = 0;
    input.addEventListener('input', () => heard++);
    picker.value = '#00ff00';
    picker.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    expect(input.value).toBe('#00ff00');
    expect(heard).toBe(1);
  });

  it('ignores the picker mid-drag placeholder', async () => {
    const { host, input, details } = await mount('#123456');
    await open(details);
    const picker = host.querySelector('wc-oklch-color-picker') as HTMLElement & { value: string };
    picker.value = '-';
    picker.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    expect(input.value).toBe('#123456');
  });

  it('leaves a value the picker cannot show alone', async () => {
    const { input, details } = await mount('oklch(0.6 0.2 250)');
    await open(details);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.value).toBe('oklch(0.6 0.2 250)');
  });
});
