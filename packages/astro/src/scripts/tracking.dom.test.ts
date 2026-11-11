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
import { describe, expect, it, vi } from 'vite-plus/test';

interface Listener {
  (event?: unknown): void;
}

/** An element with one text child: just enough for the phone swap to read and rewrite. */
interface FakeLink {
  nodeType: 1;
  attrs: Map<string, string>;
  text: { nodeType: 3; data: string };
  childNodes: unknown[];
  getAttribute(k: string): string | null;
  setAttribute(k: string, v: string): void;
}
function fakeLink(text: string, href?: string): FakeLink {
  const attrs = new Map<string, string>(href ? [['href', href]] : []);
  const node = { nodeType: 3 as const, data: text };
  return {
    nodeType: 1,
    attrs,
    text: node,
    childNodes: [node],
    getAttribute: (k) => attrs.get(k) ?? null,
    setAttribute: (k, v) => void attrs.set(k, v),
  };
}

/** Enough document/window for the script to run. */
function stubDom(
  search: string,
  gate?: Record<string, unknown>,
  marker: {
    abCookie?: string;
    initialCookie?: string;
    phone?: { number: string; sources: Record<string, string> };
    googleNative?: boolean;
    links?: FakeLink[];
    spans?: FakeLink[];
  } = {},
) {
  let jar = marker.initialCookie ?? '';
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
        ? {
            getAttribute: (a: string) =>
              a === 'data-consent'
                ? 'marketing'
                : a === 'data-ab-cookie'
                  ? (marker.abCookie ?? null)
                  : a === 'data-phone-numbers'
                    ? marker.phone
                      ? JSON.stringify(marker.phone)
                      : null
                    : null,
            hasAttribute: (a: string) => a === 'data-google-call-tracking' && !!marker.googleNative,
          }
        : null,
    querySelectorAll: (sel: string) =>
      sel.startsWith('a[href^="tel:"]')
        ? (marker.links ?? [])
        : sel === '[data-vitops-phone]'
          ? (marker.spans ?? [])
          : [],
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
    get window() {
      return globalThis.window as unknown as {
        vitopsSwapPhone?: (d: string, t: unknown, o: string) => void;
        vitopsPhoneSwaps?: unknown[];
      };
    },
    get jar() {
      return jar;
    },
    fire: (type: string, event?: unknown) => (listeners.get(type) ?? []).forEach((fn) => fn(event)),
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

describe('A/B variant cookie read', () => {
  it('reads the default `_ab` cookie when the marker carries no override', async () => {
    const dom = stubDom(
      '?gclid=G1',
      { require: () => true, granted: () => true },
      {
        initialCookie: '_ab=control',
      },
    );
    await run();
    expect(dom.jar).toContain('ab_variant%22%3A%22control');
  });

  it('reads a per-experiment cookie named on the marker instead of the default', async () => {
    const dom = stubDom(
      '?gclid=G1',
      { require: () => true, granted: () => true },
      { abCookie: '_ab_contact-form-v2', initialCookie: '_ab_contact-form-v2=new-form' },
    );
    await run();
    expect(dom.jar).toContain('ab_variant%22%3A%22new-form');
  });

  it('URL-decodes the cookie value, and does not truncate at an internal `=`', async () => {
    // The bug this replaced: `split('=')[1]` truncated at the FIRST `=` inside
    // the whole `name=value` pair rather than only the separator, and never
    // decoded — a value containing `=` or a reserved character came back
    // mangled or dropped one hop earlier than this cookie.
    const dom = stubDom(
      '?gclid=G1',
      { require: () => true, granted: () => true },
      { initialCookie: `_ab=${encodeURIComponent('a=b')}` },
    );
    await run();
    expect(dom.jar).toContain(`ab_variant%22%3A%22${encodeURIComponent('a=b')}`);
  });

  it('is absent from the record when no A/B cookie is set', async () => {
    const dom = stubDom('?gclid=G1', { require: () => true, granted: () => true });
    await run();
    expect(dom.jar).not.toContain('ab_variant');
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

describe('tel:/mailto: click beacons', () => {
  /**
   * Enough of a click event for the handler's `closest()` call to resolve to a
   * fake anchor carrying `href` — a crude selector match on the link's own
   * scheme, since the stub has no real CSS engine behind it.
   */
  function clickOn(href: string) {
    const anchor = { href, getAttribute: () => null };
    const target = {
      closest: (sel: string) => (sel.includes(`${href.split(':')[0]}:`) ? anchor : null),
    };
    return { target };
  }

  function captureBeacons(): [string, string][] {
    const sent: [string, string][] = [];
    (globalThis.navigator as { sendBeacon: (url: string, body: string) => boolean }).sendBeacon = (
      url,
      body,
    ) => (sent.push([url, body]), true);
    return sent;
  }

  it('beacons a call event for a tel: link', async () => {
    const dom = stubDom('');
    const sent = captureBeacons();
    await run();
    dom.fire('click', clickOn('tel:+15551234567'));
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0]![1])).toEqual({ event: 'call', phone: 'tel:+15551234567' });
  });

  it('beacons an email event for a mailto: link', async () => {
    const dom = stubDom('');
    const sent = captureBeacons();
    await run();
    dom.fire('click', clickOn('mailto:sales@acme.ca'));
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0]![1])).toEqual({ event: 'email', email: 'mailto:sales@acme.ca' });
  });

  it('ignores a click on an unrelated link', async () => {
    const dom = stubDom('');
    const sent = captureBeacons();
    await run();
    dom.fire('click', clickOn('https://example.com'));
    expect(sent).toHaveLength(0);
  });
});

