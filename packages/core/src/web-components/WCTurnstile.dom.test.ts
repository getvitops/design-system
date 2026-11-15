/**
 * @vitest-environment happy-dom
 *
 * `<wc-turnstile>` when the Cloudflare script cannot load (an ad blocker, a CSP, no network).
 * It used to cancel every submit for ever: a visitor with JavaScript could not send the form at
 * all, while one without could. The decisions are in `utils/turnstile.test.ts`; this is the wiring.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

beforeAll(async () => {
  await import('./WCTurnstile.ts');
});

const MARKUP = `
  <form action="/send" method="post">
    <input name="email" />
    <wc-turnstile sitekey="0x4AAAAAAAbcdefGHIJ">
      <p data-turnstile-fallback>The spam check needs JavaScript.</p>
    </wc-turnstile>
    <button>Send</button>
  </form>`;

async function mount() {
  document.body.innerHTML = MARKUP;
  await new Promise((r) => requestAnimationFrame(r));
  const form = document.querySelector('form') as HTMLFormElement;
  const el = document.querySelector('wc-turnstile') as HTMLElement;
  return { form, el };
}

/**
 * Let the script load fail. happy-dom has JavaScript file loading disabled, so the element's
 * appended Cloudflare `<script>` errors on its own, which is the blocked-by-an-ad-blocker case.
 */
const scriptFails = () => new Promise((resolve) => setTimeout(resolve, 20));

const submit = (form: HTMLFormElement) => {
  const event = new Event('submit', { cancelable: true, bubbles: true });
  form.dispatchEvent(event);
  return event;
};

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  // `requestSubmit` is not implemented in every happy-dom; a submit it dispatches is what matters.
  vi.restoreAllMocks();
});

describe('<wc-turnstile> when the script cannot load', () => {
  it('holds a submit while the check is still loading', async () => {
    const { form } = await mount();
    form.querySelector('input')!.dispatchEvent(new Event('focusin', { bubbles: true }));
    // Synchronously after the first interaction, before the failure has landed.
    expect(submit(form).defaultPrevented).toBe(true);
  });

  it('stops holding submits once the script is blocked, so the form can still be sent', async () => {
    const { form, el } = await mount();
    form.querySelector('input')!.dispatchEvent(new Event('focusin', { bubbles: true }));
    await scriptFails();
    // Told what happened, in the status region.
    expect(el.querySelector('.turnstile__status')!.textContent).toContain('could not load');
    // And the next submit goes through, token-less, as it does with no JS. The server decides.
    expect(submit(form).defaultPrevented).toBe(false);
  });

  it('sends the submit it was holding when the script turns out to be blocked', async () => {
    const { form } = await mount();
    const requestSubmit = vi.fn();
    form.requestSubmit = requestSubmit;
    form.querySelector('input')!.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(submit(form).defaultPrevented).toBe(true); // held, waiting for a token
    await scriptFails();
    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('<wc-turnstile> status region', () => {
  it('exists from upgrade, empty and never hidden, so a message is a change and not a reveal', async () => {
    const { el } = await mount();
    const status = el.querySelector<HTMLElement>('.turnstile__status')!;
    expect(status).not.toBeNull();
    expect(status.getAttribute('role')).toBe('status');
    expect(status.textContent).toBe('');
    expect(status.hasAttribute('hidden')).toBe(false);
  });
});
