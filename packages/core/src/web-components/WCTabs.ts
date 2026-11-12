import { noChange, type PropertyValues } from 'lit';
import { BaseElement } from './BaseElement.js';
import { linearKeyToMove } from './utils/keynav.js';
import { RovingTabindex } from './utils/RovingTabindex.js';
import { initialIndex, orientationOf, panelIds, type TabsOrientation } from './utils/tabs.js';
import { initFromLightDom } from './utils/upgrade.js';

/**
 * Tabs, as progressive enhancement over a run of headed sections.
 *
 * **The fallback is the whole content.** With no JS (or before upgrade) the element is a stack of
 * `<section>`s, each opening with its own heading: every panel readable, in order, with a real
 * document outline and working `#id` deep links. Nothing about that markup is a placeholder.
 *
 * ```html
 * <wc-tabs class="tabs">
 *   <section id="overview"><h3>Overview</h3><p>…</p></section>
 *   <section id="pricing"><h3>Pricing</h3><p>…</p></section>
 * </wc-tabs>
 * ```
 *
 * On upgrade it builds a `tablist` of buttons from the headings and prepends it, marks each
 * section `role="tabpanel"` labelled by its tab, and hides the inactive ones. The heading text
 * becomes the tab label, and the heading itself is then `hidden` — the tab already names the panel,
 * so leaving it would have a screen reader announce "Overview" twice. The section keeps its `id`,
 * so `#pricing` still works, and selects that tab.
 *
 * The WAI-ARIA tabs pattern with automatic activation: arrows (the axis `orientation` names), Home
 * and End move focus **and** select, Tab leaves the list for the active panel. A panel with no
 * focusable content of its own is itself focusable, so keyboard users can reach scrollable content.
 *
 * Which tab starts selected: a URL fragment pointing at a panel (or anything inside one), then the
 * `selected` index, then the first. Add `hash` to write the fragment as tabs change.
 *
 * Light DOM, because `.tabs`' CSS has to style both the fallback and the built list.
 *
 * @fires tabs-change `{ index, id }`, bubbles and composed, when the selection changes.
 */
export class WCTabs extends BaseElement {
  static properties = {
    /** Index of the selected tab. Read at setup; setting it later selects that tab. */
    selected: { type: Number },
    /** `horizontal` (default) or `vertical`: which arrows move between tabs. */
    orientation: { type: String, reflect: true },
    /** Write the selected panel's id into the URL fragment as tabs change. */
    hash: { type: Boolean },
  };

  declare selected: number | null;
  declare orientation: TabsOrientation;
  declare hash: boolean;

  override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Never let lit-html touch the sections. */
  protected override render(): typeof noChange {
    return noChange;
  }

  static #counter = 0;

  #ready = false;
  #index = -1;
  #list: HTMLElement | null = null;
  #tabs: HTMLButtonElement[] = [];
  #panels: HTMLElement[] = [];
  #roving: RovingTabindex<HTMLButtonElement>;