describe('a click on a swapped tel: link', () => {
  it('tells the route which tracking number was dialled', async () => {
    const sent: string[] = [];
    stubDom('');
    Object.defineProperty(globalThis, 'navigator', {
      value: { sendBeacon: (_u: string, body: string) => (sent.push(body), true) },
      writable: true,
      configurable: true,
    });
    const handlers: ((e: unknown) => void)[] = [];
    (
      document as unknown as { addEventListener: (t: string, f: (e: unknown) => void) => void }
    ).addEventListener = (t, f) => void (t === 'click' && handlers.push(f));
    await run();
    const anchor = {
      href: 'tel:+16135550101',
      getAttribute: (k: string) => (k === 'data-vitops-phone-source' ? 'meta' : null),
    };
    handlers.forEach((h) => h({ target: { closest: () => anchor } }));
    expect(JSON.parse(sent[0]!)).toEqual({
      event: 'call',
      phone: 'tel:+16135550101',
      phoneSource: 'meta',
    });
  });
});

describe('Google Ads conversion firing on a tel:/mailto: click', () => {
  function clickOn(href: string) {
    const anchor = { href, getAttribute: () => null };
    return {
      target: {
        closest: (sel: string) => (sel.includes(`${href.split(':')[0]}:`) ? anchor : null),
      },
    };
  }

  it('fires gtag(event, conversion, …) with the call action for a tel: click', async () => {
    const dom = stubDom('');
    await run();
    const calls: unknown[][] = [];
    Object.assign(globalThis.window as object, {
      gtag: (...args: unknown[]) => calls.push(args),
      vitopsAdsConversions: { google: { call: 'AW-123/callLbl', email: 'AW-123/emailLbl' } },
    });
    dom.fire('click', clickOn('tel:+15551234567'));
    expect(calls).toEqual([['event', 'conversion', { send_to: 'AW-123/callLbl' }]]);
  });

  it('fires the email action, not call, for a mailto: click — the two used to share one target', async () => {
    const dom = stubDom('');
    await run();
    const calls: unknown[][] = [];
    Object.assign(globalThis.window as object, {
      gtag: (...args: unknown[]) => calls.push(args),
      vitopsAdsConversions: { google: { call: 'AW-123/callLbl', email: 'AW-123/emailLbl' } },
    });
    dom.fire('click', clickOn('mailto:sales@acme.ca'));
    expect(calls).toEqual([['event', 'conversion', { send_to: 'AW-123/emailLbl' }]]);
  });

  it('does nothing when that action has no label, even if another action does', async () => {
    const dom = stubDom('');
    await run();
    const calls: unknown[][] = [];
    Object.assign(globalThis.window as object, {
      gtag: (...args: unknown[]) => calls.push(args),
      vitopsAdsConversions: { google: { call: 'AW-123/callLbl' } }, // no `email` entry
    });
    dom.fire('click', clickOn('mailto:sales@acme.ca'));
    expect(calls).toEqual([]);
  });

  it('does nothing when no conversion label is configured — the bootstrap never ran', async () => {
    const dom = stubDom('');
    await run();
    // No `gtag`, no `vitopsAdsConversions` on `window` — the ads tag was never
    // configured, or `site.ads.google` has no `conversionLabel`.
    dom.fire('click', clickOn('mailto:sales@acme.ca'));
    // Nothing to assert on gtag (it doesn't exist); the click must not throw.
  });

  it('does nothing while the tag is still gated and undecided', async () => {
    const dom = stubDom('');
    await run();
    const calls: unknown[][] = [];
    // `vitopsAdsConversions` present with no `gtag` global — the exact state
    // before a gated tag's inline body has run: the bootstrap script that sets
    // both exists on the page as inert `type="text/plain"`, unexecuted.
    Object.assign(globalThis.window as object, {
      vitopsAdsConversions: { google: { call: 'AW-1/L' } },
    });
    dom.fire('click', clickOn('tel:+15551234567'));
    expect(calls).toEqual([]);
  });
});

