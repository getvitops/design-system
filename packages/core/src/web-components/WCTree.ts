import { noChange } from 'lit';
import { BaseElement } from './BaseElement.js';
import { matchTree } from './utils/tree-filter.js';
import {
  resolveTreeMove,
  siblingsOf,
  type TreeDirection,
  type TreeNavNode,
} from './utils/tree-nav.js';
import { RovingTabindex, type RovingContext, type RovingMove } from './utils/RovingTabindex.js';
import { initFromLightDom } from './utils/upgrade.js';

/** A node this element has parsed out of the DOM. Static fields only — `hidden`
 * and `expanded` are read live off the element itself wherever they're needed
 * (`#snapshot`), never cached, since they change on every filter keystroke and
 * every expand/collapse. */
interface StaticNode {
  key: HTMLElement;
  parent: HTMLElement | null;
  /** Row + description, lowercased — what `filter()` searches. */
  own: string;
  /** Row only, lowercased — what type-ahead searches. */
  label: string;
}

/** `Element.moveBefore` isn't in every DOM lib yet. Preferred over `insertBefore`
 * for a node that may already be connected and carrying state (a nested custom
 * element, an `<iframe>`, an in-flight transition) — `moveBefore` runs
 * `connectedMoveCallback` instead of a disconnect/reconnect pair. Falls back to
 * `insertBefore` where unsupported (Safari, at time of writing). Requires the
 * destination to already be connected. */
function moveNode(to: Element, node: Node, before: Node | null): void {
  const capable = to as unknown as { moveBefore?: (node: Node, before: Node | null) => void };
  if (typeof capable.moveBefore === 'function') capable.moveBefore(node, before);
  else to.insertBefore(node, before);
}

/** Move every child of `from` into `to`, in order, ahead of `before`. Consumes
 * `from.firstChild` each pass rather than snapshotting `from.childNodes` into
 * an array first — `childNodes` is LIVE, and each `moveNode` call below
 * removes the node from `from`, so re-reading `firstChild` is what makes this
 * safe without an array to iterate a moving target. */
function moveAllChildren(from: Element, to: Element, before: Node | null): void {
  while (from.firstChild) moveNode(to, from.firstChild, before);
}

