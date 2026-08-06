import { BaseElement } from './BaseElement.js';
import { initFromLightDom } from './utils/upgrade.js';

/**
 * Adaptive data display that progressively enhances heading + <dl> pairs
 * into different structural views based on container size.
 *
 * Slotted content is a series of heading elements (h1-h6) each followed by
 * a <dl> with <dt>/<dd> pairs. View modes:
 *
 * 1. **No JS (default)**: all heading + dl pairs render stacked (semantic).
 * 2. **JS + narrow (no `projection`)**: stacked heading + dl as-is.
 * 3. **JS + wide**: full table generated from the parsed data.
 * 4. **JS + `projection` + narrow**: table always shown inside a scroll
 *    container with sticky first column. Nav buttons scroll the selected
 *    column into view.
 * 5. **JS + `projection` + `singular` + narrow**: table with only the
 *    selected data column visible. Nav buttons toggle which column is
 *    shown. The data column fills remaining width after the row heading.
 * 6. **JS + `projection` + wide**: full table, no nav.
 *
 * A ResizeObserver toggles between narrow and wide via the .entries--wide
 * class based on the `breakpoint` attribute.
 *
 * TODO: When container style queries with custom properties land (Interop
 * 2026), replace ResizeObserver with pure CSS: set --entries-view via space
 * toggle hack based on container inline-size, then use
 * @container style(--entries-view: tabular) to toggle visibility.
 *
 * TODO: heading-label attribute to name the first column in the table header.
 *
 * TODO: table-class attribute to pass through variant classes (striped,
 * hover, etc.) to the generated table.
 *
 * @example
 * ```html
 * <!-- Stacked dl (narrow) → table (wide) -->
 * <wc-entries breakpoint="40rem">
 *   <h3>Alice</h3>
 *   <dl><dt>Email</dt><dd>alice@example.com</dd></dl>
 *   <h3>Bob</h3>
 *   <dl><dt>Email</dt><dd>bob@example.com</dd></dl>
 * </wc-entries>
 *
 * <!-- Column projection (narrow) → table (wide) -->
 * <wc-entries breakpoint="40rem" projection>
 *   <h3>Alice</h3>
 *   <dl><dt>Email</dt><dd>alice@example.com</dd></dl>
 *   <h3>Bob</h3>
 *   <dl><dt>Email</dt><dd>bob@example.com</dd></dl>
 * </wc-entries>
 * ```
 */
export class WCEntries extends BaseElement {
  static properties = {
    breakpoint: { type: String, reflect: true },
    projection: { type: Boolean, reflect: true },
    singular: { type: Boolean, reflect: true },
  };

  /** Light DOM — existing CSS applies to both dl and generated table. */
  override createRenderRoot() {
    return this;
  }

  declare breakpoint: string;
  declare projection: boolean;
  declare singular: boolean;

  #entries: { title: string; heading: Element; dl: Element; properties: Map<string, string> }[] =
    [];
  #columnHeaders: string[] = [];
  #columnLabels: string[] = [];
  #table: HTMLTableElement | null = null;
  #tableWrapper: HTMLDivElement | null = null;
  #nav: HTMLElement | null = null;
  #navButtons: HTMLButtonElement[] = [];
  #headerCells: HTMLTableCellElement[] = [];
  #activeIndex = 0;
  #isWide = false;
  #resizeObserver: ResizeObserver | null = null;
  #breakpointPx = 0;

  init() {
    this.breakpoint = '40rem';
    this.projection = false;
    this.singular = false;
  }

  constructor() {
    super();
    this.init();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // The heading + <dl> pairs may not be parsed yet — see initFromLightDom.
    // Without the retry, an element inserted via innerHTML kept its stacked
    // fallback forever and never built its table, silently.
    initFromLightDom(this, () => this.#setup());
  }

  /** Build the table if the slotted entries are present. Returns whether they were. */
  #setup(): boolean {
    if (this.#table) return true; // already built — never generate twice

    this.#parseContent();
    if (this.#entries.length === 0) return false;

    this.#generateTable();

    if (this.projection) {
      this.#hideSourceContent();
      this.#wrapTableForScroll();
      this.#createNav();
      if (this.singular) {
        this.classList.add('entries--singular');
        this.#showOnlyColumn(0);
      }
    }

    this.#breakpointPx = this.#parseBreakpoint();
    this.#setupResizeObserver();
    return true;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;

    /* Remove generated elements */
    this.#nav?.remove();
    this.#nav = null;
    this.#navButtons = [];

    if (this.#tableWrapper) {
      this.#tableWrapper.remove();
    } else {
      this.#table?.remove();
    }
    this.#table = null;
    this.#tableWrapper = null;
    this.#headerCells = [];

    this.classList.remove('entries--wide', 'entries--projection', 'entries--singular');
  }

  /* ── Content parsing ── */

  #parseContent(): void {
    this.#entries = [];
    const columnSet = new Set<string>();
    const labelMap = new Map<string, string>();

    let currentHeading: Element | null = null;

    for (const child of this.children) {
      const tag = child.tagName.toLowerCase();

      if (/^h[1-6]$/.test(tag)) {
        currentHeading = child;
      } else if (tag === 'dl' && currentHeading) {
        const properties = new Map<string, string>();
        const dts = child.querySelectorAll('dt');
        const dds = child.querySelectorAll('dd');
        for (let i = 0; i < dts.length; i++) {
          const dt = dts[i] as Element;
          const key = dt.textContent?.trim() ?? '';
          const value = dds[i]?.innerHTML ?? '';
          if (key) {
            properties.set(key, value);
            columnSet.add(key);
            const label = dt.getAttribute('data-label');
            if (label && !labelMap.has(key)) labelMap.set(key, label);
          }
        }
        this.#entries.push({
          title: currentHeading.innerHTML,
          heading: currentHeading,
          dl: child,
          properties,
        });
        currentHeading = null;
      }
    }

