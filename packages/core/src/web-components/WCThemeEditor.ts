/**
 * `<wc-theme-editor>` — live design-system editor.
 *
 * Every token the generator emits lands on `:root` as a CSS custom property, so a
 * page built with the framework is already fully variable-driven. This element
 * layers runtime overrides on top via a single injected `<style id="ds-overrides">`
 * — no rebuild, instant preview. It reads the editable surface from
 * `design-manifest.json` (emitted by `@getvitops/generator` for the `css` format),
 * renders native controls styled by the framework's own patterns, persists edits to
 * localStorage, and exports them as CSS or as a `design-system.json` patch. When a
 * dev server is running `@getvitops/vite`, **Save to source** writes that patch
 * straight into the consumer's config and the plugin regenerates.
 *
 * The override layers map 1:1 to the framework's own var cascade:
 *   palette    → --color-<hue>-<step>
 *   roles      → --<role>-<token> / --color-<role>-<stop>   (via colors.roleTokens)
 *   typography → --<role>-<hook>                            (ff/fs/fw/lh/ls/tt/…)
 *   spacing    → --space-<name>
 *   defaults   → --<prop>-default                           (ds/b/br/p/fs)
 *   groups     → --<prop>-<group>
 *   components → --<prop>-<item>                            (the BASE_HOOK vars)
 * The cascade *between* layers is already encoded in the generated var() fallback
 * chains, so overrides only need keying by full var name — they never collide.
 *
 * Two things about colour that the previous iteration of this editor got wrong, and
 * which are easy to get wrong again:
 *
 *  • **`--color-<role>-<step>` does not exist.** A role is not a ramp alias; it
 *    resolves to *functional* tokens (`--<role>-bg`, `--<role>-solid`, …). Two of
 *    them can't be derived client-side — `solid` scans for the hue's natural 500
 *    and clamps, and `on-solid` is a computed contrast literal — which is why the
 *    manifest ships `colors.roleTokens` precomputed per hue.
 *  • **Palette hexes are scheme-global.** The dark block never redefines
 *    `--color-<hue>-<step>`; it only re-points which step each functional token
 *    reads. So a hue edit belongs in `:root`, never in the dark block.
 *
 * Not a progressive-enhancement component (there is no meaningful no-JS fallback
 * for a live editor), which is why it ships in its own opt-in bundle
 * (`@getvitops/core/editor`) rather than in `elements.js`. It renders into the
 * light DOM so the framework CSS styles its chrome — the panel is itself a dogfood
 * surface, built from `.drawer`, `.details`, `.form-group`, `.btn`, `.cluster-*`.
 */

type Scheme = 'light' | 'dark';

/**
 * Which shape of token set a role has. A surface role carries a bare `bg` and the
 * full emphasis range; a chromatic role carries tints plus the solid family and
 * deliberately no bare `bg`. The two are different sets, so a remap has to know
 * which one it is copying.
 */
type RoleKind = 'surface' | 'chromatic';

/** token → CSS value, for one appearance. */
type TokenMap = Record<string, string>;
interface RoleVariant {
  light: TokenMap;
  dark: TokenMap;
}

interface Manifest {
  colors: {
    ramps: string[];
    steps: string[];
    palette: Record<string, Record<string, string>>;
    roles: { name: string; ramp: string; kind: RoleKind }[];
    roleTokens: Record<string, Record<RoleKind, RoleVariant>>;
  };
  typography: {
    roles: string[];
    hooks: Record<string, { prop: string; key: string }>;
    families: Record<string, string>;
    specs: Record<string, Record<string, string | number>>;
  };
  scales: {
    text: { name: string; value: string; max: string }[];
    space: { name: string; value: string; max: string }[];
  };
  fonts: Record<string, string>;
  patterns: {
    defaults: Record<string, string>;
    radii: Record<string, string>;
    groups: Record<string, Record<string, string>>;
    items: {
      name: string;
      group: string | null;
      base: Record<string, string>;
      wrappable: { sfx: string; prop: string }[];
      roles: string[];
    }[];
  };
  shadows: Record<string, string>;
  reverseIndex: Record<string, string>;
}