/**
 * Progressive enhancement for the `.tree` pattern — WAI-ARIA tree semantics,
 * roving-tabindex keyboard navigation, filter, bulk expand/collapse and hash
 * deep-linking over a nested `<details>` disclosure tree.
 *
 * **The slotted markup is the fallback, and it is untouched.** With no JS,
 * `.tree` + `.tree__item` renders as native nested `<details>`: every node is
 * readable, expand/collapse works by clicking, Tab-and-Enter reaches every
 * summary, and an `#id` deep-links (imperfectly — see `#revealHash`). Nothing
 * here changes that markup at parse time; `Tree.astro`/`TreeNode.astro` emit
 * exactly the same thing whether or not this element ever upgrades.
 *
 * **On upgrade, every branch's `<details>`/`<summary>` is unwrapped**, not
 * merely decorated with ARIA attributes. An earlier design tried the overlay —
 * leave the DOM alone, add `role`/`aria-*` on top — and it worked, but its own
 * honest cost list settled the question: `<summary>` stays focusable, so
 * `role="none"` on it is discarded by presentational-role conflict resolution,
 * leaving a permanent duplicate `role="button"` node inside every branch; the
 * two supported markup shapes need two different attribute-placement code
 * paths; and whether a browser's accessibility tree honours `role="none"` on a
 * `<details>` at all is untestable from this repo. Unwrapping avoids all three:
 * post-upgrade there is no `<summary>` to duplicate a role, both markup shapes
 * converge to one structure, and there is no `<details>` left for any engine to
 * special-case.
 *
 * The unwrapped shape, per branch: the `<summary>`'s children move into a new,
 * plain `<span class="tree__summary">` (no implicit role, no tabindex of its
 * own — nothing competes with `.tree__item` for the click or the roving
 * tabindex); the nested `.tree` becomes a direct child of `.tree__item`
 * instead of a child of `<details>`; `<details>`/`<summary>` are discarded.
 * `.tree__item` — the `<li>` in the list shape, kept as-is; a freshly created
 * container in the flat shape, since there the `<details>` *is* the item and
 * there is nothing to keep — gets `role="treeitem"`, a roving `tabindex`, and
 * `aria-expanded` if it has a nested group. `aria-level`/`aria-posinset`/
 * `aria-setsize` are deliberately never set: with a real `role="group"` nested
 * inside `role="treeitem"`, the browser computes all three from structure, and
 * setting them here would be a second source of truth to keep in sync with
 * every filter keystroke for no benefit.
 *
 * **Expansion has no native `.open` to mirror.** `aria-expanded` is set for
 * the accessibility tree; a branch's actual visibility is driven by toggling
 * `hidden="until-found"` on its nested group — never `aria-expanded` itself,
 * and the direction matters. The browser's own find-in-page / fragment-
 * navigation reveal algorithm removes `hidden` itself (firing a bubbling
 * `beforematch` per revealed ancestor) whenever it needs to show collapsed
 * content; keying the CSS collapse on `aria-expanded` instead would leave a
 * UA-revealed branch visually still collapsed until a `beforematch` handler
 * caught up. `#setExpanded` is the one writer for both attributes together.
 * `until-found` is also the fix for a claim this file used to make: Chrome has
 * auto-expanded `<details>` for find-in-page and fragment navigation since
 * v97, so "a `<details>` inside a closed `<details>` is not rendered, so
 * fragment navigation cannot reach it" was already false there — `until-found`
 * is what makes the reveal work uniformly across engines instead of one.
 *
 * **This is the first element in the framework that discards slotted DOM
 * nodes** rather than only hiding or appending alongside them (`WCEntries` is
 * the tier-2 exemplar: it hides its source with a class and appends a
 * projection next to it). A consumer script holding a reference to the
 * original `<details>`/`<summary>` — including the flat shape's `id`-carrying
 * `<details>`, via `getElementById` captured before upgrade — loses it on
 * upgrade, and the `<details>` `toggle` event stops existing; `tree-toggle`
 * (mirroring the existing `tree-filter` event) is the replacement surface.
 * Named here, and in `AGENTS.md`, as a deliberate exception to the tier-2
 * "parse the fallback and augment it in place" contract, alongside
 * `<wc-consent>` and `<wc-theme-editor>`.
 *
 * Behaviours:
 *
 * 1. **Filter** — matches a node's *own* label and description (never its
 *    descendants' text, or every ancestor would match everything). A hit keeps
 *    its ancestors visible, so a match stays reachable, and keeps its
 *    descendants, so a matched subtree can still be explored. Open state before
 *    the first keystroke is restored when the query is cleared. Filtering's
 *    `hidden` (a plain boolean, on `.tree__item`) is a completely separate
 *    channel from expansion's `hidden="until-found"` (on the nested group) —
 *    conflating the two is the easiest way to break either.
 * 2. **Keyboard navigation** — Up/Down move between visible nodes; Right opens
 *    a closed branch or steps into an open one's first child; Left closes an
 *    open branch or steps to the parent; Home/End jump to the ends of visible
 *    depth-first order; Enter/Space toggles a branch or activates a leaf's
 *    link; `*` expands every sibling at the current level; a printable
 *    character starts a type-ahead search. Left/Right flip under
 *    `direction: rtl`. The whole tree is one tab stop.
 * 3. **Expand / collapse all** — over every branch, via `#setExpanded`.
 * 4. **Deep link** — an incoming `#id` opens the target's ancestors and scrolls
 *    to it. The transform runs asynchronously relative to the browser's own
 *    parse-time fragment reveal, so this stays necessary even with
 *    `until-found` making the reveal itself more reliable than the old
 *    `<details>` gap.
 *
 * @example
 * ```html
 * <wc-tree label="Filter fields">
 *   <div class="tree tree--lines">
 *     <details class="tree__item" id="site">
 *       <summary>
 *         <span class="tree__toggle" aria-hidden="true"></span>
 *         <span class="tree__label"><code>site</code></span>
 *       </summary>
 *       <p class="tree__desc">One published presentation of the organization.</p>
 *       <div class="tree">
 *         <div class="tree__item" id="site.analytics">
 *           <span class="tree__content">
 *             <span class="tree__label"><code>analytics</code></span>
 *           </span>
 *         </div>
 *       </div>
 *     </details>
 *   </div>
 * </wc-tree>
 * ```
 * That markup is the no-JS contract — `<details>`/`<summary>`, exactly as
 * above. What this element renders on upgrade is a different, JS-owned shape.
 */