describe('vitopsFormConversion — the form conversion action', () => {
  function fakeForm(): HTMLFormElement {
    const attrs = new Map<string, string>();
    return {
      hasAttribute: (name: string) => attrs.has(name),
      setAttribute: (name: string, value: string) => void attrs.set(name, value),
    } as unknown as HTMLFormElement;
  }

  it('is exposed on window after the script runs', async () => {
    const dom = stubDom('');
    void dom;
    await run();
    expect(
      typeof (globalThis.window as { vitopsFormConversion?: unknown }).vitopsFormConversion,
    ).toBe('function');
  });

  it('fires gtag(event, conversion, …) with the form action', async () => {
    const dom = stubDom('');
    void dom;
    await run();
    const calls: unknown[][] = [];
    Object.assign(globalThis.window as object, {
      gtag: (...args: unknown[]) => calls.push(args),
      vitopsAdsConversions: { google: { form: 'AW-123/formLbl' } },
    });
    const { vitopsFormConversion } = globalThis.window as unknown as {
      vitopsFormConversion: (form: HTMLFormElement) => void;
    };
    vitopsFormConversion(fakeForm());
    expect(calls).toEqual([['event', 'conversion', { send_to: 'AW-123/formLbl' }]]);
  });

  it('fires once per form element — a second call is a no-op', async () => {
    const dom = stubDom('');
    void dom;
    await run();
    const calls: unknown[][] = [];
    Object.assign(globalThis.window as object, {
      gtag: (...args: unknown[]) => calls.push(args),
      vitopsAdsConversions: { google: { form: 'AW-123/formLbl' } },
    });
    const { vitopsFormConversion } = globalThis.window as unknown as {
      vitopsFormConversion: (form: HTMLFormElement) => void;
    };
    const form = fakeForm();
    vitopsFormConversion(form);
    vitopsFormConversion(form);
    expect(calls).toHaveLength(1);
  });

  it('does nothing when no form label is configured', async () => {
    const dom = stubDom('');
    void dom;
    await run();
    const { vitopsFormConversion } = globalThis.window as unknown as {
      vitopsFormConversion: (form: HTMLFormElement) => void;
    };
    // No gtag, no vitopsAdsConversions — must not throw.
    vitopsFormConversion(fakeForm());
  });
});

