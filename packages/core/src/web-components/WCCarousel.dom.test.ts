/**
 * @vitest-environment happy-dom
 *
 * `<wc-carousel>` wiring. The decisions themselves are pure and tested without a
 * DOM in `utils/carousel.test.ts`; what needs a DOM is that the right inputs reach
 * them and the right elements are produced.
 *
 * happy-dom does no layout: `scrollWidth`/`clientWidth` are 0 and every
 * `getBoundingClientRect()` is zeroes. So nothing here asserts a *distance* — the
 * seam jump and the overflow pruning are asserted as decisions in the pure module,
 * with `Object.defineProperty` used where a DOM assertion genuinely needs a size.
 *
 * Per-file environment rather than a global one: the other ~800 tests are pure and
 * have no reason to pay for a DOM.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test';

const SLIDES = ['one', 'two', 'three']
  .map((t, i) => `<li class="carousel__slide" id="slide-${i + 1}">${t}</li>`)
  .join('');

const markup = (attrs = '', classes = 'carousel--scroll-buttons carousel--scroll-markers') => `
  <wc-carousel class="carousel ${classes}" ${attrs}>
    <ul class="carousel__track" role="list">${SLIDES}</ul>
    <p class="carousel__hint" aria-hidden="true">Scroll for more</p>
  </wc-carousel>`;

/** Insert markup and let both the microtask retry and the rAF work run. */
async function mount(html: string): Promise<HTMLElement> {
  document.body.innerHTML = html;
  await customElements.whenDefined('wc-carousel');
  await new Promise((resolve) => requestAnimationFrame(resolve));
  return document.querySelector('wc-carousel') as HTMLElement;
}

const track = (el: HTMLElement) => el.querySelector('.carousel__track') as HTMLElement;

beforeAll(async () => {
  // Imported for its side effect (customElements.define), so it must come after
  // happy-dom has installed the globals it closes over.
  await import('./WCCarousel.ts');
});

describe('<wc-carousel> accessibility defaults', () => {
  it('names itself a group, not a landmark', async () => {
    // `region` is a landmark, so four carousels would grow four entries in every
    // landmark list. <Carousel landmark /> opts back in.
    const el = await mount(markup());
    expect(el.getAttribute('role')).toBe('group');
    expect(el.getAttribute('aria-roledescription')).toBe('carousel');
  });

  it('never overwrites an author-supplied role', async () => {
    const el = await mount(markup('role="region" aria-roledescription="gallery"'));
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-roledescription')).toBe('gallery');
  });

  it('makes the scroller focusable, leaving the list role alone', async () => {
    const el = await mount(markup());
    expect(track(el).tabIndex).toBe(0);
    expect(track(el).getAttribute('role')).toBe('list');
  });
});

describe('<wc-carousel> cloning', () => {
  it('does not clone by default', async () => {
    const el = await mount(markup());
    expect(el.querySelectorAll('[data-carousel-clone]')).toHaveLength(0);
    expect(track(el).children).toHaveLength(3);
  });

  it('clones both ends when asked to loop', async () => {
    const el = await mount(markup('loop'));
    expect(el.querySelectorAll('[data-carousel-clone]')).toHaveLength(6);
    expect(track(el).children).toHaveLength(9);
  });

  it('clones for autoplay without an explicit loop', async () => {
    const el = await mount(markup('autoplay="4000"'));
    expect(el.querySelectorAll('[data-carousel-clone]')).toHaveLength(6);
  });

  it('hides clones from assistive tech and the tab order', async () => {
    const el = await mount(markup('loop'));
    for (const clone of el.querySelectorAll('[data-carousel-clone]')) {
      expect(clone.getAttribute('aria-hidden')).toBe('true');
      expect(clone.hasAttribute('inert')).toBe(true);
    }
  });

  it('strips ids from clones', async () => {
    // Ids are unique. Cloning them put `slide-1` in the document three times — and
    // the dot nav's aria-controls now points at exactly those ids.
    const el = await mount(markup('loop'));
    for (const clone of el.querySelectorAll('[data-carousel-clone]')) {
      expect(clone.id).toBe('');
    }
    expect(document.querySelectorAll('#slide-1')).toHaveLength(1);
  });

  it('demotes every image inside a clone', async () => {
    const el = await mount(`
      <wc-carousel class="carousel" loop>
        <ul class="carousel__track">
          <li><img src="/a.jpg" alt="a" loading="eager" fetchpriority="high"></li>
          <li><img src="/b.jpg" alt="b" loading="lazy"></li>
        </ul>
      </wc-carousel>`);
    const cloned = el.querySelectorAll('[data-carousel-clone] img');
    expect(cloned.length).toBeGreaterThan(0);
    for (const img of cloned) {
      expect(img.getAttribute('loading')).toBe('lazy');
      expect(img.getAttribute('fetchpriority')).toBe('low');
      expect(img.getAttribute('decoding')).toBe('async');
    }
  });
});

