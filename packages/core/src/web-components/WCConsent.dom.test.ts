/**
 * @vitest-environment happy-dom
 *
 * `<wc-consent>` wiring, against the real gate in `consent/runtime.ts`. The pure decisions (what an absent
 * cookie means, what a revoke covers, whether a prompt is warranted) are asserted in `consent/store.test.ts`;
 * this is the part that is genuinely about the DOM and was untested: that the banner shows only for a demand,
 * shows only the rows that were demanded, writes a patch covering exactly those, and that a revoke clears what
 * the tag declared.
 *
 * The runtime keeps its state at module level and reads `document.cookie` while it evaluates, so each scenario
 * sets the cookie (and any stub) first, then `vi.resetModules()` and imports fresh. `customElements.define` is
 * guarded by `get`, so the class that stays registered is the first one imported; it reads
 * `window.vitopsConsent` at connect time, which is the new runtime every time.
 *
 * Popover is left out on purpose: happy-dom has no `showPopover`, and `WCConsent` then drops the attribute and
 * uses its plain-dock path. What is asserted is `hidden` and the rows, not the top layer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { COOKIE_NAME, parse } from '../consent/store.ts';
import type { ConsentApi } from '../consent/runtime.ts';

const MARKUP = `
<wc-consent hidden>
  <form class="consent">
    <label data-consent-row="analytics"><input type="checkbox" name="analytics" /> Analytics</label>
    <label data-consent-row="marketing"><input type="checkbox" name="marketing" /> Marketing</label>
    <label data-consent-row="preferences"><input type="checkbox" name="preferences" /> Preferences</label>
    <button type="button" data-consent-reject>Reject</button>
    <button type="button" data-consent-save>Save</button>
    <button type="button" data-consent-accept>Accept</button>
  </form>
</wc-consent>`;

let reload: ReturnType<typeof vi.fn>;

/**
 * Fresh runtime + element for one scenario. `extra` (a gated tag) must exist before the gate evaluates,
 * because it scans the document as it loads. The banner is inserted AFTER, so the element upgrades against
 * the finished runtime: inserting it first would run `connectedCallback` while `window.vitopsConsent` is
 * still undefined (or the inline stub), and the element would never be wired.
 */
async function boot(opts: {
  cookie?: string;
  stub?: unknown;
  body?: string;
  extra?: string;
}): Promise<{ api: ConsentApi; el: HTMLElement }> {
  document.cookie = `${COOKIE_NAME}=; max-age=0; path=/`;
  if (opts.cookie) document.cookie = opts.cookie;
  document.body.innerHTML = opts.extra ?? '';
  (window as { vitopsConsent?: unknown }).vitopsConsent = opts.stub;
  vi.resetModules();
  await import('../consent/runtime.ts');
  await import('./WCConsent.ts');
  const api = window.vitopsConsent as ConsentApi;
  document.body.insertAdjacentHTML('beforeend', opts.body ?? MARKUP);
  return { api, el: document.querySelector('wc-consent') as HTMLElement };
}

const rowHidden = (name: string) =>
  (document.querySelector(`[data-consent-row="${name}"]`) as HTMLElement).hidden;
const stored = () => {
  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  return parse(raw ? decodeURIComponent(raw) : undefined);
};
const click = (selector: string) =>
  (document.querySelector(selector) as HTMLElement).dispatchEvent(
    new MouseEvent('click', { bubbles: true }),
  );

