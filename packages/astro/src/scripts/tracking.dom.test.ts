/**
 * The capture script's consent behaviour, against a minimal DOM.
 *
 * This package has no DOM test environment, and the rule elsewhere in the
 * toolchain is to keep decisions in pure modules rather than reach for one. But
 * the decision this script makes — *when* `_ac` may be written — cannot be moved
 * out: it is a conversation between a global that may not exist yet, an event,
 * and a cookie. It is also the whole point of the change, and every way it fails
 * is silent: no error, no banner, no cookie, just attribution that never arrives.
 *
 * So the stub is deliberately small — `location`, `document.cookie`,
 * `querySelector`, `addEventListener` — and asserts only the sequence, never the
 * cookie's contents (that is `@getvitops/utils/tracking`'s job, tested purely).
 */
import { describe, expect, it, vi } from 'vitest';

interface Listener {
  (): void;
}

/** Enough document/window for the script to run. */
function stubDom(search: string, gate?: Record<string, unknown>) {
  let jar = '';
  const listeners = new Map<string, Listener[]>();

  const doc = {
    get cookie() {
      return jar;
    },
    set cookie(value: string) {
      // Enough of a cookie jar to round-trip one write: keep the last value set
      // for each name, ignoring attributes.
      const [pair] = value.split(';');
      const [name, ...rest] = (pair ?? '').split('=');
      const entries = new Map(
        jar
          .split(';')
          .filter(Boolean)
          .map((c) => {
            const [k, ...v] = c.trim().split('=');
            return [k ?? '', v.join('=')] as const;
          }),
      );
      entries.set(name ?? '', rest.join('='));
      jar = [...entries].map(([k, v]) => `${k}=${v}`).join('; ');
    },
    referrer: '',
    querySelector: (sel: string) =>
      sel === '[data-vitops-tracking]'
        ? { getAttribute: (a: string) => (a === 'data-consent' ? 'marketing' : null) }
        : null,
    addEventListener: (type: string, fn: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
  };

  // `defineProperty`, not `Object.assign`: Node defines `navigator` as an
  // accessor with no setter, so assigning to it throws.
  const globals: Record<string, unknown> = {
    document: doc,
    location: { search, pathname: '/landing', protocol: 'https:' },
    navigator: { sendBeacon: () => true },
    window: gate ? { vitopsConsent: gate } : {},
  };
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }

  return {
    get jar() {
      return jar;
    },
    fire: (type: string) => (listeners.get(type) ?? []).forEach((fn) => fn()),
    listening: (type: string) => (listeners.get(type) ?? []).length > 0,
  };
}

/**
 * Re-import the script fresh — it does its work at module scope, so the registry
 * has to be cleared between cases or only the first one would ever run it.
 */
async function run() {
  vi.resetModules();
  await import('./tracking.ts');
}

describe('capture with no consent gate on the page', () => {
  it('writes immediately — a site without the gate made no promise to break', async () => {
    const dom = stubDom('?gclid=G1');
    await run();
    expect(dom.jar).toContain('_ac=');
  });
});

describe('capture with the gate present', () => {
  it('demands the category rather than only reading it', async () => {
    // The bug this replaced: a passive `granted()` check is a permanent no-op,
    // because nothing else on a page ever demands `marketing`.
    const asked: string[] = [];
    const dom = stubDom('?gclid=G1', {
      require: (c: string) => (asked.push(c), false),
      granted: () => false,
    });
    await run();
    expect(asked).toEqual(['marketing']);
    expect(dom.jar).not.toContain('_ac=');
  });

  it('writes at once when the category is already granted', async () => {
    const dom = stubDom('?gclid=G1', { require: () => true, granted: () => true });
    await run();
    expect(dom.jar).toContain('_ac=');
  });

  it('writes when consent arrives later in the same page view', async () => {
    // The click ID is still in the URL, so a grant a moment after the banner
    // appears must still be able to record it.
    let granted = false;
    const dom = stubDom('?gclid=G1', {
      require: () => false,
      granted: () => granted,
    });
    await run();
    expect(dom.jar).not.toContain('_ac=');

    granted = true;
    dom.fire('vitops:consent');
    expect(dom.jar).toContain('_ac=');
  });

  it('listens even while `window.vitopsConsent` is still the inline stub', async () => {
    // The stub <Head /> emits queues `require()` and has no `subscribe` at all.
    // A `subscribe`-based implementation silently never writes here.
    const stub = { q: [] as unknown[], require: () => false, granted: () => false };
    const dom = stubDom('?gclid=G1', stub);
    await run();
    expect(dom.listening('vitops:consent')).toBe(true);
  });
});

describe('an organic visitor', () => {
  it('is never asked, because there is nothing to attribute', async () => {
    // The demand-driven rule applied to attribution: only the arrival that
    // carried a click ID raises the banner.
    const asked: string[] = [];
    const dom = stubDom('', {
      require: (c: string) => (asked.push(c), false),
      granted: () => false,
    });
    await run();
    expect(asked).toEqual([]);
    expect(dom.jar).not.toContain('_ac=');
  });

  it('is not asked for a bare page view with unrelated query params', async () => {
    const asked: string[] = [];
    stubDom('?page=2&q=hello', {
      require: (c: string) => (asked.push(c), false),
      granted: () => false,
    });
    await run();
    expect(asked).toEqual([]);
  });
});
