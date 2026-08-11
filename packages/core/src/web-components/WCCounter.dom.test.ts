/**
 * @vitest-environment happy-dom
 *
 * `<wc-counter>` wiring. The pure decisions (`parseFigure`, `formatterFor`,
 * `easingToken`) are tested without a DOM in `utils/counter.test.ts`; what
 * needs a DOM is that the right presentation span gets built, intersection
 * starts it, and disconnecting mid-animation leaves the fallback intact.
 *
 * happy-dom runs no real CSS engine — no layout, no `@property` animation, and
 * `getComputedStyle` never resolves `--_n` — so a real `IntersectionObserver`
 * never fires either (nothing is ever "visible"). Both are worked around here:
 * `IntersectionObserver` is replaced with a fake that fires on command, and
 * completion is driven by dispatching a synthetic `animationend` rather than
 * a real animation finishing — exactly the `#tick` fallback path `WCCounter`
 * itself takes when `getComputedStyle` returns something non-numeric, which
 * is the only path happy-dom can ever exercise.
 *
 * Per-file environment rather than a global one: the other ~800+ tests are
 * pure and have no reason to pay for a DOM.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  #callback: IntersectionObserverCallback;
  observed = new Set<Element>();

  constructor(callback: IntersectionObserverCallback) {
    this.#callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.add(el);
  }
  unobserve(el: Element): void {
    this.observed.delete(el);
  }
  disconnect(): void {
    this.observed.clear();
  }
  /** Test helper: simulate `el` becoming visible. */
  intersect(el: Element): void {
    this.#callback(
      [{ isIntersecting: true, target: el } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

function stubReducedMotion(matches: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') && matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  }));
}

function markup(text: string, attrs = ''): string {
  return `<wc-counter class="counter" ${attrs}><span class="counter__value">${text}</span></wc-counter>`;
}

const host = () => document.querySelector('wc-counter')!;
const value = () => document.querySelector<HTMLElement>('.counter__value')!;
const presentation = () => document.querySelector<HTMLElement>('.counter__presentation');
// `WCCounter` shares one `IntersectionObserver` for the module's lifetime (see
// its docblock), so — unlike a per-element fake — there is exactly one
// instance for the whole file, created lazily by whichever test runs first.
const singleObserver = () => FakeIntersectionObserver.instances[0]!;

beforeAll(async () => {
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  // Imported for its side effect (customElements.define), so it must come
  // after the IntersectionObserver stub is in place.
  await import('./WCCounter.ts');
});

beforeEach(() => {
  stubReducedMotion(false);
});

describe('<wc-counter> setup', () => {
  it('parses prefix/suffix/decimals/grouping out of the fallback and builds a presentation span', async () => {
    document.body.innerHTML = markup('$1,234.50');
    await new Promise((r) => requestAnimationFrame(r));
    expect(presentation()?.textContent).toBe('$1,234.50');
    expect(presentation()?.getAttribute('aria-hidden')).toBe('true');
  });

  it('sets --counter-from/-to/-duration from data attributes, defaulting from to 0', async () => {
    document.body.innerHTML = markup('94%', 'data-from="10" data-duration="500"');
    await new Promise((r) => requestAnimationFrame(r));
    expect(host().style.getPropertyValue('--counter-from')).toBe('10');
    expect(host().style.getPropertyValue('--counter-to')).toBe('94');
    expect(host().style.getPropertyValue('--counter-duration')).toBe('500ms');
  });

  it('maps a recognised data-easing to its CSS token', async () => {
    document.body.innerHTML = markup('94%', 'data-easing="ease-in"');
    await new Promise((r) => requestAnimationFrame(r));
    expect(host().style.getPropertyValue('--counter-easing')).toBe('var(--custom-ease-in)');
  });

  it('leaves --counter-easing unset for an unrecognised data-easing', async () => {
    document.body.innerHTML = markup('94%', 'data-easing="bounce-house"');
    await new Promise((r) => requestAnimationFrame(r));
    expect(host().style.getPropertyValue('--counter-easing')).toBe('');
  });

  it('registers with the intersection observer exactly once, and builds no presentation span twice', async () => {
    document.body.innerHTML = markup('94%');
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    expect(document.querySelectorAll('.counter__presentation')).toHaveLength(1);
    expect(singleObserver().observed.size).toBe(1);
  });

  describe('reduced motion', () => {
    beforeEach(() => stubReducedMotion(true));

    it('builds no presentation span and registers no observer', async () => {
      document.body.innerHTML = markup('94%');
      await new Promise((r) => requestAnimationFrame(r));
      expect(presentation()).toBeNull();
      expect(singleObserver()?.observed.size ?? 0).toBe(0);
      expect(value().textContent).toBe('94%');
    });
  });
});

describe('<wc-counter> running', () => {
  beforeEach(async () => {
    document.body.innerHTML = markup('94%', 'data-duration="200"');
    await new Promise((r) => requestAnimationFrame(r));
  });

  it('does nothing before intersecting', () => {
    expect(host().hasAttribute('running')).toBe(false);
  });

  it('sets [running] and hides the fallback to sr-only on intersection', () => {
    singleObserver().intersect(host());
    expect(host().hasAttribute('running')).toBe(true);
    expect(value().classList.contains('sr-only')).toBe(true);
    expect(host().getAttribute('aria-live')).toBe('off');
  });

  it('unobserves after the first intersection', () => {
    const obs = singleObserver();
    obs.intersect(host());
    expect(obs.observed.size).toBe(0);
  });

  it('lands exactly on the final formatted value and restores the fallback on completion', () => {
    singleObserver().intersect(host());
    presentation()!.dispatchEvent(new Event('animationend'));
    expect(host().hasAttribute('running')).toBe(false);
    expect(value().classList.contains('sr-only')).toBe(false);
    expect(presentation()!.textContent).toBe('94%');
  });

  it('finishes via the timeout fallback if animationend never fires', async () => {
    vi.useFakeTimers();
    try {
      singleObserver().intersect(host());
      vi.advanceTimersByTime(400);
      expect(host().hasAttribute('running')).toBe(false);
      expect(presentation()!.textContent).toBe('94%');
    } finally {
      vi.useRealTimers();
    }
  });

  it('settles once even if both animationend and the timeout fire', () => {
    vi.useFakeTimers();
    try {
      singleObserver().intersect(host());
      presentation()!.dispatchEvent(new Event('animationend'));
      vi.advanceTimersByTime(400);
      expect(presentation()!.textContent).toBe('94%');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('<wc-counter> teardown', () => {
  it('mid-animation disconnect leaves the fallback as the only thing on screen', async () => {
    document.body.innerHTML = markup('94%');
    await new Promise((r) => requestAnimationFrame(r));
    singleObserver().intersect(host());
    expect(host().hasAttribute('running')).toBe(true);

    host().remove();

    expect(document.body.querySelector('.counter__presentation')).toBeNull();
  });
});

describe('nesting', () => {
  it('an inner instance defers, so only the outer one builds a presentation span', async () => {
    document.body.innerHTML = `
      <wc-counter class="counter">
        <wc-counter class="counter">
          <span class="counter__value">94%</span>
        </wc-counter>
      </wc-counter>`;
    await new Promise((r) => requestAnimationFrame(r));
    expect(document.querySelectorAll('.counter__presentation')).toHaveLength(1);
  });
});