describe('<wc-carousel> fallback controls', () => {
  // happy-dom resolves no custom property, so the probe reads empty and the
  // element takes the fallback branch — which is the branch under test.
  it('builds prev/next buttons', async () => {
    const el = await mount(markup());
    expect(el.querySelector('.carousel__button--prev')?.getAttribute('aria-label')).toBe(
      'Previous',
    );
    expect(el.querySelector('.carousel__button--next')?.getAttribute('aria-label')).toBe('Next');
  });

  it('builds one dot per real slide, wired to the slide ids', async () => {
    const el = await mount(markup());
    const markers = [...el.querySelectorAll('.carousel__marker')];
    expect(markers).toHaveLength(3);
    expect(el.querySelector('.carousel__markers')?.getAttribute('role')).toBe('tablist');
    expect(markers.map((m) => m.getAttribute('aria-controls'))).toEqual([
      'slide-1',
      'slide-2',
      'slide-3',
    ]);
    expect(markers[0]?.getAttribute('aria-label')).toBe('Slide 1 of 3');
    // Roving tabindex: the group is one tab stop.
    expect(markers.map((m) => (m as HTMLElement).tabIndex)).toEqual([0, -1, -1]);
  });

  it('flips arrow-key direction under RTL, matching the visual dot order', async () => {
    // `dir="rtl"` does not reach computed `direction` in happy-dom — the
    // inline style does, same pattern WCGallery.dom.test.ts already uses.
    const el = await mount(markup());
    el.style.direction = 'rtl';
    const group = el.querySelector('.carousel__markers') as HTMLElement;
    const markers = [...el.querySelectorAll('.carousel__marker')] as HTMLElement[];

    // In RTL, dot 0 sits at the visual right, so ArrowLeft — visually toward
    // dot 1 — must move the roving tabindex forward, not backward.
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(markers.map((m) => m.tabIndex)).toEqual([-1, 0, -1]);

    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(markers.map((m) => m.tabIndex)).toEqual([0, -1, -1]);
  });

  it('never flips vertical arrows under RTL — direction is a horizontal-axis property', async () => {
    const el = await mount(markup());
    el.style.direction = 'rtl';
    const group = el.querySelector('.carousel__markers') as HTMLElement;
    const markers = [...el.querySelectorAll('.carousel__marker')] as HTMLElement[];

    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(markers.map((m) => m.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('does not add a dot for a clone', async () => {
    const el = await mount(markup('loop'));
    expect(el.querySelectorAll('.carousel__marker')).toHaveLength(3);
  });

  it('builds nothing when the stylesheet says the native branch is live', async () => {
    const el = await mount(markup('style="--carousel-native-nav:1"'));
    expect(el.querySelectorAll('.carousel__button')).toHaveLength(0);
    expect(el.querySelector('.carousel__markers')).toBeNull();
  });

  it('builds only what the modifier classes asked for', async () => {
    const el = await mount(markup('', 'carousel--scroll-buttons'));
    expect(el.querySelectorAll('.carousel__button')).toHaveLength(2);
    expect(el.querySelector('.carousel__markers')).toBeNull();
  });

  it('leaves a single-slide carousel unenhanced', async () => {
    const el = await mount(`
      <wc-carousel class="carousel carousel--scroll-buttons">
        <ul class="carousel__track"><li>only</li></ul>
      </wc-carousel>`);
    expect(el.querySelector('.carousel__button')).toBeNull();
  });
});

describe('<wc-carousel> scroll affordance', () => {
  it('flags the first scroll once, then stops caring', async () => {
    const el = await mount(markup());
    const scroller = track(el);
    expect(el.hasAttribute('data-scrolled')).toBe(false);

    Object.defineProperty(scroller, 'scrollLeft', { value: 200, configurable: true });
    scroller.dispatchEvent(new Event('scroll'));
    expect(el.hasAttribute('data-scrolled')).toBe(true);

    // Scrolling back to the start must not re-offer advice already acted on.
    Object.defineProperty(scroller, 'scrollLeft', { value: 0, configurable: true });
    scroller.dispatchEvent(new Event('scroll'));
    expect(el.hasAttribute('data-scrolled')).toBe(true);
  });

  it('fires on a negative offset, as an RTL scroller reports', async () => {
    const el = await mount(markup());
    const scroller = track(el);
    Object.defineProperty(scroller, 'scrollLeft', { value: -200, configurable: true });
    scroller.dispatchEvent(new Event('scroll'));
    expect(el.hasAttribute('data-scrolled')).toBe(true);
  });

  it('hides the hint when the strip does not overflow', async () => {
    // happy-dom reports 0 for both, so a fresh mount is already the
    // "everything fits" case.
    const el = await mount(markup());
    expect(el.querySelector<HTMLElement>('.carousel__hint')?.hidden).toBe(true);
  });
});

describe('<wc-carousel> autoplay', () => {
  it('builds a play/pause toggle on the shell, not in the track', async () => {
    const el = await mount(markup('autoplay="4000"'));
    const button = el.querySelector<HTMLElement>('.carousel__autoplay');
    expect(button).not.toBeNull();
    expect(button?.parentElement).toBe(el);
    // Playing, so the control offers Pause. The name changes; there is no `aria-pressed` on top of
    // it, which would announce a pressed "Play" button.
    expect(button?.getAttribute('aria-label')).toBe('Pause');
    expect(button?.hasAttribute('aria-pressed')).toBe(false);
  });

  it('adds no toggle without an interval', async () => {
    const el = await mount(markup());
    expect(el.querySelector('.carousel__autoplay')).toBeNull();
  });
});

describe("<wc-carousel> autoplay holds and the visitor's choice", () => {
  const fire = (target: Element, type: string, init: EventInit = {}) =>
    target.dispatchEvent(new Event(type, { bubbles: false, ...init }));
  const button = (el: HTMLElement) => el.querySelector<HTMLElement>('.carousel__autoplay')!;
  /**
   * happy-dom does not implement `:focus-visible`, which decides whether focus counts as keyboard
   * focus. Say what the browser would for the one target under test.
   */
  const focusVisible = (target: Element, visible: boolean) => {
    const real = Element.prototype.matches;
    vi.spyOn(target, 'matches').mockImplementation(function (this: Element, selector: string) {
      return selector === ':focus-visible' ? visible : real.call(this, selector);
    });
  };

  afterEach(() => {
    // Detach the carousel so `disconnectedCallback` clears its pending settle timer. Left
    // connected, the 150ms timer fires after the file's happy-dom globals are torn down and
    // throws `HTMLElement is not defined` as an unhandled error.
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  /** How many steps the timer fires in `ms`, observed through scrolling the track. */
  async function mountPlaying(attrs = 'autoplay="1000"') {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    const el = await mount(markup(attrs));
    const step = vi.spyOn(track(el), 'scrollTo').mockImplementation(() => {});
    const into = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    const ticks = () => step.mock.calls.length + into.mock.calls.length;
    return { el, ticks };
  }

  it('pauses while the pointer is over it and resumes on leave, without touching the button', async () => {
    const { el, ticks } = await mountPlaying();
    fire(el, 'pointerenter');
    const before = ticks();
    vi.advanceTimersByTime(3000);
    expect(ticks()).toBe(before);
    // The visitor has not chosen anything, so the control must not flip under their pointer.
    expect(button(el).getAttribute('aria-label')).toBe('Pause');
    fire(el, 'pointerleave');
    vi.advanceTimersByTime(1000);
    expect(ticks()).toBeGreaterThan(before);
  });

  it('keeps Pause pressed through a pointer leave: only the button resumes it', async () => {
    const { el, ticks } = await mountPlaying();
    fire(el, 'pointerenter');
    button(el).click(); // Pause, with the pointer still inside
    expect(button(el).getAttribute('aria-label')).toBe('Play');
    fire(el, 'pointerleave'); // used to restart autoplay here
    const before = ticks();
    vi.advanceTimersByTime(5000);
    expect(ticks()).toBe(before);
    expect(button(el).getAttribute('aria-label')).toBe('Play');
    // Focus leaving and re-entering does not resume it either.
    focusVisible(el, true);
    fire(el, 'focusin');
    fire(el, 'focusout');
    vi.advanceTimersByTime(5000);
    expect(ticks()).toBe(before);
    // Pressing Play does.
    button(el).click();
    expect(button(el).getAttribute('aria-label')).toBe('Pause');
    vi.advanceTimersByTime(1000);
    expect(ticks()).toBeGreaterThan(before);
  });

  it('does not treat focus moving between two controls inside it as leaving', async () => {
    const { el, ticks } = await mountPlaying();
    focusVisible(el, true);
    fire(el, 'focusin');
    const inside = el.querySelector('.carousel__button') ?? track(el);
    const before = ticks();
    el.dispatchEvent(new FocusEvent('focusout', { relatedTarget: inside }));
    vi.advanceTimersByTime(3000);
    expect(ticks()).toBe(before);
    el.dispatchEvent(new FocusEvent('focusout', { relatedTarget: document.body }));
    vi.advanceTimersByTime(1000);
    expect(ticks()).toBeGreaterThan(before);
  });

  it('does not hold for focus that came from a mouse click', async () => {
    // Clicking Play leaves focus on the button. Holding on that would make Play do nothing until
    // the visitor clicked elsewhere; only keyboard (`:focus-visible`) focus is a reason to wait.
    const { el, ticks } = await mountPlaying();
    focusVisible(el, false);
    const before = ticks();
    fire(el, 'focusin');
    vi.advanceTimersByTime(3000);
    expect(ticks()).toBeGreaterThan(before);
  });

  it('holds while the tab is hidden and resumes when it is shown', async () => {
    const { el, ticks } = await mountPlaying();
    const state = vi.spyOn(document, 'visibilityState', 'get');
    state.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    const before = ticks();
    vi.advanceTimersByTime(4000);
    expect(ticks()).toBe(before);
    state.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(1000);
    expect(ticks()).toBeGreaterThan(before);
    expect(button(el).getAttribute('aria-label')).toBe('Pause');
    state.mockRestore();
  });

  it('stops everything when removed', async () => {
    const { el, ticks } = await mountPlaying();
    el.remove();
    const before = ticks();
    vi.advanceTimersByTime(5000);
    expect(ticks()).toBe(before);
  });
});

describe('<wc-carousel> deprecated single-element form', () => {
  it('promotes bare children into a track', async () => {
    // 5.x markup: `.carousel` IS the scroller. carousel.css still styles that
    // shape for the no-JS case; the element promotes it so every path above is
    // uniform.
    const el = await mount(`
      <wc-carousel class="carousel carousel--scroll-buttons">
        <div>one</div><div>two</div><div>three</div>
      </wc-carousel>`);
    const scroller = el.querySelector('.carousel__track');
    expect(scroller).not.toBeNull();
    expect(scroller?.children).toHaveLength(3);
    expect(el.querySelectorAll('.carousel__button')).toHaveLength(2);
  });
});

describe('<wc-carousel> nested in another <wc-carousel>', () => {
  it('defers to the enclosing element', async () => {
    // <Carousel /> emits its own tag, so `<wc-carousel><Carousel /></wc-carousel>`
    // is an easy guess. Both cloning the same slides would double everything.
    const el = await mount(`
      <wc-carousel class="carousel carousel--scroll-buttons" loop>
        <ul class="carousel__track">
          <li><wc-carousel class="carousel carousel--scroll-buttons" loop>
            <ul class="carousel__track"><li>a</li><li>b</li></ul>
          </wc-carousel></li>
          <li>two</li>
        </ul>
      </wc-carousel>`);
    const inner = el.querySelector('wc-carousel') as HTMLElement;
    expect(inner.querySelectorAll(':scope > .carousel__button')).toHaveLength(0);
    expect(
      inner.querySelectorAll(':scope > .carousel__track > [data-carousel-clone]'),
    ).toHaveLength(0);
  });
});

describe('<wc-carousel> teardown', () => {
  it('removes everything it added', async () => {
    const el = await mount(markup('loop autoplay="4000"'));
    expect(el.querySelectorAll('[data-carousel-clone]').length).toBeGreaterThan(0);
    el.remove();
    expect(el.querySelectorAll('[data-carousel-clone]')).toHaveLength(0);
    expect(el.querySelectorAll('.carousel__button')).toHaveLength(0);
    expect(el.querySelector('.carousel__markers')).toBeNull();
    expect(el.querySelector('.carousel__autoplay')).toBeNull();
    expect(el.hasAttribute('data-scrolled')).toBe(false);
    expect(el.hasAttribute('aria-live')).toBe(false);
  });
});

describe('<wc-carousel> carousel-change', () => {
  // happy-dom does no layout — every `getBoundingClientRect()` is zeroes, so
  // `#currentIndex()`'s nearest-to-centre search always settles on the first
  // slide for every scroll tick here. That still proves the dedup wiring
  // `<wc-gallery>` depends on: a real detail shape, and one dispatch per
  // distinct index rather than one per scroll event.
  it('dedupes repeated scroll ticks that settle on the same index', async () => {
    const el = await mount(markup());
    const seen: unknown[] = [];
    el.addEventListener('carousel-change', (e) => seen.push((e as CustomEvent).detail));
    track(el).dispatchEvent(new Event('scroll'));
    track(el).dispatchEvent(new Event('scroll'));
    // Both ticks resolve to the same index (0, since every rect is zero here),
    // so only the first is a distinct change — the second is a no-op dispatch.
    expect(seen).toEqual([{ index: 0, total: 3 }]);
  });
});
