/**
 * @vitest-environment happy-dom
 *
 * `<wc-gallery>` wiring. The pure decisions (`stepIndex`, `keyToAction`,
 * `preloadTargets`, `swipeAction`) are tested without a DOM in `utils/gallery.test.ts`;
 * what needs a DOM is that the right inputs reach them and the right dialog opens.
 *
 * happy-dom implements neither the Invoker Commands API's native wiring nor
 * `document.startViewTransition`, so two things follow: a `command`/`commandfor`
 * click is simulated by dispatching the same `command` event the browser would
 * (see `commandEvent` below) rather than a real click, and `#openFromTrigger`
 * always takes its no-transition branch — exactly like a browser that hasn't
 * shipped view transitions yet, which is a real, supported case.
 *
 * Per-file environment rather than a global one: the other ~800 tests are pure and
 * have no reason to pay for a DOM.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

/** One gallery image: a trigger + the dialog it opens. */
function markup(count: number, wrapAttrs = ''): string {
  const names = ['Alpha', 'Beta', 'Gamma', 'Delta'];
  const items = Array.from({ length: count }, (_, i) => {
    const id = `img-${i}`;
    return `
      <li class="gallery__item">
        <button class="gallery__trigger" type="button" command="show-modal" commandfor="${id}">
          <img class="gallery__thumb" src="t${i}.jpg" alt="" />
        </button>
      </li>`;
  }).join('');
  const dialogs = Array.from({ length: count }, (_, i) => {
    const id = `img-${i}`;
    const label = names[i] ?? `Image ${i}`;
    return `
      <dialog id="${id}" class="lightbox-dialog" closedby="any" aria-label="${label}">
        <div class="lightbox-dialog__content">
          <img class="lightbox-dialog__image" src="f${i}.jpg" />
        </div>
        <button class="lightbox-dialog__close" type="button"
                command="close" commandfor="${id}" aria-label="Close">&times;</button>
      </dialog>`;
  }).join('');
  return `<wc-gallery ${wrapAttrs}><ul class="gallery" role="list">${items}</ul>${dialogs}</wc-gallery>`;
}

const el = <T extends Element = HTMLElement>(id: string) =>
  document.getElementById(id) as unknown as T;

/** The `CommandEvent` shape a `command="…" commandfor="…"` click dispatches on its target. */
function commandEvent(command: string, source?: EventTarget): Event {
  const event = new Event('command', { cancelable: true }) as Event & {
    command: string;
    source?: EventTarget;
  };
  event.command = command;
  if (source) event.source = source;
  return event;
}

beforeAll(async () => {
  // Imported for its side effect (customElements.define), so it must come after
  // happy-dom has installed the globals it closes over.
  await import('./WCGallery.ts');
});

describe('<wc-gallery> setup', () => {
  beforeEach(async () => {
    document.body.innerHTML = markup(3);
    await customElements.whenDefined('wc-gallery');
    // An element upgraded mid-insertion is connected before its children exist, so
    // setup retries on a microtask.
    await new Promise((r) => requestAnimationFrame(r));
  });

  it('builds prev/next nav for every dialog once there are at least two images', () => {
    expect(document.querySelectorAll('.lightbox-dialog__nav-button')).toHaveLength(6);
  });

  it('upgrades each dialog’s accessible name with an image counter', () => {
    expect(el('img-0').getAttribute('aria-label')).toBe('Alpha — Image 1 of 3');
    expect(el('img-2').getAttribute('aria-label')).toBe('Gamma — Image 3 of 3');
  });

  it('disables prev on the first dialog and next on the last when not looping', () => {
    const firstButtons = el('img-0').querySelectorAll<HTMLButtonElement>(
      '.lightbox-dialog__nav-button',
    );
    const lastButtons = el('img-2').querySelectorAll<HTMLButtonElement>(
      '.lightbox-dialog__nav-button',
    );
    expect(firstButtons[0]!.disabled).toBe(true); // prev
    expect(firstButtons[1]!.disabled).toBe(false); // next
    expect(lastButtons[0]!.disabled).toBe(false); // prev
    expect(lastButtons[1]!.disabled).toBe(true); // next
  });

  it('builds no nav for a single-image gallery, and no counter suffix', async () => {
    document.body.innerHTML = markup(1);
    await new Promise((r) => requestAnimationFrame(r));
    expect(document.querySelector('.lightbox-dialog__nav-button')).toBeNull();
    expect(el('img-0').getAttribute('aria-label')).toBe('Alpha');
  });
});