describe('call-tracking numbers', () => {
  const phone = {
    number: '613-555-0100',
    sources: { meta: '613-555-0101', 'default-paid': '613-555-0199' },
  };

  it('swaps a matching tel: link — href and text — for a visitor from a Meta ad', async () => {
    const link = fakeLink('613-555-0100', 'tel:+16135550100');
    stubDom('?fbclid=F1', undefined, { phone, links: [link] });
    await run();
    expect(link.attrs.get('href')).toBe('tel:+16135550101');
    expect(link.text.data).toBe('613-555-0101');
    expect(link.attrs.get('data-vitops-phone-source')).toBe('meta');
  });

  it('leaves every number alone for an organic visitor', async () => {
    const link = fakeLink('613-555-0100', 'tel:+16135550100');
    stubDom('', undefined, { phone, links: [link] });
    await run();
    expect(link.attrs.get('href')).toBe('tel:+16135550100');
    expect(link.text.data).toBe('613-555-0100');
  });

  it('leaves a different number alone, and only changes the href of a link with its own label', async () => {
    const other = fakeLink('613-555-0777', 'tel:+16135550777');
    const labelled = fakeLink('Call us', 'tel:613-555-0100');
    stubDom('?fbclid=F1', undefined, { phone, links: [other, labelled] });
    await run();
    expect(other.attrs.get('href')).toBe('tel:+16135550777');
    expect(labelled.attrs.get('href')).toBe('tel:+16135550101');
    expect(labelled.text.data).toBe('Call us');
  });

  it('swaps only the matching run inside a longer sentence', async () => {
    const span = fakeLink('Call 613-555-0100 today or 613-555-0777');
    stubDom('?fbclid=F1', undefined, { phone, spans: [span] });
    await run();
    expect(span.text.data).toBe('Call 613-555-0101 today or 613-555-0777');
  });

  it('stands aside for Google when Google supplies the number', async () => {
    const link = fakeLink('613-555-0100', 'tel:+16135550100');
    stubDom('?gclid=G1', undefined, {
      phone: { ...phone, sources: { ...phone.sources, google: '613-555-0102' } },
      googleNative: true,
      links: [link],
    });
    await run();
    expect(link.attrs.get('href')).toBe('tel:+16135550100');
  });

  it("rewrites the tel: href when Google's tag hands over its forwarding number", async () => {
    const link = fakeLink('613-555-0100', 'tel:+16135550100');
    const dom = stubDom('?gclid=G1', undefined, { links: [link] });
    await run();
    dom.window.vitopsSwapPhone!('(613) 555-0188', '+16135550188', '613-555-0100');
    expect(link.attrs.get('href')).toBe('tel:+16135550188');
    expect(link.text.data).toBe('(613) 555-0188');
  });

  it("replays a swap Google's tag made before this script loaded", async () => {
    const link = fakeLink('613-555-0100', 'tel:+16135550100');
    const dom = stubDom('?gclid=G1', undefined, { links: [link] });
    (globalThis.window as unknown as { vitopsPhoneSwaps: unknown[] }).vitopsPhoneSwaps = [
      ['(613) 555-0188', '+16135550188', '613-555-0100'],
    ];
    await run();
    expect(link.attrs.get('href')).toBe('tel:+16135550188');
    expect(dom.window.vitopsPhoneSwaps).toEqual([]);
  });

  it('shrugs off a malformed marker and keeps the real number', async () => {
    const link = fakeLink('613-555-0100', 'tel:+16135550100');
    stubDom('?fbclid=F1', undefined, { links: [link] });
    const doc = document as unknown as { querySelector: (s: string) => unknown };
    const orig = doc.querySelector;
    doc.querySelector = (sel: string) => {
      const marker = orig(sel) as { getAttribute: (a: string) => string | null } | null;
      return marker
        ? {
            ...marker,
            getAttribute: (a: string) =>
              a === 'data-phone-numbers' ? '{nope' : marker.getAttribute(a),
          }
        : null;
    };
    await run();
    expect(link.attrs.get('href')).toBe('tel:+16135550100');
  });
});
