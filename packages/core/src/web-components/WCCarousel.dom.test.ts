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
import { beforeAll, describe, expect, it } from 'vitest';

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
    expect(button?.getAttribute('aria-pressed')).toBe('true');
  });

  it('adds no toggle without an interval', async () => {
    const el = await mount(markup());
    expect(el.querySelector('.carousel__autoplay')).toBeNull();
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