export class WCTree extends BaseElement {
  static properties = {
    label: { type: String, reflect: true },
    /** Hide the filter field — leaves expand/collapse only. */
    nofilter: { type: Boolean, reflect: true },
  };

  /** Light DOM — the framework's `.tree` CSS must style the slotted markup. */
  override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Never let lit-html touch the slotted tree. */
  protected override render(): typeof noChange {
    return noChange;
  }

  declare label: string;
  declare nofilter: boolean;

  #root: HTMLElement | null = null;
  #items: StaticNode[] = [];
  #branches: StaticNode[] = [];
  #toolbar: HTMLElement | null = null;
  #input: HTMLInputElement | null = null;
  #status: HTMLElement | null = null;
  /** Expand state before filtering began, so clearing the query restores it. */
  #openBefore: WeakMap<HTMLElement, boolean> = new WeakMap();
  #filtering = false;
  #roving!: RovingTabindex<HTMLElement>;

  constructor() {
    super();
    this.label = 'Filter';
    this.nofilter = false;
    this.#roving = new RovingTabindex<HTMLElement>(this, {
      items: () => this.#items.map((n) => n.key),
      keyToMove: this.#onTreeKeyDown,
      textFor: (item) => this.#items.find((n) => n.key === item)?.label ?? '',
      ignoreWithin: 'a, button, input, select, textarea, [contenteditable]',
      onMove: (item, _previous, cause) => {
        if (cause === 'key') this.#root?.setAttribute('data-tree-keyboard', '');
        const row = item.querySelector<HTMLElement>(
          ':scope > .tree__summary, :scope > .tree__content',
        );
        row?.scrollIntoView({ block: 'nearest' });
      },
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // The `.tree` fallback may not be parsed yet — see initFromLightDom.
    initFromLightDom(this, () => this.#setup());
  }

  /** Wire up if the fallback tree is present. Returns whether it was. */
  #setup(): boolean {
    if (this.#root) return true; // already initialised
    if (!this.isConnected) return false;

    // Defer entirely to an enclosing <wc-tree> — see WCTree.ts's sibling
    // components for the same guard. The test is on `parentElement`, not
    // `this` (which `closest` would match), so it is the INNER element that
    // finds an enclosing one and bails; the outer has none above it and does
    // the work. Returning true stops the retry as well.
    if (this.parentElement?.closest('wc-tree')) return true;

    const root = this.querySelector<HTMLElement>('.tree');
    if (!root || !root.querySelector('.tree__item')) return false;

    this.#transform(root);
    this.#root = root;
    this.#collect();

    this.#buildToolbar();
    this.#roving.attach(root);
    root.addEventListener('click', this.#onClick);
    root.addEventListener('beforematch', this.#onBeforeMatch);
    root.addEventListener('pointerdown', this.#onPointerDown);
    window.addEventListener('hashchange', this.#onHashChange);
    // The browser has already given up on the fragment by the time we upgrade —
    // see #revealHash for why it could never have resolved it anyway.
    requestAnimationFrame(() => this.#revealHash());
    return true;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.#onHashChange);
    this.#root?.removeEventListener('click', this.#onClick);
    this.#root?.removeEventListener('beforematch', this.#onBeforeMatch);
    this.#root?.removeEventListener('pointerdown', this.#onPointerDown);
    this.#roving.detach();
    this.#toolbar?.remove();
    this.#toolbar = null;
    this.#input = null;
    this.#status = null;
    this.#items = [];
    this.#branches = [];
    this.#root = null;
  }

  /* ── Transform ── */

  /**
   * Unwrap every branch's `<details>`/`<summary>` in place. A no-op on
   * already-transformed input — there is no `<details>` left to find — which
   * is what makes a second `#setup()` run (a consumer manually re-appending
   * this element's subtree; there is no client router in this repo to trigger
   * it any other way) safe rather than requiring a restore-the-original-DOM
   * path.
   *
   * Wrapped per-branch: a throw partway through leaves that one branch as a
   * working native `<details>` rather than corrupting the whole tree.
   */
  #transform(root: HTMLElement): void {
    // `querySelectorAll` returns a static NodeList — safe to iterate directly
    // even though the loop body removes each `<details>` as it goes.
    for (const details of root.querySelectorAll<HTMLDetailsElement>('details')) {
      try {
        if (details.classList.contains('tree__item')) this.#unwrapFlatBranch(details);
        else if (details.parentElement) this.#unwrapListBranch(details.parentElement, details);
      } catch {
        // Leave this branch native rather than taking the whole tree down.
      }
    }

    // Every item, branch or leaf — `#finishBranch` only runs for branches, so
    // this is the only place a leaf ever gets `role="treeitem"`.
    for (const treeItem of root.querySelectorAll<HTMLElement>('.tree__item')) {
      treeItem.setAttribute('role', 'treeitem');
    }
    for (const nested of root.querySelectorAll<HTMLElement>('.tree')) {
      nested.setAttribute('role', 'group');
    }
    root.setAttribute('role', 'tree');
    if (!root.hasAttribute('aria-label') && !root.hasAttribute('aria-labelledby')) {
      root.setAttribute('aria-label', this.label);
    }
  }

  /** List shape: `<li class="tree__item"><details>…` — the `<li>` keeps its
   * identity; only the child `<details>` dissolves. */
  #unwrapListBranch(item: HTMLElement, details: HTMLDetailsElement): void {
    const wasOpen = details.open;
    const summary = details.querySelector(':scope > summary');
    const row = document.createElement('span');
    row.className = 'tree__summary';
    item.insertBefore(row, details); // fresh node — nothing to preserve
    if (summary) {
      moveAllChildren(summary, row, null);
      summary.remove();
    }
    moveAllChildren(details, item, details);
    details.remove();
    this.#setExpanded(item, wasOpen);
  }

  /** Flat shape: `<details class="tree__item" id="…">` — the `<details>` IS
   * the item, so there is nothing to keep; a replacement is created. */
  #unwrapFlatBranch(details: HTMLDetailsElement): void {
    const wasOpen = details.open;
    const parent = details.parentElement;
    if (!parent) return;
    const tag = parent.tagName === 'UL' || parent.tagName === 'OL' ? 'li' : 'div';
    const item = document.createElement(tag);
    item.id = details.id;
    item.className = details.className;
    // `open`/`name` are deliberately not copied: `open` is meaningless on a
    // non-`<details>` (state now lives in `aria-expanded` + the group's
    // `hidden`), and `name` is `<details>`'s exclusive-accordion grouping —
    // copying it would silently turn an accordion tree into an
    // always-multi-open one.
    parent.insertBefore(item, details); // fresh node — nothing to preserve

    const summary = details.querySelector(':scope > summary');
    const row = document.createElement('span');
    row.className = 'tree__summary';
    item.appendChild(row); // fresh node
    if (summary) {
      moveAllChildren(summary, row, null);
      summary.remove();
    }
    moveAllChildren(details, item, null);
    details.remove();
    this.#setExpanded(item, wasOpen);
  }

  /* ── Parsing ── */

  /** Read the transformed DOM into the flat node list `matchTree` and the tree
   * nav functions decide over. The element key IS the element, so applying an
   * answer is a `Set.has` per node. */
  #collect(): void {
    const items = this.#root?.querySelectorAll<HTMLElement>('.tree__item') ?? [];
    this.#items = [...items].map((el) => ({
      key: el,
      parent: el.parentElement?.closest<HTMLElement>('.tree__item') ?? null,
      own: this.#ownText(el),
      label: this.#rowText(el),
    }));
    this.#branches = this.#items.filter((n) => this.#group(n.key) !== null);
  }

  /** Row text only — what type-ahead searches. Both shapes converge to one
   * selector post-transform. */
  #rowText(el: HTMLElement): string {
    const row = el.querySelector(':scope > .tree__summary, :scope > .tree__content');
    return (row?.textContent ?? '').trim().toLowerCase();
  }

  /** Row + description — what `filter()` searches. Deliberately NOT
   * `textContent`, which would include every descendant and make a root match
   * any query that matched anything under it. */
  #ownText(el: HTMLElement): string {
    const parts: string[] = [];
    const row = el.querySelector(':scope > .tree__summary, :scope > .tree__content');
    if (row?.textContent) parts.push(row.textContent);
    const desc = el.querySelector(':scope > .tree__desc, :scope > p');
    if (desc?.textContent) parts.push(desc.textContent);
    return parts.join(' ').toLowerCase();
  }

  /** The nested group a branch owns, or null for a leaf. */
  #group(item: HTMLElement): HTMLElement | null {
    return item.querySelector<HTMLElement>(':scope > .tree');
  }

  /** A fresh `TreeNavNode[]`, reading `hidden`/`expanded` live off the DOM —
   * never cached, since both change on every filter keystroke and every
   * expand/collapse. */
  #snapshot(): (StaticNode & TreeNavNode)[] {
    return this.#items.map((n) => ({
      ...n,
      // `.hidden`'s IDL type admits `"until-found"` since that's a valid value
      // for the ATTRIBUTE, but `#setHidden` is the only writer of an ITEM's
      // hidden state and only ever passes a real boolean — normalise the type
      // rather than the (never-taken) `"until-found"` branch.
      hidden: n.key.hidden === true,
      expanded: this.#group(n.key) ? n.key.getAttribute('aria-expanded') === 'true' : null,
    }));
  }

  /* ── Expansion / visibility — single writers ── */

  /** The only place expansion state is ever written. Sets `aria-expanded` for
   * the accessibility tree and toggles the group's `hidden="until-found"` —
   * never `aria-expanded` alone, since the browser's own find-in-page /
   * fragment-nav reveal manipulates `hidden` directly and the visual state
   * must follow that attribute, not a JS mirror of it. No-ops on a leaf. */
  #setExpanded(item: HTMLElement, open: boolean): void {
    const group = this.#group(item);
    if (!group) return;
    item.setAttribute('aria-expanded', String(open));
    if (open) group.removeAttribute('hidden');
    else group.setAttribute('hidden', 'until-found');
  }

  /** The only place `filter()`'s hidden channel is ever written — a plain
   * boolean, entirely separate from `#setExpanded`'s `"until-found"`. */
  #setHidden(item: HTMLElement, hidden: boolean): void {
    item.hidden = hidden;
  }

  /* ── Toolbar ── */

  #buildToolbar(): void {
    const bar = document.createElement('div');
    bar.className = 'tree__toolbar cluster';

    if (!this.nofilter) {
      const input = document.createElement('input');
      input.type = 'search';
      input.className = 'tree__filter';
      input.placeholder = this.label;
      input.setAttribute('aria-label', this.label);
      input.addEventListener('input', () => this.filter(input.value));

      // `forms.css` styles text controls as `.form-group > input` / `.input-group
      // > input` — a bare `<input>` gets browser defaults, which is a 2px inset
      // border and square corners next to the framework's own rounded controls.
      // The wrapper is how the framework says "this is a text control".
      const group = document.createElement('div');
      group.className = 'input-group tree__filter-group';
      group.appendChild(input);
      bar.appendChild(group);
      this.#input = input;
    }

    for (const [text, open] of [
      ['Expand all', true],
      ['Collapse all', false],
    ] as const) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.textContent = text;
      btn.addEventListener('click', () => this.toggleAll(open));
      bar.appendChild(btn);
    }

    // Announce the result of a filter: the visual change is a lot of nodes
    // disappearing, which a screen reader is otherwise given no account of.
    const status = document.createElement('span');
    status.className = 'tree__count font-footnote';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    bar.appendChild(status);
    this.#status = status;

    this.#root?.before(bar);
    this.#toolbar = bar;
  }

  /* ── Public behaviour ── */

  /** Open or close every branch. */
  toggleAll(open: boolean): void {
    for (const node of this.#branches) this.#setExpanded(node.key, open);
    this.#roving.sync();
  }

  /**
   * Show only nodes whose own text matches `query`, plus their ancestors and
   * descendants. An empty query restores the pre-filter view.
   */
  filter(query: string): void {
    const q = query.trim().toLowerCase();

    if (!q) {
      for (const { key } of this.#items) this.#setHidden(key, false);
      if (this.#filtering) {
        for (const node of this.#branches) {
          this.#setExpanded(node.key, this.#openBefore.get(node.key) ?? false);
        }
        this.#filtering = false;
      }
      this.#setStatus('');
      this.#roving.sync();
      return;
    }

    // Snapshot expand state once, on the transition into filtering — not on
    // every keystroke, or the second keystroke would record the state the
    // first one forced open and "restore" would restore a filtered view.
    if (!this.#filtering) {
      for (const node of this.#branches) {
        this.#openBefore.set(node.key, node.key.getAttribute('aria-expanded') === 'true');
      }
      this.#filtering = true;
    }

    const { keep, hits } = matchTree(this.#items, q);

    for (const { key } of this.#items) this.#setHidden(key, !keep.has(key));
    // Open the kept branches, otherwise a match nested in a closed node is
    // "shown" inside something collapsed and the query looks like it found
    // nothing.
    for (const key of keep) {
      const item = key as HTMLElement;
      if (this.#group(item)) this.#setExpanded(item, true);
    }

    this.#setStatus(hits === 1 ? '1 match' : `${hits} matches`);
    this.#roving.sync();
    this.dispatchEvent(
      new CustomEvent('tree-filter', { detail: { query: q, matches: hits }, bubbles: true }),
    );
  }

  #setStatus(text: string): void {
    if (this.#status) this.#status.textContent = text;
  }

  /* ── Click — the replacement for native summary-click-toggles-details ── */

  #onClick = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    if (!target || target.closest('.tree__actions')) return; // don't steal a row action's click
    const summary = target.closest('.tree__summary');
    if (!summary) return;
    const item = summary.parentElement;
    if (!(item instanceof HTMLElement) || !item.classList.contains('tree__item')) return;
    if (!this.#group(item)) return;
    this.#setExpanded(item, item.getAttribute('aria-expanded') !== 'true');
    this.#roving.sync();
  };

  #onPointerDown = (): void => {
    // A mouse entry invalidates the "focus arrived via keyboard" signal the
    // CSS focus ring depends on — see tree.css's `[data-tree-keyboard]` rule.
    this.#root?.removeAttribute('data-tree-keyboard');
  };

  /* ── Keyboard ── */

  #onTreeKeyDown = (
    event: KeyboardEvent,
    ctx: RovingContext<HTMLElement>,
  ): RovingMove<HTMLElement> | null => {
    const active = ctx.active;
    if (!active) return null;

    const direction = this.#directionFor(event.key, ctx.rtl);
    if (direction) return this.#applyDirection(active, direction);

    if (event.key === 'Enter' || event.key === ' ') {
      const group = this.#group(active);
      if (group) {
        this.#setExpanded(active, active.getAttribute('aria-expanded') !== 'true');
        this.#roving.sync();
      } else {
        active
          .querySelector<HTMLAnchorElement>(':scope > .tree__summary a, :scope > .tree__content a')
          ?.click();
      }
      return { type: 'handled' };
    }

    if (event.key === '*') {
      for (const key of siblingsOf(this.#snapshot(), active)) {
        this.#setExpanded(key as HTMLElement, true);
      }
      this.#roving.sync();
      return { type: 'handled' };
    }

    return null;
  };

  #directionFor(key: string, rtl: boolean): TreeDirection | null {
    switch (key) {
      case 'ArrowDown':
        return 'next';
      case 'ArrowUp':
        return 'prev';
      case 'ArrowRight':
        return rtl ? 'out' : 'in';
      case 'ArrowLeft':
        return rtl ? 'in' : 'out';
      case 'Home':
        return 'first';
      case 'End':
        return 'last';
      default:
        return null;
    }
  }

  #applyDirection(active: HTMLElement, direction: TreeDirection): RovingMove<HTMLElement> | null {
    const move = resolveTreeMove(this.#snapshot(), active, direction);
    if (!move) return null;
    if (move.type === 'to') return { type: 'to', item: move.key as HTMLElement };
    // 'expand' / 'collapse' — a side effect, not a move; RovingTabindex is
    // told the key was handled so it preventDefault()s without touching focus.
    this.#setExpanded(move.key as HTMLElement, move.type === 'expand');
    this.#roving.sync();
    return { type: 'handled' };
  }

  /* ── Deep linking ── */

  #onHashChange = (): void => this.#revealHash();

  /**
   * Open the ancestors of the hash target and scroll to it. `until-found`
   * makes the browser's own fragment-navigation reveal work uniformly across
   * engines (see the class docblock), but this still runs: the transform
   * happens asynchronously relative to the browser's parse-time reveal, a
   * target hidden by `filter()`'s plain `hidden` is not revealable at all
   * (MDN: `display: none` blocks the reveal algorithm), and `scrollIntoView()`
   * itself never triggers a reveal.
   */
  #revealHash(): void {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    // Not a selector — an id here can contain dots (`site.analytics.clarityId`),
    // which querySelector would read as a class chain.
    const target = this.#root?.ownerDocument.getElementById(id);
    if (!target || !this.contains(target)) return;

    // The target's own group first, then every ancestor.
    if (this.#group(target)) this.#setExpanded(target, true);
    for (let el: HTMLElement | null = target.parentElement; el; el = el.parentElement) {
      if (el.classList.contains('tree__item')) this.#setExpanded(el, true);
      if (el === this) break;
    }
    if (this.#input?.value) this.filter((this.#input.value = ''));
    // `sync()` alone only recovers when the CURRENT active item stops being
    // focusable — it never jumps to an unrelated target on its own. Without
    // this, a deep link lands the visitor visually on the target while Tab
    // still goes wherever it was before the link was followed.
    this.#roving.setActive(target, { focus: false, cause: 'api' });

    const row =
      target.querySelector<HTMLElement>(':scope > .tree__summary, :scope > .tree__content') ??
      target;
    row.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  /* ── Accessibility-tree revelation (find-in-page, fragment nav) ── */

  /**
   * The browser's own reveal algorithm fires this, bubbling, once per
   * `hidden="until-found"` ancestor it reveals — never from a script-driven
   * attribute change, so there is no risk of this double-firing against
   * `#setExpanded`'s own writes. It removes `hidden` itself; this handler's
   * only job is to mirror that onto `aria-expanded` for the ancestor treeitem,
   * and it must never write `hidden` here or it races the UA.
   */
  #onBeforeMatch = (event: Event): void => {
    const group = event.target;
    if (!(group instanceof HTMLElement)) return;
    const item = group.parentElement;
    if (item instanceof HTMLElement && item.classList.contains('tree__item')) {
      item.setAttribute('aria-expanded', 'true');
    }
  };
}

if (!customElements.get('wc-tree')) {
  customElements.define('wc-tree', WCTree);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-tree': WCTree;
  }
}
