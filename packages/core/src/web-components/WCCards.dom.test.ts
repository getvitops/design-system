/**
 * @vitest-environment happy-dom
 *
 * `<wc-cards>` wiring. The decision itself is pure and tested without a DOM in
 * `utils/card-click.test.ts`; what needs a DOM is that the right inputs reach it and
 * the right link is followed.
 *
 * Per-file environment rather than a global one: the other ~800 tests are pure and
 * have no reason to pay for a DOM.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const MARKUP = `
  <wc-cards>
    <ul class="subgrid" role="list">
      <li class="card" id="a">
        <p class="font-eyebrow">Service</p>
        <p class="font-heading"><a class="link" id="link-a" href="/a">Alpha</a></p>
        <p id="body-a">Blurb about alpha.</p>
        <button id="btn-a">Save</button>
      </li>
      <li class="card" id="b">
        <p class="font-heading"><a class="link" id="link-b" href="/b">Beta</a></p>
      </li>
    </ul>
  </wc-cards>`;

const el = <T extends Element = HTMLElement>(id: string) =>
  document.getElementById(id) as unknown as T;

/**
 * Press and release over `target`, `moved` pixels apart.
 *
 * Both events are needed: the element measures travel between them, which is how it
 * tells a click from the end of a text drag.
 */
function press(target: Element, opts: { moved?: number; init?: MouseEventInit } = {}): void {
  const { moved = 0, init = {} } = opts;
  target.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }),
  );
  target.dispatchEvent(
    new MouseEvent('click', { bubbles: true, clientX: 100 + moved, clientY: 100, ...init }),
  );
}

beforeAll(async () => {
  // Imported for its side effect (customElements.define), so it must come after
  // happy-dom has installed the globals it closes over.
  await import('./WCCards.ts');
});

describe('<wc-cards>', () => {
  let clicked: string[];

  beforeEach(async () => {
    document.body.innerHTML = MARKUP;
    await customElements.whenDefined('wc-cards');
    // An element upgraded mid-insertion is connected before its children exist, so
    // setup retries on a microtask.
    await new Promise((r) => requestAnimationFrame(r));

    // Record forwarding by spying on the links rather than watching navigation:
    // happy-dom does not navigate, and the contract is "the real link is clicked",
    // which is what carries target/rel/download in a browser.
    clicked = [];
    for (const id of ['link-a', 'link-b'])
      vi.spyOn(el<HTMLAnchorElement>(id), 'click').mockImplementation(() => clicked.push(id));
  });

  it('marks only the cards it governs', () => {
    expect(el('a').hasAttribute('data-card-link')).toBe(true);
    expect(el('b').hasAttribute('data-card-link')).toBe(true);
  });

  it('follows the card link when the card body is clicked', () => {
    press(el('body-a'));
    expect(clicked).toEqual(['link-a']);
  });

  it('follows the right card, not just the first', () => {
    press(el('b'));
    expect(clicked).toEqual(['link-b']);
  });

  it('does not navigate when the pointer dragged — the selection case', () => {
    // The entire reason this element exists rather than `.stretched-link`.
    press(el('body-a'), { moved: 60 });
    expect(clicked).toEqual([]);
  });

  it('leaves a nested button to its own behaviour', () => {
    press(el('btn-a'));
    expect(clicked).toEqual([]);
  });

  it('does not double-handle a click on the card link itself', () => {
    // The real link already navigates; forwarding would fire it twice.
    press(el('link-a'));
    expect(clicked).toEqual([]);
  });

  it('defers to the platform for modifier clicks', () => {
    for (const init of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }])
      press(el('body-a'), { init });
    expect(clicked).toEqual([]);
  });

  it('defers to the platform for a non-primary button', () => {
    press(el('body-a'), { init: { button: 1 } });
    expect(clicked).toEqual([]);
  });

  it('stops governing once disconnected', () => {
    const host = document.querySelector('wc-cards') as HTMLElement;
    const card = el('a');
    host.remove();
    expect(card.hasAttribute('data-card-link')).toBe(false);
  });
});

describe('nesting', () => {
  beforeAll(async () => {
    await import('./WCCards.ts');
  });

  it('an inner instance defers, so one click is forwarded rather than two', async () => {
    document.body.innerHTML = `
      <wc-cards>
        <wc-cards>
          <ul class="subgrid">
            <li class="card" id="n"><p><a id="link-n" href="/n">Nested</a></p></li>
          </ul>
        </wc-cards>
      </wc-cards>`;
    await new Promise((r) => requestAnimationFrame(r));

    const hits: string[] = [];
    vi.spyOn(el<HTMLAnchorElement>('link-n'), 'click').mockImplementation(() => hits.push('n'));
    press(el('n'));
    // Both hosts see the bubbling click; only the outer one governs the card.
    expect(hits).toEqual(['n']);
  });
});
