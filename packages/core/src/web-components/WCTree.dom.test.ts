/**
 * @vitest-environment happy-dom
 *
 * `<wc-tree>`'s DOM wiring, against a real DOM.
 *
 * The filtering *decision* is pure and tested in `utils/tree-filter.test.ts`.
 * What is asserted here is everything that decision cannot reach and that only a
 * DOM can show: that the fallback is left intact, that the toolbar exists only
 * after upgrade, that a match nested in a closed `<details>` is actually opened,
 * that clearing the query restores the open state the visitor had, and that a
 * deep link opens its ancestors — the one behaviour the browser cannot do itself,
 * because a node inside a closed `<details>` has no layout box.
 *
 * Per-file environment rather than a global one: the other ~800 tests are pure
 * and have no reason to pay for a DOM.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * The same tree in both markup shapes the pattern supports:
 *
 *  - **flat**: the item IS the `<details>` (the pattern's original contract);
 *  - **list**: an `<li class="tree__item">` wraps a `<details>`, which is what
 *    `<Tree />` emits so assistive tech gets list position and depth.
 *
 * Every behaviour is asserted against both, because the difference is exactly what
 * silently broke: `#ownText` read `:scope > summary` and the open-on-filter step
 * used `instanceof HTMLDetailsElement` — under the list shape the first made every
 * branch unsearchable by its own label and the second opened nothing at all.
 *
 * Shape: `site` (open) → `analytics` (closed) → `clarityId` leaf, plus `organization`.
 */
const FLAT = `
<wc-tree label="Filter fields">
  <div class="tree tree--lines">
    <details class="tree__item" id="site" open>
      <summary><span class="tree__toggle"></span><span class="tree__label"><code>site</code></span></summary>
      <p class="tree__desc">One published presentation.</p>
      <div class="tree">
        <details class="tree__item" id="site.analytics">
          <summary><span class="tree__toggle"></span><span class="tree__label"><code>analytics</code></span></summary>
          <p class="tree__desc">Provider IDs.</p>
          <div class="tree">
            <div class="tree__item" id="site.analytics.clarityId">
              <span class="tree__content"><span class="tree__label"><code>clarityId</code></span></span>
              <p class="tree__desc">Microsoft Clarity project id.</p>
            </div>
          </div>
        </details>
      </div>
    </details>
    <div class="tree__item" id="organization">
      <span class="tree__content"><span class="tree__label"><code>organization</code></span></span>
      <p class="tree__desc">The company.</p>
    </div>
  </div>
</wc-tree>`;

const LIST = `
<wc-tree label="Filter fields">
  <ul class="tree tree--lines" aria-label="Configuration fields">
    <li class="tree__item" id="site">
      <details open>
        <summary><span class="tree__toggle"></span><span class="tree__label"><code>site</code></span></summary>
        <p class="tree__desc">One published presentation.</p>
        <ul class="tree">
          <li class="tree__item" id="site.analytics">
            <details>
              <summary><span class="tree__toggle"></span><span class="tree__label"><code>analytics</code></span></summary>
              <p class="tree__desc">Provider IDs.</p>
              <ul class="tree">
                <li class="tree__item" id="site.analytics.clarityId">
                  <span class="tree__content"><span class="tree__label"><code>clarityId</code></span></span>
                  <p class="tree__desc">Microsoft Clarity project id.</p>
                </li>
              </ul>
            </details>
          </li>
        </ul>
      </details>
    </li>
    <li class="tree__item" id="organization">
      <span class="tree__content"><span class="tree__label"><code>organization</code></span></span>
      <p class="tree__desc">The company.</p>
    </li>
  </ul>
</wc-tree>`;

const SHAPES = [
  ['flat details', FLAT],
  ['list + details', LIST],
] as const;

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const item = (id: string) => document.getElementById(id) as HTMLElement;
const visible = (id: string) => !item(id).hidden;
/** The `<details>` an item opens with, in either shape. */
const disc = (id: string): HTMLDetailsElement =>
  (item(id) instanceof HTMLDetailsElement
    ? item(id)
    : item(id).querySelector(':scope > details')) as HTMLDetailsElement;

