/**
 * @vitest-environment happy-dom
 *
 * `<wc-gallery>` wiring. Stepping between images is no longer this element's
 * job — it opens the single dialog and re-dispatches the nested `<wc-carousel>`'s
 * own `carousel-change` event; `WCCarousel.dom.test.ts` covers stepping itself.
 * happy-dom does no layout (every `getBoundingClientRect()` is zeroes), so
 * `carousel-change` cannot be driven through a real scroll here either — it is
 * dispatched manually to prove the re-emit wiring.
 *
 * happy-dom implements neither `document.startViewTransition` nor real image
 * decoding, so `#open` always takes its no-transition branch — exactly like a
 * browser that hasn't shipped view transitions yet, a real, supported case.
 *
 * Per-file environment rather than a global one: the other ~800 tests are pure and
 * have no reason to pay for a DOM.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

/** A gallery grid of `count` anchors + the single dialog wrapping their carousel. */
function markup(count: number, wrapAttrs = ''): string {
  const items = Array.from(
    { length: count },
    (_, i) => `
      <li class="gallery__item">
        <a class="gallery__trigger" href="#img-${i}">
          <img class="gallery__thumb" src="t${i}.jpg" alt="" />
        </a>
      </li>`,
  ).join('');
  const slides = Array.from(
    { length: count },
    (_, i) => `
      <li class="carousel__slide" id="img-${i}">
        <figure class="carousel__media"><img src="f${i}.jpg" alt="Image ${i}" /></figure>
      </li>`,
  ).join('');
  return `
    <wc-gallery ${wrapAttrs}>
      <ul class="gallery" role="list">${items}</ul>
      <dialog class="lightbox-dialog" closedby="any" aria-label="Gallery">
        <wc-carousel class="carousel lightbox-dialog__track" role="group" aria-label="Gallery">
          <ul class="carousel__track" role="list" tabindex="0">${slides}</ul>
        </wc-carousel>
        <a class="lightbox-dialog__close" href="#" aria-label="Close">&times;</a>
      </dialog>
    </wc-gallery>`;
}

const gallery = () => document.querySelector('wc-gallery')!;
const dialog = () => document.querySelector<HTMLDialogElement>('dialog.lightbox-dialog')!;
const carousel = () => document.querySelector('wc-carousel')!;
const trigger = (i: number) =>
  document.querySelector<HTMLAnchorElement>(`.gallery__trigger[href="#img-${i}"]`)!;
const close = () => document.querySelector<HTMLAnchorElement>('.lightbox-dialog__close')!;

async function mount(html: string): Promise<void> {
  document.body.innerHTML = html;
  await customElements.whenDefined('wc-gallery');
  await new Promise((r) => requestAnimationFrame(r));
}

beforeAll(async () => {
  // Imported for its side effect (customElements.define), so it must come after
  // happy-dom has installed the globals it closes over. Both — <wc-gallery>'s
  // setup queries for the carousel by class, not by waiting on its upgrade, but
  // the markup here uses the real tag and should register it regardless.
  await import('./WCCarousel.ts');
  await import('./WCGallery.ts');
});

describe('<wc-gallery> opening', () => {
  beforeEach(async () => {
    await mount(markup(3));
  });

  it('intercepts the trigger, opens the single dialog, and fires gallery-open', () => {
    const seen: unknown[] = [];
    gallery().addEventListener('gallery-open', (e) => seen.push((e as CustomEvent).detail));

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    trigger(1).dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(dialog().open).toBe(true);
    expect(seen).toEqual([{ index: 1, total: 3 }]);
  });

  it('opens the same dialog for every trigger — there is only one', () => {
    trigger(0).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(document.querySelectorAll('dialog.lightbox-dialog')).toHaveLength(1);
  });
});

describe('<wc-gallery> closing', () => {
  beforeEach(async () => {
    await mount(markup(3));
    trigger(0).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });

  it('intercepts the close link and calls dialog.close() rather than navigating', () => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    close().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(dialog().open).toBe(false);
  });
});

describe("<wc-gallery> re-emits the carousel's own change event", () => {
  beforeEach(async () => {
    await mount(markup(3));
  });

  it("fires gallery-change with the carousel's detail", () => {
    const seen: unknown[] = [];
    gallery().addEventListener('gallery-change', (e) => seen.push((e as CustomEvent).detail));
    carousel().dispatchEvent(
      new CustomEvent('carousel-change', {
        bubbles: true,
        composed: true,
        detail: { index: 2, total: 3 },
      }),
    );
    expect(seen).toEqual([{ index: 2, total: 3 }]);
  });
});

describe('<wc-gallery> teardown', () => {
  it('stops opening the dialog once disconnected', async () => {
    await mount(markup(3));
    const t = trigger(0);
    const d = dialog();

    gallery().remove();

    t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(d.open).toBe(false);
  });
});

describe('nesting', () => {
  it('an inner instance defers, so a trigger click is only ever intercepted once', async () => {
    // The inner instance defers (it finds an ancestor `<wc-gallery>`), but the
    // OUTER instance's setup still finds the triggers — they're descendants of
    // its subtree regardless of the extra nesting — and wires them once. If
    // both ran, `gallery-open` would fire twice for a single click.
    await mount(
      `<wc-gallery><wc-gallery>${markup(2).replace(/<\/?wc-gallery[^>]*>/g, '')}</wc-gallery></wc-gallery>`,
    );
    const seen: unknown[] = [];
    document
      .querySelectorAll('wc-gallery')
      .forEach((g) =>
        g.addEventListener('gallery-open', (e) => seen.push((e as CustomEvent).detail)),
      );
    trigger(0).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(seen).toHaveLength(1);
  });
});