beforeEach(() => {
  reload = vi.fn();
  // The runtime reads `location.protocol` as it evaluates and calls `location.reload()` on a revoke.
  vi.stubGlobal('location', {
    protocol: 'https:',
    hostname: 'www.example.com',
    reload,
    href: 'https://www.example.com/',
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('<wc-consent> showing', () => {
  it('stays hidden when nothing has asked for anything', async () => {
    const { api, el } = await boot({});
    expect(api.needed()).toBe(false);
    expect(el.hidden).toBe(true);
  });

  it('shows when a category is demanded, with only that category on offer', async () => {
    const { api, el } = await boot({});
    api.require('analytics');
    expect(el.hidden).toBe(false);
    expect(rowHidden('analytics')).toBe(false);
    expect(rowHidden('marketing')).toBe(true);
    expect(rowHidden('preferences')).toBe(true);
  });

  it('does not write a cookie just by appearing', async () => {
    const { api } = await boot({});
    api.require('analytics');
    expect(document.cookie).not.toContain(COOKIE_NAME);
  });

  it('replays a demand queued by the inline stub before the gate existed', async () => {
    const { api, el } = await boot({
      stub: { q: [['marketing']], needed: () => false },
    });
    expect(api.demanded()).toContain('marketing');
    expect(el.hidden).toBe(false);
    expect(rowHidden('marketing')).toBe(false);
    expect(rowHidden('analytics')).toBe(true);
  });

  it('re-prompts on a corrupt cookie rather than reading it as decided', async () => {
    const { api, el } = await boot({ cookie: `${COOKIE_NAME}=not-json; path=/` });
    api.require('analytics');
    expect(api.granted('analytics')).toBe(false);
    expect(el.hidden).toBe(false);
  });

  it('does not re-prompt a category already answered', async () => {
    const { api, el } = await boot({});
    api.require('analytics');
    click('[data-consent-accept]');
    expect(el.hidden).toBe(true);
    api.require('analytics');
    expect(el.hidden).toBe(true);
  });

  it('shows every offered row for an explicit "cookie settings" request', async () => {
    const { el } = await boot({});
    document.dispatchEvent(new CustomEvent('vitops:consent-open'));
    expect(el.hidden).toBe(false);
    for (const name of ['analytics', 'marketing', 'preferences'])
      expect(rowHidden(name)).toBe(false);
  });
});

describe('<wc-consent> choices cover exactly what was on screen', () => {
  it('Accept grants the demanded category and leaves the others unanswered, not refused', async () => {
    const { api } = await boot({});
    api.require('analytics');
    click('[data-consent-accept]');
    const s = stored();
    expect(s.choices.analytics).toBe(true);
    expect(s.choices.marketing).toBeNull();
    expect(s.choices.preferences).toBeNull();
  });

  it('Reject refuses only the demanded category', async () => {
    const { api } = await boot({});
    api.require('analytics');
    click('[data-consent-reject]');
    const s = stored();
    expect(s.choices.analytics).toBe(false);
    expect(s.choices.marketing).toBeNull();
  });

  it('a later demand for another category is still askable after an earlier answer', async () => {
    const { api, el } = await boot({});
    api.require('analytics');
    click('[data-consent-accept]');
    api.require('preferences');
    expect(el.hidden).toBe(false);
    expect(rowHidden('preferences')).toBe(false);
    expect(rowHidden('analytics')).toBe(true);
  });

  it('Save follows the checkboxes, for the categories shown only', async () => {
    const { api } = await boot({});
    api.require('analytics');
    api.require('marketing');
    (document.querySelector('input[name="analytics"]') as HTMLInputElement).checked = true;
    (document.querySelector('input[name="marketing"]') as HTMLInputElement).checked = false;
    (document.querySelector('input[name="preferences"]') as HTMLInputElement).checked = true;
    click('[data-consent-save]');
    const s = stored();
    expect(s.choices.analytics).toBe(true);
    expect(s.choices.marketing).toBe(false);
    // Ticked, but not on screen, so not part of this decision.
    expect(s.choices.preferences).toBeNull();
  });

  it('never submits its form', async () => {
    const { api } = await boot({});
    api.require('analytics');
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    document.querySelector('form')!.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
  });

  it('announces the decision on document', async () => {
    const { api } = await boot({});
    api.require('analytics');
    const seen: Array<{ choices: Record<string, boolean | null> }> = [];
    document.addEventListener('vitops:consent', (e) =>
      seen.push((e as CustomEvent).detail as (typeof seen)[number]),
    );
    click('[data-consent-accept]');
    expect(seen.at(-1)?.choices.analytics).toBe(true);
  });
});

describe('revoking', () => {
  const tag =
    '<div data-consent="analytics" data-consent-src="/lib.js" data-consent-cookies="_ga,_ga_*"></div>';
  const granted = () =>
    `${COOKIE_NAME}=${encodeURIComponent(
      JSON.stringify({ v: 2, ts: 1, c: { analytics: true, marketing: false, preferences: false } }),
    )}; path=/`;

  it('clears the cookies the revoked tag declared, including a prefix pattern', async () => {
    const { api } = await boot({ cookie: granted(), extra: tag });
    // Only meaningful if the stored grant was understood.
    expect(api.granted('analytics')).toBe(true);
    document.cookie = '_ga=1; path=/';
    document.cookie = '_ga_ABC123=1; path=/';
    document.cookie = 'unrelated=1; path=/';
    api.reloadOnRevoke = false;
    api.set({ analytics: false });
    expect(document.cookie).not.toContain('_ga=');
    expect(document.cookie).not.toContain('_ga_ABC123');
    expect(document.cookie).toContain('unrelated=1');
  });

  it('reloads when something the revoked category gated was actually running', async () => {
    const { api } = await boot({ cookie: granted(), extra: tag });
    // Let the idle-strategy scan activate the tag.
    await new Promise((r) => setTimeout(r, 0));
    api.set({ analytics: false });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload when nothing ran, so a toggle never flashes the page', async () => {
    const { api } = await boot({});
    api.set({ analytics: true });
    api.set({ analytics: false });
    expect(reload).not.toHaveBeenCalled();
  });

  it('honours reload-on-revoke="false" on the element', async () => {
    const { api } = await boot({
      cookie: granted(),
      extra: tag,
      body: MARKUP.replace('<wc-consent hidden>', '<wc-consent hidden reload-on-revoke="false">'),
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(api.reloadOnRevoke).toBe(false);
    api.set({ analytics: false });
    expect(reload).not.toHaveBeenCalled();
  });
});