beforeAll(async () => {
  // Imported for its side effect (customElements.define), so it must come after
  // happy-dom has installed the globals it closes over.
  await import('./WCTree.ts');
});

describe.each(SHAPES)('<wc-tree> (%s)', (_shape, MARKUP) => {
  beforeEach(async () => {
    location.hash = '';
    document.body.innerHTML = MARKUP;
    await customElements.whenDefined('wc-tree');
    // An element upgraded mid-insertion is connected before its children exist,
    // so setup retries on a microtask; the hash reveal is rAF-deferred.
    await new Promise((r) => requestAnimationFrame(r));
  });

  const type = (value: string) => {
    const input = $<HTMLInputElement>('.tree__filter');
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const click = (label: string) =>
    [...document.querySelectorAll<HTMLButtonElement>('.tree__toolbar button')]
      .find((b) => b.textContent === label)!
      .click();

  describe('fallback', () => {
    it('leaves the slotted tree untouched', () => {
      // Lit must never render over the light DOM: the tree IS the content.
      expect(document.querySelectorAll('.tree__item')).toHaveLength(4);
      expect(item('site.analytics.clarityId').textContent).toContain('clarityId');
    });

    it('generates the toolbar rather than expecting it in the markup', () => {
      // A search field that does nothing is worse than none, so it cannot be SSR'd.
      expect(MARKUP).not.toContain('tree__toolbar');
      const bar = $('.tree__toolbar');
      expect(bar).toBeTruthy();
      expect(bar.querySelector('input[type="search"]')).toBeTruthy();
      expect([...bar.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
        'Expand all',
        'Collapse all',
      ]);
      // Sibling of the tree, never inside it — it must not inherit `.tree` padding
      // or become a node the filter walks.
      expect(bar.nextElementSibling?.classList.contains('tree')).toBe(true);
      expect($('.tree')?.querySelector('.tree__toolbar')).toBeNull();
    });

    it('announces filter results to assistive tech', () => {
      const status = $('.tree__count');
      expect(status.getAttribute('role')).toBe('status');
      expect(status.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('filtering', () => {
    it('hides non-matching nodes and keeps the ancestor chain', () => {
      type('clarity');
      expect(visible('site.analytics.clarityId')).toBe(true);
      expect(visible('site.analytics')).toBe(true);
      expect(visible('site')).toBe(true);
      expect(visible('organization')).toBe(false);
    });

    /** Reads a BRANCH's own label — the thing `:scope > summary` alone missed. */
    it('matches a branch on its own label and description', () => {
      type('analytics');
      expect(visible('site.analytics')).toBe(true);
      expect(visible('site')).toBe(true);
      // A hit keeps its descendants, so the matched subtree stays explorable.
      expect(visible('site.analytics.clarityId')).toBe(true);
      expect(visible('organization')).toBe(false);

      type('provider');
      expect(visible('site.analytics')).toBe(true);
      expect(visible('organization')).toBe(false);
    });

    it('opens a kept branch, so a match is not hidden inside a collapsed node', () => {
      expect(disc('site.analytics').open).toBe(false);
      type('clarity');
      // Without this the query "finds" a node the visitor cannot see.
      expect(disc('site.analytics').open).toBe(true);
    });

    it('restores the pre-filter open state when cleared', () => {
      expect(disc('site.analytics').open).toBe(false);
      expect(disc('site').open).toBe(true);

      type('clarity');
      expect(disc('site.analytics').open).toBe(true);

      type('');
      // Filtering is a view, not an edit.
      expect(disc('site.analytics').open).toBe(false);
      expect(disc('site').open).toBe(true);
      expect(visible('organization')).toBe(true);
    });

    /**
     * The snapshot must be taken once, on entering the filtering state. Taken every
     * keystroke, the second one records the open state the first forced, and
     * "restore" restores a filtered view instead of the original.
     */
    it('survives several keystrokes before clearing', () => {
      for (const q of ['c', 'cl', 'cla', 'clar']) type(q);
      expect(disc('site.analytics').open).toBe(true);
      type('');
      expect(disc('site.analytics').open).toBe(false);
    });

    it('reports the match count', () => {
      type('clarity');
      expect($('.tree__count').textContent).toBe('1 match');
      // `id` hits `analytics` ("Provider IDs.") and `clarityId` (label + desc).
      type('id');
      expect($('.tree__count').textContent).toBe('2 matches');
      type('');
      expect($('.tree__count').textContent).toBe('');
    });

    it('emits tree-filter', () => {
      const seen: { query: string; matches: number }[] = [];
      $('wc-tree').addEventListener('tree-filter', (e) => seen.push((e as CustomEvent).detail));
      type('clarity');
      expect(seen).toEqual([{ query: 'clarity', matches: 1 }]);
    });
  });

  describe('bulk toggle', () => {
    it('expands and collapses every details', () => {
      click('Expand all');
      for (const d of document.querySelectorAll('details')) expect(d.open).toBe(true);
      click('Collapse all');
      for (const d of document.querySelectorAll('details')) expect(d.open).toBe(false);
    });
  });

  describe('deep linking', () => {
    /**
     * The reason this element does hash handling at all: a `<details>` inside a
     * closed `<details>` is not rendered, so the browser's own fragment navigation
     * finds no box and silently stays where it was.
     */
    it('opens the ancestors of a hash target', () => {
      disc('site').open = false;
      disc('site.analytics').open = false;

      location.hash = '#site.analytics.clarityId';
      window.dispatchEvent(new Event('hashchange'));

      expect(disc('site').open).toBe(true);
      expect(disc('site.analytics').open).toBe(true);
    });

    /** Ids are dotted config paths, which are not valid CSS selectors. */
    it('resolves a dotted id without treating it as a selector', () => {
      location.hash = '#site.analytics';
      window.dispatchEvent(new Event('hashchange'));
      expect(disc('site.analytics').open).toBe(true);
    });

    it('ignores a hash that is not in this tree', () => {
      expect(() => {
        location.hash = '#not-a-node';
        window.dispatchEvent(new Event('hashchange'));
      }).not.toThrow();
    });
  });
});

/**
 * `<Tree />` emits its own `<wc-tree>`, so `<wc-tree><Tree /></wc-tree>` — the
 * composition a reader reasonably guesses, and the one the repo's own author
 * reached for — nests two elements. Both `querySelector('.tree')` calls resolve to
 * the SAME tree, so before this each built a toolbar and two filters fought over
 * one set of nodes, with nothing logged.
 */
describe('<wc-tree> nested in another <wc-tree>', () => {
  beforeEach(async () => {
    location.hash = '';
    document.body.innerHTML = `
      <wc-tree label="outer">
        <wc-tree label="inner">
          <ul class="tree tree--lines">
            <li class="tree__item" id="a">
              <span class="tree__content"><span class="tree__label">alpha</span></span>
            </li>
          </ul>
        </wc-tree>
      </wc-tree>`;
    await customElements.whenDefined('wc-tree');
    await new Promise((r) => requestAnimationFrame(r));
  });

  it('builds exactly one toolbar', () => {
    expect(document.querySelectorAll('.tree__toolbar')).toHaveLength(1);
    expect(document.querySelectorAll('.tree__filter')).toHaveLength(1);
  });

  it('gives the toolbar to the innermost element, not the outer one', () => {
    const inner = document.querySelectorAll('wc-tree')[1]!;
    // `:scope >` so the outer's descendant toolbar doesn't count as its own.
    expect(inner.querySelector(':scope > .tree__toolbar')).toBeTruthy();
  });

  it('still filters correctly through the one live element', () => {
    const input = document.querySelector<HTMLInputElement>('.tree__filter')!;
    input.value = 'alpha';
    input.dispatchEvent(new Event('input'));
    expect(document.querySelector('.tree__count')!.textContent).toBe('1 match');
    expect((document.getElementById('a') as HTMLElement).hidden).toBe(false);
  });
});