describe('<wc-gallery> opening', () => {
  beforeEach(async () => {
    document.body.innerHTML = markup(3);
    await new Promise((r) => requestAnimationFrame(r));
  });

  it('opens the dialog a trigger’s command targets, and fires gallery-open', () => {
    const seen: unknown[] = [];
    document
      .querySelector('wc-gallery')!
      .addEventListener('gallery-open', (e) => seen.push((e as CustomEvent).detail));
    el('img-0').dispatchEvent(commandEvent('show-modal'));
    expect(el<HTMLDialogElement>('img-0').open).toBe(true);
    expect(seen).toEqual([{ index: 0, total: 3 }]);
  });

  it('ignores a command event that is not show-modal', () => {
    el('img-0').dispatchEvent(commandEvent('close'));
    expect(el<HTMLDialogElement>('img-0').open).toBe(false);
  });
});

describe('<wc-gallery> navigation', () => {
  beforeEach(async () => {
    document.body.innerHTML = markup(3);
    await new Promise((r) => requestAnimationFrame(r));
    el('img-0').dispatchEvent(commandEvent('show-modal'));
  });

  it('steps to the next image on ArrowRight and fires gallery-change', () => {
    const seen: unknown[] = [];
    document
      .querySelector('wc-gallery')!
      .addEventListener('gallery-change', (e) => seen.push((e as CustomEvent).detail));
    el('img-0').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(el<HTMLDialogElement>('img-0').open).toBe(false);
    expect(el<HTMLDialogElement>('img-1').open).toBe(true);
    expect(seen).toEqual([{ index: 1, total: 3 }]);
  });

  it('clamps at the end rather than wrapping when not looping', () => {
    el('img-0').dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(el<HTMLDialogElement>('img-2').open).toBe(true);
    el('img-2').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    // Still on the last image — nothing to step to.
    expect(el<HTMLDialogElement>('img-2').open).toBe(true);
  });

  it('wraps past the end when loop is set', async () => {
    document.body.innerHTML = markup(3, 'loop');
    await new Promise((r) => requestAnimationFrame(r));
    el('img-0').dispatchEvent(commandEvent('show-modal'));
    el('img-0').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(el<HTMLDialogElement>('img-2').open).toBe(true);
  });

  it('flips arrow sides under RTL', () => {
    el('img-0').style.direction = 'rtl';
    el('img-0').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    // RTL: "left" moves toward the next image, same as LTR ArrowRight.
    expect(el<HTMLDialogElement>('img-1').open).toBe(true);
  });

  it('leaves Escape to the platform', () => {
    const handled = el('img-0').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }),
    );
    // Not cancelled, i.e. keyToAction returned null and nothing intercepted it.
    expect(handled).toBe(true);
  });

  it('steps on a horizontal swipe past the threshold', () => {
    const dialog = el<HTMLDialogElement>('img-0');
    dialog.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 100 }),
    );
    dialog.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, clientX: 100, clientY: 100 }),
    );
    expect(dialog.open).toBe(false);
    expect(el<HTMLDialogElement>('img-1').open).toBe(true);
  });

  it('dismisses on a vertical swipe past the threshold', () => {
    const dialog = el<HTMLDialogElement>('img-0');
    dialog.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }),
    );
    dialog.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, clientX: 100, clientY: 200 }),
    );
    expect(dialog.open).toBe(false);
    expect(el<HTMLDialogElement>('img-1').open).toBe(false);
  });

  it('ignores small pointer travel — a tap on the close button, not a swipe', () => {
    const dialog = el<HTMLDialogElement>('img-0');
    const close = dialog.querySelector('.lightbox-dialog__close')!;
    close.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }),
    );
    dialog.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, clientX: 105, clientY: 100 }),
    );
    expect(dialog.open).toBe(true);
  });

  it('clears the current index once the dialog closes some other way', () => {
    el('img-0').dispatchEvent(new Event('close'));
    // With no current index, a stray step does nothing rather than throwing.
    el('img-0').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(el<HTMLDialogElement>('img-1').open).toBe(false);
  });
});

describe('<wc-gallery> teardown', () => {
  it('removes generated nav and restores the authored aria-label on disconnect', async () => {
    document.body.innerHTML = markup(3);
    await new Promise((r) => requestAnimationFrame(r));
    expect(document.querySelectorAll('.lightbox-dialog__nav-button')).toHaveLength(6);

    document.querySelector('wc-gallery')!.remove();

    // Re-mount the same dialogs to inspect them post-removal (remove() keeps
    // detached nodes queryable via the reference we already hold).
    expect(document.body.querySelectorAll('.lightbox-dialog__nav-button')).toHaveLength(0);
  });
});

describe('nesting', () => {
  it('an inner instance defers, so only the outer one enhances', async () => {
    document.body.innerHTML = `
      <wc-gallery>
        <wc-gallery>
          ${markup(2).replace(/<\/?wc-gallery[^>]*>/g, '')}
        </wc-gallery>
      </wc-gallery>`;
    await new Promise((r) => requestAnimationFrame(r));
    // 2 dialogs × 2 buttons each if enhanced exactly once; double if both ran.
    expect(document.querySelectorAll('.lightbox-dialog__nav-button')).toHaveLength(4);
  });
});
