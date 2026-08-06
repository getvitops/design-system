import { noChange } from 'lit';
import { BaseElement } from './BaseElement.js';
import { matchTree, type TreeNode } from './utils/tree-filter.js';
import { initFromLightDom } from './utils/upgrade.js';

/**
 * Progressive enhancement for the `.tree` pattern — filter, bulk expand/collapse
 * and hash deep-linking over a nested `<details>` disclosure tree.
 *
 * The slotted markup is the fallback and it is already complete: `.tree` +
 * `.tree__item` renders as native nested `<details>`, so with no JS a visitor can
 * still read every node, expand and collapse by clicking, tab through the
 * summaries and deep-link with an `#id`. Nothing here renders content; this
 * element only adds the things that genuinely cannot be done in CSS.
 *
 * **The toolbar is generated, not slotted.** A search field that does nothing is
 * worse than no search field, so the controls only exist once the element has
 * upgraded. That is also why `filter`/`expand` are not authored in the markup.
 *
 * Three behaviours:
 *
 * 1. **Filter** — matches a node's *own* label and description (never its
 *    descendants' text, or every ancestor would match everything). A hit keeps
 *    its ancestors visible, so a match stays reachable, and keeps its
 *    descendants, so a matched subtree can still be explored. Open state before
 *    the first keystroke is restored when the query is cleared — filtering is a
 *    view, not an edit.
 * 2. **Expand / collapse all** — over every `<details>` in the tree.
 * 3. **Deep link** — an incoming `#id` opens the target's ancestors and scrolls
 *    to it. A `<details>` inside a closed `<details>` is not rendered, so the
 *    browser's own fragment navigation cannot reach it; this is the gap that
 *    makes a deep link into a collapsed tree silently land at the top of the
 *    page.
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
  #items: TreeNode[] = [];
  #toolbar: HTMLElement | null = null;
  #input: HTMLInputElement | null = null;
  #status: HTMLElement | null = null;
  /** Open state before filtering began, so clearing the query restores the view. */
  #openBefore: WeakMap<HTMLDetailsElement, boolean> = new WeakMap();
  #filtering = false;

  constructor() {
    super();
    this.label = 'Filter';
    this.nofilter = false;
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

    // Defer entirely to an enclosing <wc-tree>.
    //
    // `<Tree />` already emits its own `<wc-tree>`, so a consumer who reasonably
    // guesses `<wc-tree><Tree /></wc-tree>` nests two. `querySelector('.tree')`
    // descends, so both would bind the SAME tree and each build a toolbar — two
    // filters fighting over one set of nodes, with no error. Returning true stops
    // the retry as well; the inner element does all the work.
    if (this.parentElement?.closest('wc-tree')) return true;

    const root = this.querySelector<HTMLElement>('.tree');
    if (!root) return false;
    this.#root = root;

    this.#collect();
    if (!this.#items.length) {
      this.#root = null;
      return false;
    }

    this.#buildToolbar();
    window.addEventListener('hashchange', this.#onHashChange);
    // The browser has already given up on the fragment by the time we upgrade —
    // see #revealHash for why it could never have resolved it anyway.
    requestAnimationFrame(() => this.#revealHash());
    return true;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.#onHashChange);
    this.#toolbar?.remove();
    this.#toolbar = null;
    this.#input = null;
    this.#status = null;
    this.#items = [];
    this.#root = null;
  }

  /* ── Parsing ── */

  /**
   * Read the DOM into the flat `TreeNode` list `matchTree` decides over. The
   * element key IS the element, so applying the answer is a `Set.has` per node.
   */
  #collect(): void {
    const items = this.#root?.querySelectorAll<HTMLElement>('.tree__item') ?? [];
    this.#items = [...items].map((el) => ({
      key: el,
      own: this.#ownText(el),
      parent: el.parentElement?.closest<HTMLElement>('.tree__item') ?? null,
    }));
  }

  /**
   * A node's own searchable text: its summary or content row plus its own
   * description. Deliberately NOT `textContent` — that includes every
   * descendant, so a root node would match any query that matched anything
   * under it, and filtering would never narrow.
   */
  #ownText(el: HTMLElement): string {
    const parts: string[] = [];
    // Both supported shapes: the item may BE the `<details>`, or be an `<li>`
    // wrapping one (what `<Tree />` emits, for list semantics). Missing the
    // wrapped case would make every branch node unsearchable by its own label.
    for (const sel of [
      ':scope > summary',
      ':scope > .tree__content',
      ':scope > details > summary',
    ]) {
      const node = el.querySelector(sel);
      if (node?.textContent) parts.push(node.textContent);
    }
    for (const desc of el.querySelectorAll(
      ':scope > .tree__desc, :scope > p, :scope > details > .tree__desc, :scope > details > p',
    ))
      if (desc.textContent) parts.push(desc.textContent);
    return parts.join(' ').toLowerCase();
  }

  /** The `<details>` this item opens with, in either supported shape. */
  #ownDetails(el: HTMLElement): HTMLDetailsElement | null {
    if (el instanceof HTMLDetailsElement) return el;
    return el.querySelector<HTMLDetailsElement>(':scope > details');
  }

  #details(): HTMLDetailsElement[] {
    return [...(this.#root?.querySelectorAll<HTMLDetailsElement>('details') ?? [])];
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

  /** Open or close every `<details>` in the tree. */
  toggleAll(open: boolean): void {
    for (const d of this.#details()) d.open = open;
  }

  /**
   * Show only nodes whose own text matches `query`, plus their ancestors and
   * descendants. An empty query restores the pre-filter view.
   */
  filter(query: string): void {
    const q = query.trim().toLowerCase();

    if (!q) {
      for (const { key } of this.#items) (key as HTMLElement).hidden = false;
      if (this.#filtering) {
        for (const d of this.#details()) d.open = this.#openBefore.get(d) ?? false;
        this.#filtering = false;
      }
      this.#setStatus('');
      return;
    }

    // Snapshot open state once, on the transition into filtering — not on every
    // keystroke, or the second keystroke would record the state the first one
    // forced open and "restore" would restore a filtered view.
    if (!this.#filtering) {
      for (const d of this.#details()) this.#openBefore.set(d, d.open);
      this.#filtering = true;
    }

    const { keep, hits } = matchTree(this.#items, q);

    for (const { key } of this.#items) (key as HTMLElement).hidden = !keep.has(key);
    // Open the kept branches, otherwise a match nested in a closed node is
    // "shown" inside something collapsed and the query looks like it found nothing.
    // Via `#ownDetails` so this works when the item is an `<li>` wrapping the
    // `<details>` rather than being it — an `instanceof` check alone silently
    // opened nothing for every tree `<Tree />` renders.
    for (const el of keep) {
      const d = this.#ownDetails(el as HTMLElement);
      if (d) d.open = true;
    }

    this.#setStatus(hits === 1 ? '1 match' : `${hits} matches`);
    this.dispatchEvent(
      new CustomEvent('tree-filter', { detail: { query: q, matches: hits }, bubbles: true }),
    );
  }

  #setStatus(text: string): void {
    if (this.#status) this.#status.textContent = text;
  }

  /* ── Deep linking ── */

  #onHashChange = (): void => this.#revealHash();

  /**
   * Open the ancestors of the hash target and scroll to it. The browser cannot
   * do this itself: a node inside a closed `<details>` has no layout box, so
   * fragment navigation finds nothing and silently stays put.
   */
  #revealHash(): void {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    // Not a selector — an id here can contain dots (`site.analytics.clarityId`),
    // which querySelector would read as a class chain.
    const target = this.#root?.ownerDocument.getElementById(id);
    if (!target || !this.contains(target)) return;

    // The target's OWN disclosure first. Walking only ancestors is enough when the
    // item IS the `<details>`, but under the list shape the `<details>` is the
    // target's child — so linking to a branch scrolled to a node that stayed shut.
    const own = this.#ownDetails(target);
    if (own) own.open = true;

    for (let el: HTMLElement | null = target; el; el = el.parentElement) {
      if (el instanceof HTMLDetailsElement) el.open = true;
      if (el === this) break;
    }
    if (this.#input?.value) this.filter((this.#input.value = ''));
    target.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}

if (!customElements.get('wc-tree')) {
  customElements.define('wc-tree', WCTree);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-tree': WCTree;
  }
}
