/**
 * @vitest-environment happy-dom
 *
 * `<wc-tree>`'s DOM wiring, against a real DOM.
 *
 * The filtering *decision* is pure and tested in `utils/tree-filter.test.ts`;
 * the keyboard-navigation and type-ahead *decisions* are pure and tested in
 * `utils/tree-nav.test.ts` and `utils/keynav.test.ts`. What is asserted here is
 * everything those decisions cannot reach and that only a DOM can show: that
 * every branch's `<details>`/`<summary>` is unwrapped on upgrade with no content
 * lost, that the WAI-ARIA tree roles land correctly in both markup shapes, that
 * a real keypress moves the roving tabindex the way the pure decision says it
 * should, that a match nested in a closed branch is actually opened, that
 * clearing the query restores the open state the visitor had, that a
 * `beforematch` reveal is mirrored onto `aria-expanded` without racing the
 * browser's own `hidden` removal, and that a deep link opens its ancestors.
 *
 * Per-file environment rather than a global one: the other ~800 tests are pure
 * and have no reason to pay for a DOM.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * The same tree in both no-JS markup shapes the pattern supports:
 *
 *  - **flat**: the item IS the `<details>` (the pattern's original contract);
 *  - **list**: an `<li class="tree__item">` wraps a `<details>`, which is what
 *    `<Tree />` emits so assistive tech gets list position and depth.
 *
 * `<wc-tree>` unwraps both to the SAME structure on upgrade, so every
 * behaviour below is asserted against both — the point is that they converge.
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
/** The group an item owns post-transform — both shapes converge to this. */
const group = (id: string): HTMLElement => item(id).querySelector(':scope > .tree') as HTMLElement;
const expanded = (id: string): string | null => item(id).getAttribute('aria-expanded');
/** The item currently holding the roving tabindex. */
const activeId = (): string | undefined =>
  [...document.querySelectorAll<HTMLElement>('.tree__item')].find((el) => el.tabIndex === 0)?.id;

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
  const press = (key: string) =>
    $('.tree').dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );

  describe('transform', () => {
    it("unwraps every branch's <details>/<summary>, leaving none in the DOM", () => {
      expect(document.querySelectorAll('details')).toHaveLength(0);
      expect(document.querySelectorAll('summary')).toHaveLength(0);
    });

    it('preserves every item and its text content', () => {
      expect(document.querySelectorAll('.tree__item')).toHaveLength(4);
      expect(item('site').textContent).toContain('site');
      expect(item('site.analytics').textContent).toContain('analytics');
      expect(item('site.analytics.clarityId').textContent).toContain('clarityId');
      expect(item('organization').textContent).toContain('organization');
    });

    it('sets WAI-ARIA tree roles: tree on the root, treeitem on every item, group on every nested list', () => {
      expect($('.tree').getAttribute('role')).toBe('tree');
      for (const id of ['site', 'site.analytics', 'site.analytics.clarityId', 'organization']) {
        expect(item(id).getAttribute('role')).toBe('treeitem');
      }
      expect(group('site').getAttribute('role')).toBe('group');
      expect(group('site.analytics').getAttribute('role')).toBe('group');
    });

    it('gives the root an accessible name, falling back to the filter label', () => {
      // FLAT has no ariaLabel prop; LIST's fixture sets one directly, mirroring
      // what `<Tree ariaLabel="…" />` would render.
      expect($('.tree').getAttribute('aria-label')).toBeTruthy();
    });

    it('sets aria-expanded on branches only, mirroring the original open state', () => {
      expect(expanded('site')).toBe('true'); // was <details open>
      expect(expanded('site.analytics')).toBe('false'); // was closed
      expect(item('organization').hasAttribute('aria-expanded')).toBe(false); // leaf
      expect(item('site.analytics.clarityId').hasAttribute('aria-expanded')).toBe(false); // leaf
    });

    it('toggles the nested group\'s hidden state to match: none when open, "until-found" when collapsed', () => {
      expect(group('site').hasAttribute('hidden')).toBe(false);
      expect(group('site.analytics').getAttribute('hidden')).toBe('until-found');
    });

    it('builds one .tree__summary per branch and none for a leaf', () => {
      expect(document.querySelectorAll('.tree__summary')).toHaveLength(2);
      expect(item('organization').querySelector(':scope > .tree__summary')).toBeNull();
      expect(item('organization').querySelector(':scope > .tree__content')).toBeTruthy();
    });

    it('gives exactly one item the roving tabindex, and it is the first visible node', () => {
      const items = [...document.querySelectorAll<HTMLElement>('.tree__item')];
      expect(items.filter((el) => el.tabIndex === 0)).toHaveLength(1);
      expect(activeId()).toBe('site');
    });

    it('is idempotent: a second #setup() run over already-transformed markup does not disturb it', () => {
      // Simulates the one realistic disconnect→reconnect-same-nodes path (a
      // consumer manually re-appending this element's subtree) without
      // needing a live DOM move: disconnect, then reconnect.
      const el = $('wc-tree');
      const parent = el.parentElement!;
      parent.removeChild(el);
      parent.appendChild(el);
      expect(document.querySelectorAll('details')).toHaveLength(0);
      expect(expanded('site')).toBe('true');
      expect(expanded('site.analytics')).toBe('false');
    });
  });

  describe('keyboard navigation', () => {
    it("Down moves to the next visible node, skipping a collapsed branch's children", () => {
      press('ArrowDown');
      expect(activeId()).toBe('site.analytics');
      press('ArrowDown');
      expect(activeId()).toBe('organization');
    });

    it('Up moves to the previous visible node', () => {
      press('ArrowDown');
      press('ArrowDown');
      press('ArrowUp');
      expect(activeId()).toBe('site.analytics');
    });

    it('does not move past the first or last visible node', () => {
      press('ArrowUp');
      expect(activeId()).toBe('site');
      press('ArrowDown');
      press('ArrowDown');
      press('ArrowDown');
      expect(activeId()).toBe('organization');
    });

    it('Right opens a closed branch without moving, then steps into it on a second press', () => {
      press('ArrowDown'); // -> site.analytics (closed)
      press('ArrowRight');
      expect(expanded('site.analytics')).toBe('true');
      expect(activeId()).toBe('site.analytics'); // did not move on the open
      press('ArrowRight');
      expect(activeId()).toBe('site.analytics.clarityId');
    });

    it('Right on an already-open branch steps directly into its first child', () => {
      press('ArrowRight'); // site starts open
      expect(activeId()).toBe('site.analytics');
    });

    it('Right does nothing on a leaf', () => {
      press('ArrowDown');
      press('ArrowDown'); // -> organization
      press('ArrowRight');
      expect(activeId()).toBe('organization');
    });

    it('Left collapses an open branch without moving, then does nothing at the root once closed', () => {
      press('ArrowLeft'); // site starts open
      expect(expanded('site')).toBe('false');
      expect(activeId()).toBe('site');
      press('ArrowLeft'); // closed, at the root — nowhere to go
      expect(activeId()).toBe('site');
    });

    it('Left steps to the parent from a leaf', () => {
      press('ArrowRight'); // site -> site.analytics (open branch, steps in)
      press('ArrowRight'); // closed -> expand, stays
      press('ArrowRight'); // now open -> clarityId
      expect(activeId()).toBe('site.analytics.clarityId');
      press('ArrowLeft');
      expect(activeId()).toBe('site.analytics');
    });

    it('Home/End jump to the first/last visible node in depth-first order', () => {
      press('ArrowDown');
      press('End');
      expect(activeId()).toBe('organization');
      press('Home');
      expect(activeId()).toBe('site');
    });

    it('Enter and Space both toggle a branch', () => {
      press('Enter');
      expect(expanded('site')).toBe('false');
      press(' ');
      expect(expanded('site')).toBe('true');
    });

    it("Space activates a leaf's link instead of doing nothing", () => {
      item('organization').querySelector(':scope > .tree__content')!.innerHTML +=
        '<a href="#organization-link">go</a>';
      const link = item('organization').querySelector('a')!;
      let clicked = false;
      link.addEventListener('click', () => (clicked = true));
      press('ArrowDown');
      press('ArrowDown'); // -> organization
      press(' ');
      expect(clicked).toBe(true);
    });

    it('type-ahead jumps to the next visible node whose label starts with the typed character', () => {
      press('o');
      expect(activeId()).toBe('organization');
    });

    it('type-ahead skips a node hidden inside a collapsed branch', () => {
      // "c" would match "clarityId", but it's inside the closed site.analytics
      // branch and must not be reachable until that branch is open.
      press('c');
      expect(activeId()).not.toBe('site.analytics.clarityId');
    });

    it('flips Left/Right under rtl — Right becomes "collapse/climb out", Left becomes "expand/descend"', () => {
      $('.tree').style.direction = 'rtl';
      press('ArrowLeft'); // site starts open — in RTL this descends
      expect(activeId()).toBe('site.analytics');
    });

    it('relocates the roving tabindex off a node the filter just hid', () => {
      press('ArrowDown');
      press('ArrowDown'); // -> organization
      expect(activeId()).toBe('organization');

      type('clarity'); // organization does not match — gets hidden

      expect(visible('organization')).toBe(false);
      const stops = [...document.querySelectorAll<HTMLElement>('.tree__item')].filter(
        (el) => el.tabIndex === 0,
      );
      expect(stops).toHaveLength(1);
      expect(stops[0]?.hidden).toBe(false);
      expect(activeId()).not.toBe('organization');
    });
  });

  describe('click', () => {
    it('toggles a branch, replacing native summary-click-toggles-details', () => {
      const summary = item('site').querySelector('.tree__summary') as HTMLElement;
      expect(expanded('site')).toBe('true');
      summary.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(expanded('site')).toBe('false');
      expect(group('site').getAttribute('hidden')).toBe('until-found');
    });

    it('does not toggle when the click originates from a .tree__actions descendant', () => {
      const summary = item('site').querySelector('.tree__summary') as HTMLElement;
      const actions = document.createElement('span');
      actions.className = 'tree__actions';
      const button = document.createElement('button');
      actions.appendChild(button);
      summary.appendChild(actions);

      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(expanded('site')).toBe('true'); // unchanged
    });
  });

  describe('beforematch (find-in-page / fragment-nav reveal)', () => {
    it('mirrors a UA-driven reveal onto aria-expanded without writing hidden itself', () => {
      const g = group('site.analytics');
      expect(g.getAttribute('hidden')).toBe('until-found');
      expect(expanded('site.analytics')).toBe('false');

      // Simulates the event half of what the browser's reveal algorithm
      // delivers to page script; it removes `hidden` itself, separately.
      g.dispatchEvent(new Event('beforematch', { bubbles: true }));

      expect(expanded('site.analytics')).toBe('true');
    });

    it("never fires from a script-driven change — only the UA's own reveal fires it", () => {
      let fired = false;
      $('.tree').addEventListener('beforematch', () => {
        fired = true;
      });
      click('Expand all');
      expect(fired).toBe(false);
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

    /** Reads a BRANCH's own label — the thing a three-selector row query alone missed. */
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
      expect(expanded('site.analytics')).toBe('false');
      type('clarity');
      // Without this the query "finds" a node the visitor cannot see.
      expect(expanded('site.analytics')).toBe('true');
      expect(group('site.analytics').hasAttribute('hidden')).toBe(false);
    });

    it('restores the pre-filter open state when cleared', () => {
      expect(expanded('site.analytics')).toBe('false');
      expect(expanded('site')).toBe('true');

      type('clarity');
      expect(expanded('site.analytics')).toBe('true');

      type('');
      // Filtering is a view, not an edit.
      expect(expanded('site.analytics')).toBe('false');
      expect(expanded('site')).toBe('true');
      expect(visible('organization')).toBe(true);
    });

    /**
     * The snapshot must be taken once, on entering the filtering state. Taken every
     * keystroke, the second one records the open state the first forced, and
     * "restore" restores a filtered view instead of the original.
     */
    it('survives several keystrokes before clearing', () => {
      for (const q of ['c', 'cl', 'cla', 'clar']) type(q);
      expect(expanded('site.analytics')).toBe('true');
      type('');
      expect(expanded('site.analytics')).toBe('false');
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

    it('keeps its own hidden channel independent of expansion\'s "until-found" channel', () => {
      type('clarity');
      // Filtered-out item: plain boolean hidden.
      expect(item('organization').getAttribute('hidden')).not.toBe('until-found');
      expect(item('organization').hidden).toBe(true);
      // Force-opened-by-filter branch: its GROUP has no hidden attribute at all.
      expect(group('site.analytics').hasAttribute('hidden')).toBe(false);
    });
  });

  describe('bulk toggle', () => {
    it('expands and collapses every branch', () => {
      click('Expand all');
      expect(expanded('site')).toBe('true');
      expect(expanded('site.analytics')).toBe('true');
      click('Collapse all');
      expect(expanded('site')).toBe('false');
      expect(expanded('site.analytics')).toBe('false');
    });

    it('does not silently no-op now that there are zero <details> left to iterate', () => {
      // Guards the vacuous-pass failure mode: the old assertion iterated
      // `document.querySelectorAll('details')`, which is empty post-transform,
      // so a broken "Expand all" would have passed silently forever.
      expect(document.querySelectorAll('details')).toHaveLength(0);
      click('Expand all');
      expect(expanded('site.analytics')).toBe('true');
    });
  });

  describe('deep linking', () => {
    /**
     * The reason this element does hash handling at all: the transform runs
     * asynchronously relative to the browser's own parse-time fragment reveal,
     * so even with `hidden="until-found"` making that reveal reliable across
     * engines, it cannot be relied on to have already run by the time this
     * upgrades.
     */
    it('opens the ancestors of a hash target', () => {
      click('Collapse all');
      expect(expanded('site')).toBe('false');
      expect(expanded('site.analytics')).toBe('false');

      location.hash = '#site.analytics.clarityId';
      window.dispatchEvent(new Event('hashchange'));

      expect(expanded('site')).toBe('true');
      expect(expanded('site.analytics')).toBe('true');
    });

    /** Ids are dotted config paths, which are not valid CSS selectors. */
    it('resolves a dotted id without treating it as a selector', () => {
      location.hash = '#site.analytics';
      window.dispatchEvent(new Event('hashchange'));
      expect(expanded('site.analytics')).toBe('true');
    });

    it('ignores a hash that is not in this tree', () => {
      expect(() => {
        location.hash = '#not-a-node';
        window.dispatchEvent(new Event('hashchange'));
      }).not.toThrow();
    });

    it('moves the roving tabindex to the revealed target', () => {
      location.hash = '#site.analytics.clarityId';
      window.dispatchEvent(new Event('hashchange'));
      expect(activeId()).toBe('site.analytics.clarityId');
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