  constructor() {
    super();
    this.selected = null;
    this.orientation = 'horizontal';
    this.hash = false;
    this.#roving = new RovingTabindex<HTMLButtonElement>(this, {
      items: () => this.#tabs,
      // The APG tabs pattern wraps: Right on the last tab goes to the first.
      loop: true,
      keyToMove: (event, ctx) =>
        linearKeyToMove(event.key, { orientation: this.orientation, rtl: ctx.rtl }),
      // Selection follows focus. Only for a key: a click selects through its own handler, and
      // `select` moves the roving tabindex with `silent` so it never re-enters here.
      onMove: (tab, _previous, cause) => {
        if (cause === 'key') this.#select(this.#tabs.indexOf(tab), { focus: false });
      },
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('hashchange', this.#onHashChange);
    initFromLightDom(this, () => this.#setup());
  }

  override disconnectedCallback(): void {
    window.removeEventListener('hashchange', this.#onHashChange);
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (!this.#ready) return;
    if (changed.has('orientation')) this.#applyOrientation();
    if (changed.has('selected') && typeof this.selected === 'number') {
      this.#select(Math.min(Math.max(this.selected, 0), this.#tabs.length - 1), { focus: false });
    }
  }

  /* ── Setup ───────────────────────────────────────────────────────────────── */

  #setup(): boolean {
    if (this.#ready) return true;
    const sections = Array.from(this.querySelectorAll<HTMLElement>(':scope > section'));
    // Nothing parsed yet, or not for us to enhance. `false` earns the one retry.
    if (sections.length === 0) return false;

    const base = this.id || `tabs-${++WCTabs.#counter}`;
    const headings = sections.map((s) =>
      s.querySelector<HTMLElement>(':scope > :is(h1, h2, h3, h4, h5, h6)'),
    );
    const labels = sections.map(
      (s, i) =>
        headings[i]?.textContent?.trim() ||
        s.getAttribute('aria-label') ||
        s.dataset.label ||
        `Tab ${i + 1}`,
    );

    const taken = new Set(
      Array.from(document.querySelectorAll('[id]'))
        .filter((el) => !sections.includes(el as HTMLElement))
        .map((el) => el.id),
    );
    const ids = panelIds(
      sections.map((s, i) => ({ ...(s.id ? { id: s.id } : {}), label: labels[i]! })),
      taken,
      base,
    );

    const list = document.createElement('div');
    list.className = 'tabs__list';
    list.setAttribute('role', 'tablist');

    this.#tabs = sections.map((section, i) => {
      section.id = ids[i]!;
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'tabs__tab';
      tab.id = `${base}-tab-${i}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', ids[i]!);
      tab.setAttribute('aria-selected', 'false');
      tab.tabIndex = -1;
      tab.textContent = labels[i]!;
      tab.addEventListener('click', () => this.#select(i, { focus: false }));
      list.append(tab);

      section.classList.add('tabs__panel');
      section.setAttribute('role', 'tabpanel');
      section.setAttribute('aria-labelledby', tab.id);
      section.hidden = true;
      // The tab names the panel; the heading would announce the same text a second time.
      if (headings[i]) headings[i]!.hidden = true;
      return tab;
    });

    this.#panels = sections;
    this.#list = list;
    this.prepend(list);
    this.classList.add('tabs--enhanced');
    this.#applyOrientation();
    this.#roving.attach(list);
    this.#ready = true;

    this.#select(
      initialIndex({
        ids,
        fromHash: this.#panelFromHash(),
        selected: this.selected,
      }),
      { focus: false, announce: false },
    );
    return true;
  }

  #applyOrientation(): void {
    const orientation = orientationOf(this.orientation);
    this.#list?.setAttribute('aria-orientation', orientation);
    this.classList.toggle('tabs--vertical', orientation === 'vertical');
  }

  /** The panel the URL fragment points at, or into. */
  #panelFromHash(): number | null {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return null;
    const i = this.#panels.findIndex(
      (panel) =>
        panel.id === id || Array.from(panel.querySelectorAll('[id]')).some((el) => el.id === id),
    );
    return i === -1 ? null : i;
  }

  #onHashChange = (): void => {
    const i = this.#panelFromHash();
    if (this.#ready && i !== null && i !== this.#index) this.#select(i, { focus: false });
  };

  /* ── Selection ───────────────────────────────────────────────────────────── */

  #select(index: number, opts: { focus: boolean; announce?: boolean }): void {
    if (!this.#ready || index < 0 || index >= this.#tabs.length) return;
    const changed = index !== this.#index;
    this.#index = index;

    this.#tabs.forEach((tab, i) => tab.setAttribute('aria-selected', String(i === index)));
    this.#panels.forEach((panel, i) => {
      panel.hidden = i !== index;
      if (i !== index) return;
      // APG: a panel with nothing focusable in it must be focusable itself, or a keyboard user
      // can't reach scrollable content. One that already has a focusable first stop doesn't need it.
      const focusable = panel.querySelector(
        'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable) panel.removeAttribute('tabindex');
      else panel.tabIndex = 0;
    });
    this.#roving.setActive(this.#tabs[index]!, { focus: opts.focus, silent: true });

    if (!changed) return;
    if (this.hash && opts.announce !== false) {
      history.replaceState(history.state, '', `#${encodeURIComponent(this.#panels[index]!.id)}`);
    }
    if (opts.announce === false) return;
    this.dispatchEvent(
      new CustomEvent('tabs-change', {
        detail: { index, id: this.#panels[index]!.id },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

if (!customElements.get('wc-tabs')) {
  customElements.define('wc-tabs', WCTabs);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-tabs': WCTabs;
  }
}
