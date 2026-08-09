import { describe, expect, it } from 'vitest';
import {
  CLONE_MEDIA,
  hasScrolled,
  planCarousel,
  readFeatures,
  realIndex,
  slideLabel,
  twinIndex,
  type CarouselConfig,
  type CarouselFeatures,
} from './carousel.ts';

/**
 * The decisions, tested without a DOM — the point of splitting them out.
 * `WCCarousel.dom.test.ts` covers only that the right inputs reach here and the
 * answers are acted on. happy-dom does no layout, so anything that would depend on
 * a measured size is decided here or not at all.
 */

const config = (over: Partial<CarouselConfig> = {}): CarouselConfig => ({
  loop: false,
  autoplay: 0,
  paged: false,
  wantsButtons: true,
  wantsMarkers: true,
  slides: 3,
  reducedMotion: false,
  ...over,
});

const features = (over: Partial<CarouselFeatures> = {}): CarouselFeatures => ({
  nativeNav: false,
  scrollTimeline: false,
  ...over,
});

describe('planCarousel', () => {
  it('does not clone by default', () => {
    // The behaviour change from 5.x. Cloning triples the DOM and duplicates every
    // image element, and most carousels do not want an infinite strip.
    expect(planCarousel(config(), features()).clone).toBe(false);
  });

  it('clones when asked to loop', () => {
    expect(planCarousel(config({ loop: true }), features()).clone).toBe(true);
  });

  it('clones for autoplay even without `loop`', () => {
    // An autoplaying strip that stops dead at the last slide is worse than one
    // that does not autoplay, so autoplay implies loop.
    expect(planCarousel(config({ autoplay: 4000 }), features()).clone).toBe(true);
  });

  it('never clones in paged mode', () => {
    // Cloning items in a multicol flow adds items, not pages, so the seam never
    // lands on a column boundary and the jump is visible.
    expect(planCarousel(config({ loop: true, paged: true }), features()).clone).toBe(false);
    expect(planCarousel(config({ autoplay: 4000, paged: true }), features()).clone).toBe(false);
  });

  it('never clones fewer than two slides', () => {
    expect(planCarousel(config({ loop: true, slides: 1 }), features()).clone).toBe(false);
    expect(planCarousel(config({ loop: true, slides: 0 }), features()).clone).toBe(false);
  });

  it('suppresses playback under reduced motion but still clones', () => {
    // The visitor can still press play, and the loop must be wired when they do.
    const plan = planCarousel(config({ autoplay: 4000, reducedMotion: true }), features());
    expect(plan.play).toBe(false);
    expect(plan.clone).toBe(true);
  });

  it('plays only when an interval is set', () => {
    expect(planCarousel(config(), features()).play).toBe(false);
    expect(planCarousel(config({ autoplay: 4000 }), features()).play).toBe(true);
  });

  it('builds no controls when the native branch is live', () => {
    // The whole point of the probe: duplicate controls under working native ones
    // is the failure this avoids.
    const plan = planCarousel(config(), features({ nativeNav: true }));
    expect(plan.buildButtons).toBe(false);
    expect(plan.buildMarkers).toBe(false);
  });

  it('builds only the controls the author asked the CSS for', () => {
    const noButtons = planCarousel(config({ wantsButtons: false }), features());
    expect(noButtons.buildButtons).toBe(false);
    expect(noButtons.buildMarkers).toBe(true);

    const noMarkers = planCarousel(config({ wantsMarkers: false }), features());
    expect(noMarkers.buildButtons).toBe(true);
    expect(noMarkers.buildMarkers).toBe(false);
  });

  it('builds no controls for a single slide', () => {
    const plan = planCarousel(config({ slides: 1 }), features());
    expect(plan.buildButtons).toBe(false);
    expect(plan.buildMarkers).toBe(false);
  });

  it('watches scroll only when CSS cannot', () => {
    expect(planCarousel(config(), features()).trackScrolled).toBe(true);
    expect(planCarousel(config(), features({ scrollTimeline: true })).trackScrolled).toBe(false);
  });
});