const STORAGE_KEY = 'vitops:ds-overrides';
/** Shared with `<wc-color-scheme-toggle>` — the two must not fight over the scheme. */
const SCHEME_KEY = 'vitops-color-scheme';
/**
 * Both attributes, matching the generator's own DARK_SEL: `data-brx-theme` is
 * Bricks', `data-theme` is what `<wc-color-scheme-toggle>` writes. Overrides have to
 * match wherever the page's own dark block does.
 */
const DARK_SELECTOR = ':root[data-brx-theme="dark"], :root[data-theme="dark"]';
const SAVE_URL = '/__vitops/design-system';

/**
 * Role-token var name — mirrors the generator's `tokenVar()`.
 *
 * Keys are `<target>[-<variant>]` and the role goes in the MIDDLE:
 * `bg-muted` + `danger` → `--color-bg-danger-muted`. `on` is the irregular one —
 * the role follows it, because the token names what it sits on rather than what
 * it is.
 */
const fnVar = (role: string, token: string): string => {
  const dash = token.indexOf('-');
  const target = dash === -1 ? token : token.slice(0, dash);
  const variant = dash === -1 ? '' : token.slice(dash + 1);
  if (variant === 'on') return `--color-${target}-on-${role}`;
  if (variant.startsWith('on-')) return `--color-${target}-on-${role}-${variant.slice(3)}`;
  return variant ? `--color-${target}-${role}-${variant}` : `--color-${target}-${role}`;
};

const stepVar = (hue: string, step: string): string => `--color-${hue}-${step}`;

export class WCThemeEditor extends HTMLElement {
  /** URL of the generator's design-manifest.json. */
  static observedAttributes = ['manifest'];

  // ── override store ────────────────────────────────────────────────────────
  // Two maps (one per scheme) → one <style> block. Light writes `:root`, dark the
  // higher-specificity dark selector so it wins only in dark. `roles` is kept
  // separately: a role remap writes ~28 vars, but exports as one `colors.roles`
  // entry, and reverse-parsing 28 var() values to recover that is guesswork.
  private store: Record<Scheme, Map<string, string>> = { light: new Map(), dark: new Map() };
  private roles = new Map<string, string>();
  /** Var names currently owned by a role remap — excluded from the var-wise patch. */
  private roleVars = new Set<string>();
  private styleEl?: HTMLStyleElement;
  private syncers = new Set<() => void>();
  private manifest?: Manifest;
  private scheme: Scheme = 'light';
  private canSave = false;

  connectedCallback(): void {
    void this.boot();
  }

