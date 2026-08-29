/**
 * @vitest-environment happy-dom
 *
 * `<wc-marquee>` wiring. happy-dom has no layout engine, so every geometry read
 * (`getBoundingClientRect`, `getComputedStyle().columnGap`/`rowGap`/`flexDirection`)
 * is stubbed rather than produced by real layout, and `ResizeObserver` is replaced
 * with a stub that hands back its callback so a resize can be simulated by invoking
 * it directly instead of waiting on layout that will never happen.
 *
 * `<wc-marquee>` upgrades and measures SYNCHRONOUSLY inside the `innerHTML`
 * assignment that creates it — before `mount()` even returns — so the geometry
 * has to be stubbed at the prototype level, keyed off which element is asking,
 * rather than spied on a specific instance after the fact (the instance doesn't
 * exist yet when a test would want to set that up).
 *
 * Per-file environment rather than a global one: the other ~800 tests are pure and
 * have no reason to pay for a DOM.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type ROCallback = () => void;

let observers: ROCallback[] = [];

class StubResizeObserver {
  #callback: ROCallback;
  constructor(callback: ROCallback) {
    this.#callback = callback;
  }
  observe() {
    observers.push(this.#callback);
  }
  disconnect() {
    observers = observers.filter((cb) => cb !== this.#callback);
  }
  unobserve() {}
}

/** Fire every registered observer as if everything it watches just resized. */
function triggerResize() {
  for (const callback of observers.slice()) callback();
}

type Geometry = {
  hostWidth: number;
  hostHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  gap: number;
  vertical: boolean;
};

let geometry: Geometry = {
  hostWidth: 1000,
  hostHeight: 1000,
  sourceWidth: 100,
  sourceHeight: 100,
  gap: 10,
  vertical: false,
};

/** Geometry a real layout engine would produce; happy-dom always reads zero. */
function stubGeometry(opts: Partial<Geometry>) {
  geometry = { ...geometry, ...opts };
}

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', StubResizeObserver);

  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const rect =
      this.tagName === 'WC-MARQUEE'
        ? { width: geometry.hostWidth, height: geometry.hostHeight }
        : { width: geometry.sourceWidth, height: geometry.sourceHeight };
    return rect as DOMRect;
  });

  const realGetComputedStyle = getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el, ...rest) => {
    if ((el as Element).tagName !== 'WC-MARQUEE') return realGetComputedStyle(el, ...rest);
    return {
      flexDirection: geometry.vertical ? 'column' : 'row',
      columnGap: `${geometry.gap}px`,
      rowGap: `${geometry.gap}px`,
    } as CSSStyleDeclaration;
  });

  // Side-effectful import: must run after happy-dom installs its globals, and
  // after the geometry stubs above so its module-scope `new ResizeObserver`
  // call (there is none at import time, but connectedCallback runs on the
  // first element created afterward) sees the stub.
  await import('./WCMarquee.ts');
});

beforeEach(() => {
  observers = [];
  geometry = {
    hostWidth: 1000,
    hostHeight: 1000,
    sourceWidth: 100,
    sourceHeight: 100,
    gap: 10,
    vertical: false,
  };
});

afterEach(() => {
  document.body.innerHTML = '';
});

async function mount(html: string): Promise<HTMLElement> {
  document.body.innerHTML = html;
  await new Promise((r) => requestAnimationFrame(r));
  return document.body.firstElementChild as HTMLElement;
}

describe('<wc-marquee>', () => {
  it('adopts an authored extra .marquee__content as a clone, keeping one source', async () => {
    const el = await mount(
      '<wc-marquee><div class="marquee__content"><span>a</span></div>' +
        '<div class="marquee__content" aria-hidden="true"><span>a</span></div></wc-marquee>',
    );
    // Exactly one non-clone track survives as the source; every other
    // `.marquee__content` — authored or generated — carries the clone marker.
    const tracks = el.querySelectorAll('.marquee__content');
    const nonClones = [...tracks].filter((t) => !('marqueeClone' in (t as HTMLElement).dataset));
    expect(nonClones).toHaveLength(1);
  });

  it('sizes --_marquee-distance and clone count from the measured source', async () => {
    // host 1000, source 100, gap 10 -> need = ceil((1000+10)/110)+1 = 11
    stubGeometry({ hostWidth: 1000, sourceWidth: 100, gap: 10 });
    const el = await mount(
      '<wc-marquee><div class="marquee__content"><span>a</span></div></wc-marquee>',
    );
    expect(el.style.getPropertyValue('--_marquee-distance')).toBe('110px');
    expect(el.querySelectorAll('[data-marquee-clone]')).toHaveLength(11);
  });

  it('re-measures when the source itself resizes, not just the host', async () => {
    stubGeometry({ hostWidth: 1000, sourceWidth: 100, gap: 10 });
    const el = await mount(
      '<wc-marquee><div class="marquee__content"><span>a</span></div></wc-marquee>',
    );
    expect(el.style.getPropertyValue('--_marquee-distance')).toBe('110px');

    // Content grew (e.g. an image finished loading) with no host resize at all.
    stubGeometry({ sourceWidth: 400 });
    triggerResize();
    expect(el.style.getPropertyValue('--_marquee-distance')).toBe('410px');
  });

  it('reads the block axis on a vertical host', async () => {
    stubGeometry({ hostHeight: 500, sourceHeight: 50, gap: 5, vertical: true });
    const el = await mount(
      '<wc-marquee><div class="marquee__content"><span>a</span></div></wc-marquee>',
    );
    // need = ceil((500+5)/55)+1 = 11
    expect(el.style.getPropertyValue('--_marquee-distance')).toBe('55px');
    expect(el.querySelectorAll('[data-marquee-clone]')).toHaveLength(11);
  });

  it('does no work on a resize that changed nothing measured', async () => {
    stubGeometry({ hostWidth: 1000, sourceWidth: 100, gap: 10 });
    const el = await mount(
      '<wc-marquee><div class="marquee__content"><span>a</span></div></wc-marquee>',
    );
    const before = [...el.querySelectorAll('[data-marquee-clone]')];
    triggerResize();
    const after = [...el.querySelectorAll('[data-marquee-clone]')];
    // Same nodes, not merely the same count — a no-op resize must not
    // remove-and-recreate the clones.
    expect(after).toEqual(before);
  });
});