describe('readFeatures', () => {
  const probe = (values: Record<string, string>) => (name: string) => values[name] ?? '';

  it('reads 1 as on', () => {
    expect(readFeatures(probe({ '--carousel-native-nav': '1' })).nativeNav).toBe(true);
  });

  it('tolerates the whitespace getPropertyValue leaves on', () => {
    expect(readFeatures(probe({ '--carousel-native-nav': ' 1 ' })).nativeNav).toBe(true);
  });

  it('reads 0, empty and absent as off', () => {
    // Absent is the important one: a page that loads elements.js without the
    // framework CSS has no pseudo-elements either, so the fallback is correct.
    expect(readFeatures(probe({ '--carousel-native-nav': '0' })).nativeNav).toBe(false);
    expect(readFeatures(probe({ '--carousel-native-nav': '' })).nativeNav).toBe(false);
    expect(readFeatures(probe({})).nativeNav).toBe(false);
  });

  it('reads the two flags independently', () => {
    const f = readFeatures(
      probe({ '--carousel-native-nav': '1', '--carousel-scroll-timeline': '0' }),
    );
    expect(f).toEqual({ nativeNav: true, scrollTimeline: false });
  });
});

describe('hasScrolled', () => {
  it('ignores a sub-threshold offset', () => {
    // A snap adjustment or a restored position leaves a small offset; treating
    // that as a scroll would dismiss the hint before it was read.
    expect(hasScrolled(0)).toBe(false);
    expect(hasScrolled(3)).toBe(false);
  });

  it('fires past the threshold', () => {
    expect(hasScrolled(5)).toBe(true);
  });

  it('fires on a negative offset', () => {
    // `scrollLeft` is negative in an RTL scroller in every current engine, so a
    // bare `> EPSILON` never fired there and the hint never dismissed.
    expect(hasScrolled(-40)).toBe(true);
  });
});

describe('realIndex / twinIndex', () => {
  it('is the identity when nothing was cloned', () => {
    expect(realIndex(0, 3, false)).toBe(0);
    expect(realIndex(2, 3, false)).toBe(2);
    expect(realIndex(3, 3, false)).toBe(-1);
  });

  it('maps every position in the [clones][real][clones] run', () => {
    // 3 slides → children 0..8: leading clones 0-2, real 3-5, trailing 6-8.
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => realIndex(i, 3, true))).toEqual([
      0, 1, 2, 0, 1, 2, 0, 1, 2,
    ]);
  });

  it('rejects an index outside the run', () => {
    expect(realIndex(-1, 3, true)).toBe(-1);
    expect(realIndex(9, 3, true)).toBe(-1);
    expect(realIndex(0, 0, true)).toBe(-1);
  });

  it('points both wrap points at the real run', () => {
    // The leading clone of slide 0 and the trailing clone of slide 2 are the two
    // seams the silent jump has to cross.
    expect(twinIndex(0, 3)).toBe(3);
    expect(twinIndex(8, 3)).toBe(5);
    expect(twinIndex(4, 3)).toBe(4); // a real slide is its own twin
    expect(twinIndex(99, 3)).toBe(-1);
  });
});

describe('slideLabel', () => {
  it('is one-based and states the total', () => {
    expect(slideLabel(2, 7)).toBe('Slide 3 of 7');
    expect(slideLabel(0, 1)).toBe('Slide 1 of 1');
  });
});

describe('CLONE_MEDIA', () => {
  it('demotes every priority signal', () => {
    // Attribute spellings, not IDL: `fetchPriority` is the property name, so an
    // Object.assign with these keys would silently skip that one.
    expect(CLONE_MEDIA).toEqual({ loading: 'lazy', fetchpriority: 'low', decoding: 'async' });
  });
});