  private async boot(): Promise<void> {
    const url = this.getAttribute('manifest') ?? '/vitops/design-manifest.json';
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`manifest ${res.status}`);
      this.manifest = (await res.json()) as Manifest;
    } catch (err) {
      console.warn(`[wc-theme-editor] manifest unavailable at ${url} — editor disabled`, err);
      return;
    }

    this.styleEl = document.createElement('style');
    this.styleEl.id = 'ds-overrides';
    document.head.append(this.styleEl); // appended last → wins on equal specificity

    this.hydrate();
    this.render();
    this.scheme = this.currentScheme();
    // Someone else (the scheme toggle) may flip the page out from under us.
    new MutationObserver(() => {
      const next = this.currentScheme();
      if (next === this.scheme) return;
      this.scheme = next;
      this.syncers.forEach((fn) => fn());
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    this.canSave = await this.probeSave();
    this.build(this.manifest);
  }

  /** Is a `@getvitops/vite` dev server listening? Absent on any static build. */
  private async probeSave(): Promise<boolean> {
    try {
      const res = await fetch(SAVE_URL);
      if (!res.ok) return false;
      return ((await res.json()) as { writable?: boolean }).writable === true;
    } catch {
      return false;
    }
  }

  // ── store plumbing ────────────────────────────────────────────────────────
  private block(selector: string, entries: Map<string, string>): string {
    if (!entries.size) return '';
    const body = [...entries].map(([name, value]) => `  ${name}: ${value};`).join('\n');
    return `${selector} {\n${body}\n}\n`;
  }

  private serializeCSS(): string {
    return this.block(':root', this.store.light) + this.block(DARK_SELECTOR, this.store.dark);
  }

  private render(): void {
    if (this.styleEl) this.styleEl.textContent = this.serializeCSS();
  }

  private persist(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          light: [...this.store.light],
          dark: [...this.store.dark],
          roles: [...this.roles],
        }),
      );
    } catch {
      /* storage unavailable (private mode) — overrides still apply in-session */
    }
  }

  private hydrate(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as {
        light?: [string, string][];
        dark?: [string, string][];
        roles?: [string, string][];
      };
      this.store.light = new Map(data.light ?? []);
      this.store.dark = new Map(data.dark ?? []);
      this.roles = new Map(data.roles ?? []);
      // Rebuild the var-ownership set from the (deterministic) role → hue map.
      for (const [role, hue] of this.roles) this.markRoleVars(role, hue);
    } catch {
      /* corrupt payload — start clean */
    }
  }

  private setOverride(varName: string, value: string | null, scheme: Scheme): void {
    const map = this.store[scheme];
    if (value == null || value === '') map.delete(varName);
    else map.set(varName, value);
    this.render();
    this.persist();
  }

  /**
   * Effective value of a var in a scheme: its own override, else (for dark) the
   * light override, else the manifest default the control was seeded with.
   */
  private effective(varName: string, scheme: Scheme, fallback: string): string {
    if (this.store[scheme].has(varName)) return this.store[scheme].get(varName) as string;
    if (scheme === 'dark' && this.store.light.has(varName))
      return this.store.light.get(varName) as string;
    return fallback;
  }

  private reset(): void {
    this.store.light.clear();
    this.store.dark.clear();
    this.roles.clear();
    this.roleVars.clear();
    this.render();
    this.persist();
    this.syncers.forEach((fn) => fn());
  }

  // ── scheme ────────────────────────────────────────────────────────────────
  private currentScheme(): Scheme {
    const root = document.documentElement;
    return root.dataset.theme === 'dark' || root.getAttribute('data-brx-theme') === 'dark'
      ? 'dark'
      : 'light';
  }

  /** Drive the *same* attribute + storage key as `<wc-color-scheme-toggle>`. */
  private setScheme(next: Scheme): void {
    this.scheme = next;
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = `${next} only`;
    try {
      localStorage.setItem(SCHEME_KEY, next);
    } catch {
      /* non-fatal */
    }
    this.syncers.forEach((fn) => fn());
  }

  // ── role remapping ────────────────────────────────────────────────────────
  private roleTokenNames(m: Manifest, role: string, hue: string): [string, string, Scheme][] {
    // The kind travels with the role in the manifest. It used to be inferred as
    // `role === 'surface'`, which quietly gave the wrong token set to every other
    // surface-kind role — `neutral`, or a consumer's own `canvas`.
    const kind = m.colors.roles.find((r) => r.name === role)?.kind ?? 'chromatic';
    const variant = m.colors.roleTokens?.[hue]?.[kind];
    if (!variant) return [];
    const out: [string, string, Scheme][] = [];
    for (const scheme of ['light', 'dark'] as Scheme[])
      for (const [token, value] of Object.entries(variant[scheme]))
        out.push([fnVar(role, token), value, scheme]);
    return out;
  }

  private markRoleVars(role: string, hue: string): void {
    if (!this.manifest) return;
    for (const [name] of this.roleTokenNames(this.manifest, role, hue)) this.roleVars.add(name);
  }

  /**
   * Point a semantic role at another hue by rewriting its whole functional token
   * set, in BOTH appearances — the light/dark split is which step each token
   * reads, so remapping only the current scheme would half-apply.
   */
  private remapRole(m: Manifest, role: string, hue: string): void {
    const entries = this.roleTokenNames(m, role, hue);
    if (!entries.length) return;
    this.roles.set(role, hue);
    for (const [name, value, scheme] of entries) {
      this.roleVars.add(name);
      this.store[scheme].set(name, value);
    }
    this.render();
    this.persist();
  }

  // ── JSON patch export ─────────────────────────────────────────────────────
  private deepSet(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.');
    let node = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i] as string;
      if (typeof node[k] !== 'object' || node[k] == null) node[k] = {};
      node = node[k] as Record<string, unknown>;
    }
    node[keys[keys.length - 1] as string] = value;
  }

  /**
   * Map overrides back to `design-system.json` paths, producing a partial that
   * deep-merges into source. Role remaps collapse to one `colors.roles` entry;
   * everything else goes through the manifest's reverseIndex. Dark-block edits are
   * runtime-only (the schema has no per-scheme values — dark is derived), so they
   * are reported as skipped rather than silently dropped.
   */
  private buildPatch(m: Manifest): { patch: Record<string, unknown>; skipped: string[] } {
    const patch: Record<string, unknown> = {};
    const skipped: string[] = [];
    // Written as the object form, always. A bare hue string is the shorthand for
    // `kind: "chromatic"`, so patching one over a surface role would silently
    // demote it and strip its bare `bg-<role>` on the next build.
    for (const [role, hue] of this.roles) {
      const kind = m.colors.roles.find((r) => r.name === role)?.kind ?? 'chromatic';
      this.deepSet(patch, `colors.roles.${role}`, { hue, kind });
    }
    for (const [varName, value] of this.store.light) {
      if (this.roleVars.has(varName)) continue; // already covered by colors.roles
      const path = m.reverseIndex[varName];
      if (path) this.deepSet(patch, path, value);
      else skipped.push(varName);
    }
    for (const varName of this.store.dark.keys())
      if (!this.roleVars.has(varName)) skipped.push(`${varName} (dark)`);
    return { patch, skipped };
  }

  // ── DOM helpers ───────────────────────────────────────────────────────────
  private el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs: Record<string, string | boolean> = {},
    children: (Node | string)[] = [],
  ): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    const e = node as HTMLElement;
    for (const [k, v] of Object.entries(attrs)) {
      if (v === true) e.setAttribute(k, '');
      else if (v !== false) e.setAttribute(k, String(v));
    }
    for (const c of children) e.append(c);
    return node;
  }

  /**
   * A labelled control row. `label` is the full var name; the `--` prefix is
   * dropped for display and kept as the tooltip. `sync` re-reads the store so
   * scheme switches, reset and hydration all stay reflected in the UI.
   */
  private row(label: string, control: HTMLElement, sync: () => void): HTMLElement {
    this.syncers.add(sync);
    sync();
    return this.el('label', { class: 'ed-row' }, [
      this.el('span', { class: 'ed-label', title: label }, [label.replace(/^--/, '')]),
      control,
    ]);
  }

  private textInput(varName: string, fallback: string, placeholder = ''): HTMLElement {
    const input = this.el('input', { type: 'text', class: 'ed-input' });
    input.addEventListener('input', () =>
      this.setOverride(varName, input.value.trim() || null, this.scheme),
    );
    return this.row(varName, input, () => {
      input.value = this.store[this.scheme].get(varName) ?? '';
      input.placeholder = placeholder || fallback;
    });
  }

  /** Palette hexes are scheme-global, so these always write the light block. */
  private colorInput(varName: string, hex: string): HTMLElement {
    const picker = this.el('input', { type: 'color', class: 'ed-color' });
    const text = this.el('input', { type: 'text', class: 'ed-input ed-mono' });
    const commit = (v: string): void => this.setOverride(varName, v || null, 'light');
    picker.addEventListener('input', () => {
      text.value = picker.value;
      commit(picker.value);
    });
    text.addEventListener('input', () => {
      if (/^#[0-9a-f]{6}$/i.test(text.value)) picker.value = text.value;
      commit(text.value.trim());
    });
    const wrap = this.el('span', { class: 'ed-pair' }, [picker, text]);
    return this.row(varName, wrap, () => {
      const v = this.store.light.get(varName) ?? hex;
      text.value = v;
      if (/^#[0-9a-f]{6}$/i.test(v)) picker.value = v;
    });
  }

  private selectInput(varName: string, options: { label: string; value: string }[]): HTMLElement {
    const select = this.el('select', { class: 'ed-input' });
    select.append(this.el('option', { value: '' }, ['— default —']));
    for (const o of options) select.append(this.el('option', { value: o.value }, [o.label]));
    select.addEventListener('change', () =>
      this.setOverride(varName, select.value || null, this.scheme),
    );
    return this.row(varName, select, () => {
      select.value = this.store[this.scheme].get(varName) ?? '';
    });
  }

  /**
   * Range + rem readout for a scale step. Writes a plain rem — trading the
   * generated fluid clamp for a knob you can actually see move.
   */
  private remSlider(varName: string, maxRem: string): HTMLElement {
    const base = parseFloat(maxRem) || 1;
    const range = this.el('input', {
      type: 'range',
      class: 'ed-range',
      min: '0',
      max: String(Math.max(4, Math.ceil(base * 2))),
      step: '0.05',
    });
    const out = this.el('output', { class: 'ed-out' });
    range.addEventListener('input', () => {
      out.textContent = `${range.value}rem`;
      this.setOverride(varName, `${range.value}rem`, this.scheme);
    });
    const wrap = this.el('span', { class: 'ed-pair' }, [range, out]);
    return this.row(varName, wrap, () => {
      range.value = String(parseFloat(this.effective(varName, this.scheme, maxRem)) || base);
      out.textContent = this.store[this.scheme].get(varName) ?? 'auto';
    });
  }

  /**
   * General numeric slider. `toValue` maps the slider number to the CSS value
   * written; `fromValue` recovers it (defaults to a leading-number parse).
   */
  private slider(
    varName: string,
    opts: {
      min: number;
      max: number;
      step: number;
      def: number;
      unit?: string;
      toValue?: (n: number) => string;
      fromValue?: (stored: string) => number;
    },
  ): HTMLElement {
    const toValue = opts.toValue ?? ((n: number): string => `${n}${opts.unit ?? ''}`);
    const fromValue =
      opts.fromValue ??
      ((s: string): number => (Number.isNaN(parseFloat(s)) ? opts.def : parseFloat(s)));
    const range = this.el('input', {
      type: 'range',
      class: 'ed-range',
      min: String(opts.min),
      max: String(opts.max),
      step: String(opts.step),
    });
    const out = this.el('output', { class: 'ed-out' });
    range.addEventListener('input', () => {
      const val = toValue(parseFloat(range.value));
      out.textContent = val;
      this.setOverride(varName, val, this.scheme);
    });
    const wrap = this.el('span', { class: 'ed-pair' }, [range, out]);
    return this.row(varName, wrap, () => {
      const stored = this.store[this.scheme].get(varName);
      range.value = String(stored != null ? fromValue(stored) : opts.def);
      out.textContent = stored ?? `${opts.def}${opts.unit ?? ''}`;
    });
  }

  /**
   * A collapsible section.
   *
   * The `.details` pattern removes the native disclosure marker (`list-style:
   * none` + `::marker { content: none }`) and expects a `.details-icon` element
   * in the summary, which it rotates 90° on open. Omitting it leaves rows that
   * are collapsible but don't look it — a real problem here, where the panel is
   * ~40 nested sections deep and the only affordance is the pointer cursor.
   * `--marker-start` puts it before the label, which reads better for a tree.
   */
  private section(title: string, open = false): { details: HTMLDetailsElement; body: HTMLElement } {
    const body = this.el('div', { class: 'ed-body rhythm' });
    const details = this.el(
      'details',
      { class: 'details details--marker-start ed-section', ...(open ? { open: true } : {}) },
      [
        this.el('summary', { class: 'font-eyebrow' }, [
          this.el('span', {
            class: 'icon-mask details-icon ed-icon ed-icon--caret',
            'aria-hidden': 'true',
          }),
          title,
        ]),
        body,
      ],
    ) as HTMLDetailsElement;
    return { details, body };
  }

  private hint(text: string): HTMLElement {
    return this.el('p', { class: 'font-footnote text-surface-x-muted' }, [text]);
  }

  private sub(title: string): { details: HTMLDetailsElement; body: HTMLElement } {
    const s = this.section(title);
    s.details.classList.add('ed-sub');
    return s;
  }

  // ── sections ──────────────────────────────────────────────────────────────
  private buildPalette(m: Manifest): HTMLElement {
    const { details, body } = this.section('Palette', true);
    body.append(
      this.hint(
        'Hues feed the semantic roles below — edit a hue and every role mapped to it follows. ' +
          'Hue edits are scheme-global: dark mode re-points which step a token reads, it never ' +
          'redefines the hue itself.',
      ),
    );
    for (const hue of m.colors.ramps) {
      const sub = this.sub(hue);
      for (const step of m.colors.steps) {
        const hex = m.colors.palette[hue]?.[step];
        if (hex == null) continue;
        sub.body.append(this.colorInput(stepVar(hue, step), hex));
      }
      body.append(sub.details);
    }
    body.append(this.buildRoles(m));
    return details;
  }

  private buildRoles(m: Manifest): HTMLElement {
    const { details, body } = this.sub('Semantic roles');
    body.append(
      this.hint(
        'Point a role at another hue — its whole functional token set (bg / border / solid / ' +
          'on-solid / text) is rewritten for both appearances.',
      ),
    );
    const hues = m.colors.ramps;
    for (const { name: role, ramp } of m.colors.roles) {
      const select = this.el('select', { class: 'ed-input' });
      for (const h of hues) select.append(this.el('option', { value: h }, [h]));
      select.addEventListener('change', () => this.remapRole(m, role, select.value));
      body.append(
        this.row(`--${role}`, select, () => {
          select.value = this.roles.get(role) ?? ramp;
        }),
      );
    }
    return details;
  }

  private buildTypography(m: Manifest): HTMLElement {
    const { details, body } = this.section('Typography');
    const fontOpts = Object.keys(m.fonts).map((k) => ({ label: k, value: `var(--font-${k})` }));
    const sizeOpts = m.scales.text.map((s) => ({ label: s.name, value: `var(--text-${s.name})` }));
    const enumOpts: Record<string, string[]> = {
      tt: ['none', 'uppercase', 'lowercase', 'capitalize'],
      fst: ['normal', 'italic', 'oblique'],
      td: ['none', 'underline', 'line-through'],
      tw: ['wrap', 'balance', 'pretty', 'nowrap'],
    };
    for (const role of m.typography.roles) {
      const spec = m.typography.specs[role] ?? {};
      const sub = this.sub(role);
      // Drive the control set off the manifest's hook table so a new typographic
      // property shows up here without touching this file.
      for (const [sfx, { key }] of Object.entries(m.typography.hooks)) {
        const varName = `--${role}-${sfx}`;
        const current = spec[key] == null ? '' : String(spec[key]);
        if (sfx === 'ff') sub.body.append(this.selectInput(varName, fontOpts));
        else if (sfx === 'fs') sub.body.append(this.selectInput(varName, sizeOpts));
        else if (enumOpts[sfx])
          sub.body.append(
            this.selectInput(
              varName,
              (enumOpts[sfx] as string[]).map((v) => ({ label: v, value: v })),
            ),
          );
        else sub.body.append(this.textInput(varName, current, current || key));
      }
      body.append(sub.details);
    }
    return details;
  }

  private buildSpacing(m: Manifest): HTMLElement {
    const { details, body } = this.section('Spacing');
    body.append(
      this.hint(
        'Each step overrides to a fixed rem (dropping the fluid clamp). Reset restores it.',
      ),
    );
    for (const s of m.scales.space) body.append(this.remSlider(`--space-${s.name}`, s.max));
    return details;
  }

  /**
   * Structural knobs that live in the framework's own `layout.css` `:root` rather
   * than in the manifest: the vertical-rhythm dial and the `.centered` tracks.
   */
  private buildLayout(): HTMLElement {
    const { details, body } = this.section('Layout');
    body.append(this.hint('Vertical rhythm and the .centered track widths — global structure.'));
    body.append(
      this.slider('--rhythm-scale', { min: 0.5, max: 2.5, step: 0.05, def: 1 }),
      this.slider('--width-measure', { min: 30, max: 110, step: 1, def: 65, unit: 'ch' }),
      this.slider('--width-breakout', { min: 40, max: 150, step: 1, def: 90, unit: 'ch' }),
      this.slider('--width-spotlight', { min: 60, max: 200, step: 1, def: 120, unit: 'ch' }),
      this.slider('--gutter', {
        min: 0,
        max: 6,
        step: 0.1,
        def: 3,
        toValue: (n) => `clamp(1rem, 4cqi, ${n}rem)`,
        fromValue: (s) => {
          const mm = /clamp\([^,]+,[^,]+,\s*([\d.]+)/.exec(s);
          return mm ? parseFloat(mm[1] as string) : 3;
        },
      }),
    );
    return details;
  }

  private buildPatterns(m: Manifest): HTMLElement[] {
    const defaults = this.section('Pattern defaults');
    for (const [prop, val] of Object.entries(m.patterns.defaults))
      defaults.body.append(this.textInput(`--${prop}-default`, val, val));

    const radii = this.section('Radii');
    for (const [name, val] of Object.entries(m.patterns.radii))
      radii.body.append(this.textInput(`--br-${name}`, val, val));

    const groups = this.section('Pattern groups');
    for (const [group, props] of Object.entries(m.patterns.groups)) {
      const sub = this.sub(group);
      for (const [prop, val] of Object.entries(props))
        sub.body.append(this.textInput(`--${prop}-${group}`, val, val));
      groups.body.append(sub.details);
    }

    const components = this.section('Components');
    components.body.append(
      this.hint('Per-component geometry — overrides the group defaults for just this component.'),
    );
    for (const item of m.patterns.items) {
      if (!item.wrappable.length) continue;
      const sub = this.sub(item.name);
      for (const { sfx, prop } of item.wrappable) {
        const val = item.base[prop] ?? '';
        sub.body.append(this.textInput(`--${sfx}-${item.name}`, val, val));
      }
      components.body.append(sub.details);
    }

    const shadows = this.section('Shadows');
    for (const [name, val] of Object.entries(m.shadows))
      shadows.body.append(this.textInput(`--shadow-${name}`, val, val));

    return [defaults.details, radii.details, groups.details, components.details, shadows.details];
  }

  // ── toolbar ───────────────────────────────────────────────────────────────
  private async flash(btn: HTMLElement, text: string): Promise<void> {
    const label = btn.textContent;
    btn.textContent = text;
    setTimeout(() => (btn.textContent = label), 1400);
  }

  private async copy(text: string, btn: HTMLElement): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      void this.flash(btn, 'Copied ✓');
    } catch {
      void this.flash(btn, 'Copy failed');
    }
  }

  private async save(m: Manifest, btn: HTMLElement): Promise<void> {
    const { patch } = this.buildPatch(m);
    if (!Object.keys(patch).length) return void this.flash(btn, 'Nothing to save');
    try {
      const res = await fetch(SAVE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ patch }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { errors?: string[] };
        console.error('[wc-theme-editor] save rejected', body.errors ?? res.statusText);
        return void this.flash(btn, 'Rejected ✗');
      }
      // The write lands in source; the dev server regenerates and full-reloads,
      // at which point these overrides would double up on the new baseline.
      this.reset();
      void this.flash(btn, 'Saved ✓');
    } catch (err) {
      console.error('[wc-theme-editor] save failed', err);
      void this.flash(btn, 'Failed ✗');
    }
  }

  private buildToolbar(m: Manifest): HTMLElement {
    const bar = this.el('div', { class: 'cluster-start ed-toolbar' });

    const light = this.el('button', { type: 'button', class: 'btn ed-seg' }, ['Light']);
    const dark = this.el('button', { type: 'button', class: 'btn ed-seg' }, ['Dark']);
    const reflect = (): void => {
      light.classList.toggle('is-active', this.scheme === 'light');
      dark.classList.toggle('is-active', this.scheme === 'dark');
    };
    this.syncers.add(reflect);
    light.addEventListener('click', () => this.setScheme('light'));
    dark.addEventListener('click', () => this.setScheme('dark'));
    reflect();
    bar.append(this.el('span', { class: 'ed-segwrap', role: 'group' }, [light, dark]));

    const cssBtn = this.el('button', { type: 'button', class: 'btn' }, ['Copy CSS']);
    cssBtn.addEventListener('click', () =>
      this.copy(this.serializeCSS() || '/* no overrides yet */', cssBtn),
    );

    const jsonBtn = this.el('button', { type: 'button', class: 'btn' }, ['Copy JSON patch']);
    jsonBtn.addEventListener('click', () => {
      const { patch, skipped } = this.buildPatch(m);
      const note = skipped.length
        ? `\n// runtime-only (no source mapping): ${skipped.join(', ')}`
        : '';
      void this.copy(JSON.stringify(patch, null, 2) + note, jsonBtn);
    });

    bar.append(cssBtn, jsonBtn);

    if (this.canSave) {
      const saveBtn = this.el('button', { type: 'button', class: 'cta' }, ['Save to source']);
      saveBtn.addEventListener('click', () => void this.save(m, saveBtn));
      bar.append(saveBtn);
    }

    const resetBtn = this.el('button', { type: 'button', class: 'btn ed-danger' }, ['Reset all']);
    resetBtn.addEventListener('click', () => this.reset());
    bar.append(resetBtn);
    return bar;
  }

  // ── panel ─────────────────────────────────────────────────────────────────
  private build(m: Manifest): void {
    const id = 'ds-editor-panel';
    // `manual`, not `auto`: an auto popover light-dismisses on the first click
    // outside it, and clicking the page is the entire point of a live editor —
    // you tune a token, then go poke the thing you just changed. `--modeless`
    // drops the scrim for the same reason: you can't judge a colour through a
    // blur. The cost of `manual` is losing built-in Esc, so it's wired below.
    const panel = this.el('div', {
      id,
      popover: 'manual',
      class: 'drawer drawer--right drawer--modeless ed-panel bg-surface text-surface rhythm',
      'aria-label': 'Design-system editor',
    });

    panel.append(
      this.el('header', { class: 'cluster-between' }, [
        this.el('strong', { class: 'font-heading' }, ['Theme editor']),
        (() => {
          const close = this.el(
            'button',
            { type: 'button', class: 'btn', popovertarget: id, popovertargetaction: 'hide' },
            [
              this.el('span', {
                class: 'icon-mask ed-icon ed-icon--close',
                'aria-hidden': 'true',
              }),
            ],
          );
          close.setAttribute('aria-label', 'Close editor');
          return close;
        })(),
      ]),
      this.buildToolbar(m),
      this.buildPalette(m),
      this.buildTypography(m),
      this.buildSpacing(m),
      this.buildLayout(),
      ...this.buildPatterns(m),
    );

    // The icon is a masked SVG, not the palette emoji it replaced: an emoji is
    // text, so it renders as a different picture on every platform (and as a
    // monochrome outline on some). `.cta` is already inline-flex with a gap, so
    // the icon is simply the first child.
    const launcher = this.el(
      'button',
      { type: 'button', class: 'cta ed-launch', popovertarget: id },
      [
        this.el('span', { class: 'icon-mask ed-icon ed-icon--theme', 'aria-hidden': 'true' }),
        'Theme',
      ],
    );

    // Esc, which `popover="manual"` doesn't give us. Bound on the document so it
    // works while focus is out on the page — the panel is modeless, so that's
    // where focus usually is.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.matches(':popover-open')) panel.hidePopover();
    });

    this.append(launcher, panel);
  }
}

if (!customElements.get('wc-theme-editor')) {
  customElements.define('wc-theme-editor', WCThemeEditor);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-theme-editor': WCThemeEditor;
  }
}
