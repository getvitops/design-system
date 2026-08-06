import { LitElement, css, type CSSResultGroup, type PropertyValues, nothing } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { html } from '@lit-labs/signals';
import { BaseElement } from './BaseElement.js';
import { iconMap, prefixToMapKey, type IconSet } from '@getvitops/utils';

/* ------------------------------------------------------------------ */
/*  Iconify API client (module-level, shared across instances)        */
/* ------------------------------------------------------------------ */

const API_BASE = 'https://api.iconify.design';

/** Cached SVG markup keyed by `prefix:name` */
const svgCache = new Map<string, string>();

/** Build an `<svg>` string from Iconify icon body data. */
function buildSvg(body: string, width = 24, height = 24): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="currentColor">${body}</svg>`;
}

/** Fetch SVGs for a batch of icons (max ~50 per call). */
async function fetchSvgBatch(prefix: string, names: string[], signal?: AbortSignal): Promise<void> {
  // Filter out already-cached icons
  const needed = names.filter((n) => !svgCache.has(`${prefix}:${n}`));
  if (needed.length === 0) return;

  // Batch in groups of 50
  for (let i = 0; i < needed.length; i += 50) {
    const batch = needed.slice(i, i + 50);
    const url = `${API_BASE}/${prefix}.json?icons=${batch.join(',')}`;
    const res = await fetch(url, { signal: signal ?? null });
    if (!res.ok) continue;
    const data = await res.json();
    const defaultWidth = data.width ?? 24;
    const defaultHeight = data.height ?? 24;
    const icons: Record<string, { body: string; width?: number; height?: number }> =
      data.icons ?? {};
    for (const [name, info] of Object.entries(icons)) {
      const svg = buildSvg(info.body, info.width ?? defaultWidth, info.height ?? defaultHeight);
      svgCache.set(`${prefix}:${name}`, svg);
    }
  }
}

/** Search Iconify API. Returns array of `{ prefix, name }`. */
async function searchIconify(
  query: string,
  prefixes: string[],
  signal?: AbortSignal,
  limit = 64,
): Promise<Array<{ prefix: string; name: string }>> {
  const params = new URLSearchParams({ query, limit: String(limit) });
  if (prefixes.length === 1) {
    params.set('prefix', prefixes[0] as string);
  } else if (prefixes.length > 1) {
    params.set('prefixes', prefixes.join(','));
  }
  const res = await fetch(`${API_BASE}/search?${params}`, { signal: signal ?? null });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.icons ?? []).map((fq: string) => {
    const idx = fq.indexOf(':');
    return { prefix: fq.substring(0, idx), name: fq.substring(idx + 1) };
  });
}

/* ------------------------------------------------------------------ */
/*  Result item interface                                             */
/* ------------------------------------------------------------------ */

interface IconResult {
  /** Display label (semantic name or icon name) */
  label: string;
  /** Fully-qualified icon name: `prefix:name` */
  fqn: string;
  /** The icon set prefix */
  prefix: string;
  /** The raw icon name within the set */
  name: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

type PickerMode = 'semantic' | 'icon-name';

export class WCIconPicker extends BaseElement {
  static formAssociated = true;
  static shadowRootOptions = { ...LitElement.shadowRootOptions, delegatesFocus: true };

  static styles: CSSResultGroup = [
    BaseElement.styles,
    css`
      :host {
        --_columns: var(--icon-picker-columns, 6);
        --_cell-size: var(--icon-picker-cell-size, 3.5rem);
        --_gap: var(--icon-picker-gap, 0.25rem);
        --_radius: var(--icon-picker-radius, 0.375rem);
        --_border-color: var(--icon-picker-border-color, oklch(0.5 0 0 / 0.2));
        --_focus-color: var(--icon-picker-focus-color, oklch(0.6 0.2 250));
        --_icon-size: var(--icon-picker-icon-size, 1.5rem);

        display: none;
        flex-direction: column;
        gap: 0.5rem;
        font-family: inherit;
      }

      :host(:defined) {
        display: flex;
      }

      :host([disabled]) {
        opacity: 0.5;
        pointer-events: none;
      }

      /* -- Controls bar -- */
      .picker__controls {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        flex-wrap: wrap;
      }

      .picker__search {
        flex: 1 1 10rem;
        min-inline-size: 0;
        padding: 0.375rem 0.625rem;
        border: 1px solid var(--_border-color);
        border-radius: var(--_radius);
        font: inherit;
        font-size: 0.875rem;
        background: transparent;
        color: inherit;
      }

      .picker__search:focus-visible {
        outline: 2px solid var(--_focus-color);
        outline-offset: -1px;
      }

      /* -- Mode toggle -- */
      .picker__mode-toggle {
        display: inline-flex;
        border-radius: var(--_radius);
        overflow: hidden;
        border: 1px solid var(--_border-color);
        flex-shrink: 0;
      }

      .picker__mode-btn {
        padding: 0.375rem 0.625rem;
        border: none;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 0.75rem;
        cursor: pointer;
        transition:
          background-color 0.15s ease,
          color 0.15s ease;
      }

      .picker__mode-btn:not(:last-child) {
        border-inline-end: 1px solid var(--_border-color);
      }

      .picker__mode-btn:hover {
        background: oklch(0.5 0 0 / 0.08);
      }

      .picker__mode-btn[aria-pressed='true'] {
        background: oklch(0.25 0.02 260);
        color: oklch(0.95 0 0);
      }

      .picker__mode-btn:focus-visible {
        outline: 2px solid var(--_focus-color);
        outline-offset: 2px;
        z-index: 1;
        position: relative;
      }

      /* -- Set tabs -- */
      .picker__set-tabs {
        display: flex;
        gap: 0.25rem;
        flex-wrap: wrap;
      }

      .picker__set-tab {
        padding: 0.25rem 0.5rem;
        border: 1px solid var(--_border-color);
        border-radius: var(--_radius);
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 0.6875rem;
        cursor: pointer;
        transition: background-color 0.15s ease;
      }

      .picker__set-tab:hover {
        background: oklch(0.5 0 0 / 0.08);
      }

      .picker__set-tab[aria-selected='true'] {
        background: oklch(0.25 0.02 260);
        color: oklch(0.95 0 0);
        border-color: oklch(0.25 0.02 260);
      }

      .picker__set-tab:focus-visible {
        outline: 2px solid var(--_focus-color);
        outline-offset: 2px;
      }

      /* -- Grid -- */
      .picker__grid {
        display: grid;
        grid-template-columns: repeat(var(--_columns), var(--_cell-size));
        gap: var(--_gap);
        max-block-size: 24rem;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 0.25rem;
      }

      .picker__cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.125rem;
        padding: 0.25rem;
        border: 1px solid transparent;
        border-radius: var(--_radius);
        cursor: pointer;
        transition:
          border-color 0.1s ease,
          background-color 0.1s ease;
        inline-size: var(--_cell-size);
        block-size: var(--_cell-size);
        contain: layout style;
      }

      .picker__cell:hover {
        border-color: var(--_border-color);
        background: oklch(0.5 0 0 / 0.05);
      }

      .picker__cell:focus-visible {
        outline: 2px solid var(--_focus-color);
        outline-offset: -1px;
      }

      .picker__cell[aria-selected='true'] {
        border-color: var(--_focus-color);
        background: oklch(0.6 0.2 250 / 0.1);
      }

      .picker__cell-icon {
        inline-size: var(--_icon-size);
        block-size: var(--_icon-size);
        flex-shrink: 0;
      }

      .picker__cell-icon svg {
        inline-size: 100%;
        block-size: 100%;
      }

      .picker__cell-label {
        font-size: 0.5rem;
        line-height: 1.2;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-inline-size: 100%;
      }

      /* -- Status -- */
      .picker__status {
        font-size: 0.75rem;
        color: oklch(0.5 0 0);
        min-block-size: 1.25rem;
      }

      .picker__prompt {
        display: flex;
        align-items: center;
        justify-content: center;
        min-block-size: 6rem;
        color: oklch(0.5 0 0);
        font-size: 0.875rem;
      }

      /* -- Preview -- */
      .picker__preview {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.375rem 0.5rem;
        border: 1px solid var(--_border-color);
        border-radius: var(--_radius);
        font-size: 0.8125rem;
        min-block-size: 2rem;
      }

      .picker__preview-icon {
        inline-size: 1.5rem;
        block-size: 1.5rem;
        flex-shrink: 0;
      }

      .picker__preview-icon svg {
        inline-size: 100%;
        block-size: 100%;
      }

      .picker__preview-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .picker__preview--empty {
        color: oklch(0.5 0 0);
      }

      @media (prefers-reduced-motion: reduce) {
        .picker__mode-btn,
        .picker__set-tab,
        .picker__cell {
          transition: none;
        }
      }
    `,
  ];

  static properties = {
    value: { type: String, reflect: true },
    name: { type: String, reflect: true },
    mode: { type: String, reflect: true },
    sets: { type: String },
    disabled: { type: Boolean, reflect: true },
    columns: { type: Number },
    _query: { type: String, state: true },
    _activeSet: { type: String, state: true },
    _results: { type: Array, state: true },
    _loading: { type: Boolean, state: true },
  };

  declare value: string;
  declare name: string;
  declare mode: PickerMode;
  declare sets: string;
  declare disabled: boolean;
  declare columns: number;
  declare _query: string;
  declare _activeSet: string;
  declare _results: IconResult[];
  declare _loading: boolean;

  #internals: ElementInternals | null = null;
  #abortController: AbortController | null = null;
  #debounceTimer: ReturnType<typeof setTimeout> | null = null;
  #focusIndex = -1;

  constructor() {
    super();
    this.init();
  }

  init() {
    this.value = '';
    this.name = '';
    this.mode = 'semantic';
    this.sets = 'fa7-solid';
    this.disabled = false;
    this.columns = 6;
    this._query = '';
    this._activeSet = '';
    this._results = [];
    this._loading = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#internals = this.attachInternals();
    this.#syncFormValue();
    this.#populateGrid();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#abortController?.abort();
    if (this.#debounceTimer != null) clearTimeout(this.#debounceTimer);
  }

  override updated(changed: PropertyValues): void {
    if (changed.has('value')) {
      this.#syncFormValue();
    }
    if (changed.has('columns')) {
      this.style.setProperty('--_columns', String(this.columns));
    }
  }

  override willUpdate(changed: PropertyValues): void {
    if (changed.has('mode') || changed.has('sets') || changed.has('_activeSet')) {
      this._query = '';
      this.#populateGrid();
    }
  }

  /* -- Form callbacks -- */
  formResetCallback(): void {
    this.value = '';
  }

  formDisabledCallback(disabled: boolean): void {
    this.disabled = disabled;
  }

  #syncFormValue(): void {
    this.#internals?.setFormValue(this.value || null);
  }

  /* -- Set helpers -- */
  #getParsedSets(): string[] {
    return this.sets
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  #getActivePrefixes(): string[] {
    const all = this.#getParsedSets();
    if (this._activeSet && all.includes(this._activeSet)) return [this._activeSet];
    return all;
  }

  /* -- Populate grid -- */
  async #populateGrid(): Promise<void> {
    this.#abortController?.abort();
    const ac = new AbortController();
    this.#abortController = ac;

    if (this.mode === 'semantic') {
      await this.#loadSemanticResults('', ac.signal);
    } else {
      // Icon name mode: show prompt until user searches
      this._results = [];
    }
  }

  /* -- Semantic mode -- */
  async #loadSemanticResults(query: string, signal: AbortSignal): Promise<void> {
    const prefixes = this.#getActivePrefixes();
    const renderPrefix = prefixes[0] ?? 'fa7-solid';
    const mapKey = (prefixToMapKey[renderPrefix] ?? renderPrefix) as IconSet;
    const map = iconMap[mapKey];
    if (!map) {
      this._results = [];
      return;
    }

    const lowerQuery = query.toLowerCase();
    const entries = Object.entries(map);
    const filtered = lowerQuery
      ? entries.filter(
          ([semantic, actual]) => semantic.includes(lowerQuery) || actual.includes(lowerQuery),
        )
      : entries;

    const results: IconResult[] = filtered.map(([semantic, actual]) => ({
      label: semantic,
      fqn: `${renderPrefix}:${actual}`,
      prefix: renderPrefix,
      name: actual,
    }));

    this._results = results;
    this._loading = true;

    // Fetch SVGs for visible results
    try {
      await fetchSvgBatch(
        renderPrefix,
        results.map((r) => r.name),
        signal,
      );
      if (!signal.aborted) {
        this._loading = false;
        this.requestUpdate();
      }
    } catch {
      if (!signal.aborted) this._loading = false;
    }
  }

  /* -- Icon name mode -- */
  async #searchIconName(query: string, signal: AbortSignal): Promise<void> {
    const prefixes = this.#getActivePrefixes();
    this._loading = true;

    try {
      const results = await searchIconify(query, prefixes, signal);
      if (signal.aborted) return;

      this._results = results.map((r) => ({
        label: r.name,
        fqn: `${r.prefix}:${r.name}`,
        prefix: r.prefix,
        name: r.name,
      }));

      // Batch fetch SVGs grouped by prefix
      const byPrefix = new Map<string, string[]>();
      for (const r of results) {
        const arr = byPrefix.get(r.prefix) ?? [];
        arr.push(r.name);
        byPrefix.set(r.prefix, arr);
      }
      for (const [prefix, names] of byPrefix) {
        await fetchSvgBatch(prefix, names, signal);
      }
      if (!signal.aborted) {
        this._loading = false;
        this.requestUpdate();
      }
    } catch {
      if (!signal.aborted) {
        this._loading = false;
        this._results = [];
      }
    }
  }

  /* -- Debounced search -- */
  #debouncedSearch(query: string): void {
    if (this.#debounceTimer != null) clearTimeout(this.#debounceTimer);
    this.#abortController?.abort();
    const ac = new AbortController();
    this.#abortController = ac;

    if (!query.trim()) {
      if (this.mode === 'semantic') {
        this.#loadSemanticResults('', ac.signal);
      } else {
        this._results = [];
        this._loading = false;
      }
      return;
    }

    this.#debounceTimer = setTimeout(() => {
      if (this.mode === 'semantic') {
        this.#loadSemanticResults(query, ac.signal);
      } else {
        this.#searchIconName(query, ac.signal);
      }
    }, 300);
  }

  /* -- Event handlers -- */
  #onSearchInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    this._query = input.value;
    this.#focusIndex = -1;
    this.#debouncedSearch(this._query);
  }

  #onModeToggle(newMode: PickerMode): void {
    if (this.mode === newMode) return;
    this.mode = newMode;
    this.#focusIndex = -1;
    this.dispatchEvent(
      new CustomEvent('icon-picker-mode-change', {
        detail: { mode: this.mode },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #onSetChange(prefix: string): void {
    this._activeSet = prefix;
    this.#focusIndex = -1;
  }

  #onCellClick(result: IconResult): void {
    this.value = result.fqn;
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  #onGridKeydown(e: KeyboardEvent): void {
    const cells = this.shadowRoot?.querySelectorAll<HTMLElement>('.picker__cell');
    if (!cells || cells.length === 0) return;
    const cols = this.columns;
    const total = cells.length;
    let idx = this.#focusIndex;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        idx = idx < total - 1 ? idx + 1 : 0;
        break;
      case 'ArrowLeft':
        e.preventDefault();
        idx = idx > 0 ? idx - 1 : total - 1;
        break;
      case 'ArrowDown':
        e.preventDefault();
        idx = idx + cols < total ? idx + cols : idx;
        break;
      case 'ArrowUp':
        e.preventDefault();
        idx = idx - cols >= 0 ? idx - cols : idx;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (idx >= 0 && idx < total) {
          const result = this._results[idx];
          if (result) this.#onCellClick(result);
        }
        return;
      case 'Home':
        e.preventDefault();
        idx = 0;
        break;
      case 'End':
        e.preventDefault();
        idx = total - 1;
        break;
      default:
        return;
    }

    this.#focusIndex = idx;
    cells[idx]?.focus();
    // Dispatch input event for preview during navigation
    const result = this._results[idx];
    if (result) {
      this.value = result.fqn;
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
  }

  /* -- Render -- */
  render() {
    const parsedSets = this.#getParsedSets();
    const showSetTabs = parsedSets.length > 1;
    const selectedSvg = svgCache.get(this.value) ?? '';

    return html`
      <!-- Preview -->
      <div class="picker__preview ${this.value ? '' : 'picker__preview--empty'}" part="preview">
        ${this.value
          ? html`
              <span class="picker__preview-icon" part="preview-icon"
                >${this.#renderSvg(selectedSvg)}</span
              >
              <span class="picker__preview-label">${this.value}</span>
            `
          : html`<span>No icon selected</span>`}
      </div>

      <!-- Controls -->
      <div class="picker__controls">
        <input
          class="picker__search"
          part="search"
          type="search"
          role="searchbox"
          aria-label="Search icons"
          placeholder=${this.mode === 'semantic' ? 'Filter semantic names...' : 'Search icons...'}
          .value=${this._query}
          @input=${this.#onSearchInput}
        />
        <div class="picker__mode-toggle" part="mode-toggle" role="group" aria-label="Display mode">
          <button
            class="picker__mode-btn"
            type="button"
            aria-pressed=${this.mode === 'semantic'}
            @click=${() => this.#onModeToggle('semantic')}
          >
            Semantic
          </button>
          <button
            class="picker__mode-btn"
            type="button"
            aria-pressed=${this.mode === 'icon-name'}
            @click=${() => this.#onModeToggle('icon-name')}
          >
            Icon Name
          </button>
        </div>
      </div>

      <!-- Set tabs -->
      ${showSetTabs
        ? html`
            <div class="picker__set-tabs" part="set-tabs" role="tablist" aria-label="Icon sets">
              <button
                class="picker__set-tab"
                role="tab"
                aria-selected=${!this._activeSet}
                @click=${() => this.#onSetChange('')}
              >
                All
              </button>
              ${parsedSets.map(
                (prefix) => html`
                  <button
                    class="picker__set-tab"
                    role="tab"
                    aria-selected=${this._activeSet === prefix}
                    @click=${() => this.#onSetChange(prefix)}
                  >
                    ${prefix}
                  </button>
                `,
              )}
            </div>
          `
        : nothing}

      <!-- Status -->
      <div class="picker__status" role="status" aria-live="polite">
        ${this._loading
          ? 'Loading...'
          : this._results.length > 0
            ? `${this._results.length} icon${this._results.length !== 1 ? 's' : ''}`
            : ''}
      </div>

      <!-- Grid or prompt -->
      ${this._results.length > 0
        ? html`
            <div
              class="picker__grid"
              part="grid"
              role="listbox"
              aria-label="Icon results"
              @keydown=${this.#onGridKeydown}
            >
              ${this._results.map((result, i) => {
                const svg = svgCache.get(result.fqn) ?? '';
                return html`
                  <div
                    class="picker__cell"
                    part="cell"
                    role="option"
                    tabindex=${i === 0 ? '0' : '-1'}
                    aria-selected=${this.value === result.fqn}
                    aria-label=${result.label}
                    title="${result.label}${this.mode === 'semantic' ? ` (${result.name})` : ''}"
                    @click=${() => this.#onCellClick(result)}
                    @focus=${() => {
                      this.#focusIndex = i;
                    }}
                  >
                    <span class="picker__cell-icon" part="cell-icon">${this.#renderSvg(svg)}</span>
                    <span class="picker__cell-label" part="cell-label">${result.label}</span>
                  </div>
                `;
              })}
            </div>
          `
        : html`
            <div class="picker__prompt">
              ${this.mode === 'icon-name' && !this._query
                ? 'Type to search icons'
                : this._query && !this._loading
                  ? 'No results found'
                  : this._loading
                    ? 'Loading...'
                    : ''}
            </div>
          `}
    `;
  }

  /** Render trusted SVG string from the Iconify API cache. */
  #renderSvg(svgString: string) {
    if (!svgString) return nothing;
    return unsafeHTML(svgString);
  }
}

if (!customElements.get('wc-icon-picker')) {
  customElements.define('wc-icon-picker', WCIconPicker);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-icon-picker': WCIconPicker;
  }
}