    this.#columnHeaders = [...columnSet];
    this.#columnLabels = this.#columnHeaders.map((h) => labelMap.get(h) ?? h);
  }

  /* ── Source content visibility ── */

  #hideSourceContent(): void {
    this.classList.add('entries--projection');
  }

  /* ── Table generation ── */

  #generateTable(): void {
    const table = document.createElement('table');
    table.classList.add('entries__table');
    table.setAttribute('aria-hidden', 'true');

    /* thead */
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const firstTh = document.createElement('th');
    firstTh.textContent = '';
    headerRow.appendChild(firstTh);

    this.#headerCells = [];
    for (const header of this.#columnHeaders) {
      const th = document.createElement('th');
      th.textContent = header;
      headerRow.appendChild(th);
      this.#headerCells.push(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    /* tbody */
    const tbody = document.createElement('tbody');
    for (const entry of this.#entries) {
      const tr = document.createElement('tr');

      const titleTd = document.createElement('td');
      titleTd.innerHTML = entry.title;
      titleTd.style.fontWeight = '600';
      tr.appendChild(titleTd);

      for (const header of this.#columnHeaders) {
        const td = document.createElement('td');
        td.innerHTML = entry.properties.get(header) ?? '';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    this.appendChild(table);
    this.#table = table;
  }

  /* ── Projection: scrollable table wrapper ── */

  #wrapTableForScroll(): void {
    if (!this.#table) return;
    const wrapper = document.createElement('div');
    wrapper.classList.add('entries__scroll');
    this.#table.replaceWith(wrapper);
    wrapper.appendChild(this.#table);
    this.#tableWrapper = wrapper;
  }

  /* ── Projection: column nav ── */

  #createNav(): void {
    const nav = document.createElement('nav');
    nav.classList.add('entries__nav');
    nav.setAttribute('aria-label', 'Column selector');
    nav.setAttribute('aria-hidden', 'true');

    this.#navButtons = this.#columnHeaders.map((header, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.classList.add('entries__nav-btn');
      btn.textContent = this.#columnLabels[i] ?? header;
      btn.setAttribute('aria-pressed', String(i === 0));
      btn.addEventListener('click', () => this.#scrollToColumn(i));
      nav.appendChild(btn);
      return btn;
    });

    /* Insert nav before the table wrapper */
    this.#tableWrapper!.before(nav);
    this.#nav = nav;
  }

  #scrollToColumn(index: number): void {
    this.#activeIndex = index;

    /* Update button states */
    for (let i = 0; i < this.#navButtons.length; i++) {
      this.#navButtons[i]?.setAttribute('aria-pressed', String(i === index));
    }

    if (this.singular) {
      this.#showOnlyColumn(index);
    } else {
      /* Scroll the column header into view within the scroll container */
      const th = this.#headerCells[index];
      if (th && this.#tableWrapper) {
        th.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
      }
    }

    this.dispatchEvent(
      new CustomEvent('entries-column-change', {
        detail: { column: index, header: this.#columnHeaders[index] },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /* ── Singular: column visibility ── */

  #showOnlyColumn(index: number): void {
    if (!this.#table) return;
    const colIndex = index + 1; /* offset for title column */
    for (const row of this.#table.rows) {
      for (let c = 1; c < row.cells.length; c++) {
        const cell = row.cells[c];
        if (cell) cell.hidden = c !== colIndex;
      }
    }
  }

  #showAllColumns(): void {
    if (!this.#table) return;
    for (const row of this.#table.rows) {
      for (let c = 1; c < row.cells.length; c++) {
        const cell = row.cells[c];
        if (cell) cell.hidden = false;
      }
    }
  }

  /* ── Breakpoint ── */

  #parseBreakpoint(): number {
    const value = this.breakpoint || '40rem';
    const temp = document.createElement('div');
    temp.style.width = value;
    temp.style.position = 'absolute';
    temp.style.visibility = 'hidden';
    this.appendChild(temp);
    const px = temp.offsetWidth;
    temp.remove();
    return px;
  }

  /* ── Resize observation ── */

  #setupResizeObserver(): void {
    this.#resizeObserver = new ResizeObserver(this.#handleResize);
    this.#resizeObserver.observe(this);
  }

  #handleResize = (entries: ResizeObserverEntry[]): void => {
    const entry = entries[0];
    if (!entry) return;
    const width = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
    this.#isWide = width >= this.#breakpointPx;

    if (this.#isWide) {
      this.classList.add('entries--wide');
      if (this.singular && this.projection) this.#showAllColumns();
    } else {
      this.classList.remove('entries--wide');
      if (this.singular && this.projection) this.#showOnlyColumn(this.#activeIndex);
    }
  };
}

if (!customElements.get('wc-entries')) {
  customElements.define('wc-entries', WCEntries);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-entries': WCEntries;
  }
}
