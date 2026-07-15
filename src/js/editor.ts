/**
 * Live design-system editor (docs-only).
 *
 * The standalone (`--format=css`) build emits every design token as a CSS custom
 * property on `:root`, so the whole docs page is already driven by variables. This
 * module layers runtime overrides on top of them via a single injected
 * `<style id="ds-overrides">` — no rebuild, instant preview. It reads the shape of
 * the editable surface from `dist/design-manifest.json` (emitted by the generator),
 * renders native controls (styled with `forms.css`), persists edits to
 * localStorage, and exports either the raw CSS or a `design-system.json` patch so
 * live edits can be promoted back into source.
 *
 * The override layers the user tunes map 1:1 to the framework's own var cascade:
 *   palette    → --color-<ramp>-<step>
 *   typography → --<role>-<hook>            (ff/fs/fw/lh/ls/tt/…)
 *   spacing    → --space-<name>
 *   defaults   → --<prop>-default           (ds/b/br/p/fs)
 *   groups     → --<prop>-<group>
 *   components → --<prop>-<item>            (via the generator's base-geometry hooks)
 * The cascade between layers is already encoded by the generated var() fallback
 * chains, so overrides only need to be keyed by full var name — they never collide.
 * The one ordering concern (light vs dark) is handled by two separate rule blocks.
 */

type Scheme = 'light' | 'dark';

interface Manifest {
  colors: {
    ramps: string[];
    steps: string[];
    named: Record<string, Record<string, string>>;
    roles: { name: string; ramp: string }[];
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
const DARK_ATTR = 'data-brx-theme';
const DARK_SELECTOR = `:root[${DARK_ATTR}="dark"]`;

// ── Override store ──────────────────────────────────────────────────────────
// Two maps (one per scheme) → one <style> block. Light writes to `:root`, dark to
// the higher-specificity `:root[data-brx-theme="dark"]` so it wins only in dark.
const store: Record<Scheme, Map<string, string>> = { light: new Map(), dark: new Map() };
let styleEl: HTMLStyleElement;
const syncers = new Set<() => void>(); // control ⇄ store re-sync callbacks

function block(selector: string, entries: Map<string, string>): string {
  if (!entries.size) return '';
  const body = [...entries].map(([name, value]) => `  ${name}: ${value};`).join('\n');
  return `${selector} {\n${body}\n}\n`;
}

function serializeCSS(): string {
  return block(':root', store.light) + block(DARK_SELECTOR, store.dark);
}

function render(): void {
  styleEl.textContent = serializeCSS();
}

function persist(): void {
  const data = { light: [...store.light], dark: [...store.dark] };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage may be unavailable (private mode) — overrides still apply in-session */
  }
}

function hydrate(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as { light?: [string, string][]; dark?: [string, string][] };
    store.light = new Map(data.light ?? []);
    store.dark = new Map(data.dark ?? []);
  } catch {
    /* corrupt payload — start clean */
  }
}

function setOverride(varName: string, value: string | null, scheme: Scheme): void {
  const map = store[scheme];
  if (value == null || value === '') map.delete(varName);
  else map.set(varName, value);
  render();
  persist();
}

// Effective value of a var in a scheme: its own override, else (for dark) the
// light override, else the manifest-provided default the control was seeded with.
function effective(varName: string, scheme: Scheme, fallback: string): string {
  if (store[scheme].has(varName)) return store[scheme].get(varName) as string;
  if (scheme === 'dark' && store.light.has(varName)) return store.light.get(varName) as string;
  return fallback;
}

function reset(): void {
  store.light.clear();
  store.dark.clear();
  render();
  persist();
  syncers.forEach((fn) => fn());
}

// Colour var name for a token at a step ('' for base).
const stepVar = (token: string, step: string): string =>
  `--color-${token}${step === 'base' ? '' : `-${step}`}`;

// Point a semantic role at a named ramp by overriding each step's indirection
// (--color-<role>-<step> → var(--color-<ramp>-<step>)). Mirrors how the generator
// wires roles to ramps, so the whole role recolours from one select.
function remapRole(m: Manifest, role: string, ramp: string): void {
  for (const step of m.colors.steps) {
    if (m.colors.named[ramp]?.[step] == null) continue;
    setOverride(stepVar(role, step), `var(${stepVar(ramp, step)})`, scheme);
  }
}

// ── JSON-patch export ───────────────────────────────────────────────────────
// Map each *light* override back to its design-system.json path via reverseIndex
// and deep-set it, producing a partial that deep-merges into source. Dark-block
// overrides are runtime-only (the source schema has no per-scheme hex — dark is
// derived from role→step remapping), so they export as CSS only.
function deepSet(obj: Record<string, unknown>, path: string, value: string): void {
  const keys = path.split('.');
  let node = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i] as string;
    if (typeof node[k] !== 'object' || node[k] == null) node[k] = {};
    node = node[k] as Record<string, unknown>;
  }
  node[keys[keys.length - 1] as string] = value;
}

function serializeJSONPatch(manifest: Manifest): { patch: object; skipped: string[] } {
  const patch: Record<string, unknown> = {};
  const skipped: string[] = [];
  const roleNames = new Set(manifest.colors.roles.map((r) => r.name));
  for (const [varName, value] of store.light) {
    // Role remaps (--color-<role>[-step]: var(--color-<ramp>…)) collapse to a
    // single semantic mapping (colors.semantic.<role> = <ramp>) rather than 7 vars.
    const roleMatch = /^--color-([a-z0-9-]+?)(?:-(?:xxd|xd|d|l|xl|xxl))?$/.exec(varName);
    if (roleMatch && roleNames.has(roleMatch[1] as string)) {
      const ramp = /var\(\s*--color-([a-z0-9-]+?)(?:-(?:xxd|xd|d|l|xl|xxl))?\s*\)/.exec(value);
      if (ramp) {
        deepSet(patch, `colors.semantic.${roleMatch[1]}`, ramp[1] as string);
        continue;
      }
    }
    const path = manifest.reverseIndex[varName];
    if (path) deepSet(patch, path, value);
    else skipped.push(varName);
  }
  for (const varName of store.dark.keys()) skipped.push(`${varName} (dark)`);
  return { patch, skipped };
}

// ── Scheme (light/dark) — routes writes and previews the page ───────────────
let scheme: Scheme = 'light';
function currentScheme(): Scheme {
  return document.documentElement.getAttribute(DARK_ATTR) === 'dark' ? 'dark' : 'light';
}
function setScheme(next: Scheme): void {
  scheme = next;
  document.documentElement.setAttribute(DARK_ATTR, next);
  syncers.forEach((fn) => fn()); // reflect each control's effective value in this scheme
}

// ── DOM helpers ─────────────────────────────────────────────────────────────
type Attrs = Record<string, string | number | boolean>;
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  // Route mutations through a plain HTMLElement view: the project's un-built Lit
  // web-components augment HTMLElementTagNameMap with error-typed classes, which
  // would otherwise poison the generic union on .append/.setAttribute here.
  const el = node as HTMLElement;
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = String(v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false) el.setAttribute(k, String(v));
  }
  for (const c of children) el.append(c);
  return node;
}

// A labelled control row. `label` is the full var name; the `--` prefix is
// dropped for display (kept as a tooltip). `sync` reads the store and refreshes
// the input so scheme-switches, reset and hydration stay reflected in the UI.
function row(label: string, control: HTMLElement, sync: () => void): HTMLElement {
  syncers.add(sync);
  sync();
  return h('label', { class: 'ds-ed-row' }, [
    h('span', { class: 'ds-ed-label', title: label }, [label.replace(/^--/, '')]),
    control,
  ]);
}

function textInput(varName: string, fallback: string, placeholder = ''): HTMLElement {
  const input = h('input', { type: 'text', class: 'ds-ed-input', placeholder });
  input.addEventListener('input', () => setOverride(varName, input.value.trim() || null, scheme));
  return row(varName, input, () => {
    input.value = store[scheme].has(varName) ? (store[scheme].get(varName) as string) : '';
    input.placeholder = placeholder || fallback;
  });
}

function colorInput(varName: string, hex: string): HTMLElement {
  const picker = h('input', { type: 'color', class: 'ds-ed-color' }) as HTMLInputElement;
  const text = h('input', { type: 'text', class: 'ds-ed-input ds-ed-hex' }) as HTMLInputElement;
  const commit = (v: string): void => setOverride(varName, v || null, scheme);
  picker.addEventListener('input', () => {
    text.value = picker.value;
    commit(picker.value);
  });
  text.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(text.value)) picker.value = text.value;
    commit(text.value.trim());
  });
  const wrap = h('span', { class: 'ds-ed-colorwrap' }, [picker, text]);
  return row(varName, wrap, () => {
    const v = effective(varName, scheme, hex);
    text.value = v;
    if (/^#[0-9a-f]{6}$/i.test(v)) picker.value = v;
  });
}

function selectInput(varName: string, options: { label: string; value: string }[]): HTMLElement {
  const select = h('select', { class: 'ds-ed-input' }) as HTMLSelectElement;
  select.append(h('option', { value: '' }, ['— default —']));
  for (const o of options) select.append(h('option', { value: o.value }, [o.label]));
  select.addEventListener('change', () => setOverride(varName, select.value || null, scheme));
  return row(varName, select, () => {
    select.value = store[scheme].has(varName) ? (store[scheme].get(varName) as string) : '';
  });
}

// Range + rem readout for scale steps (writes a plain rem — trades fluidity for a
// direct, visible knob; clears back to the generated clamp when zeroed out).
function remSlider(varName: string, maxRem: string): HTMLElement {
  const base = parseFloat(maxRem) || 1;
  const range = h('input', {
    type: 'range',
    class: 'ds-ed-range',
    min: '0',
    max: String(Math.max(4, Math.ceil(base * 2))),
    step: '0.05',
  }) as HTMLInputElement;
  const out = h('output', { class: 'ds-ed-out' });
  const apply = (): void => {
    out.textContent = `${range.value}rem`;
    setOverride(varName, `${range.value}rem`, scheme);
  };
  range.addEventListener('input', apply);
  const wrap = h('span', { class: 'ds-ed-rangewrap' }, [range, out]);
  return row(varName, wrap, () => {
    const v = effective(varName, scheme, maxRem);
    range.value = String(parseFloat(v) || base);
    out.textContent = store[scheme].has(varName) ? (store[scheme].get(varName) as string) : 'auto';
  });
}

// General numeric slider. `toValue` maps the slider number to the CSS value that
// gets written; `fromValue` recovers the slider number from a stored CSS value
// (defaults to a leading-number parse). Used for structural layout knobs.
interface SliderOpts {
  min: number;
  max: number;
  step: number;
  def: number;
  unit?: string;
  toValue?: (n: number) => string;
  fromValue?: (stored: string) => number;
}
function sliderControl(varName: string, opts: SliderOpts): HTMLElement {
  const toValue = opts.toValue ?? ((n: number): string => `${n}${opts.unit ?? ''}`);
  const fromValue =
    opts.fromValue ??
    ((s: string): number => (Number.isNaN(parseFloat(s)) ? opts.def : parseFloat(s)));
  const range = h('input', {
    type: 'range',
    class: 'ds-ed-range',
    min: String(opts.min),
    max: String(opts.max),
    step: String(opts.step),
  }) as HTMLInputElement;
  const out = h('output', { class: 'ds-ed-out' });
  range.addEventListener('input', () => {
    const val = toValue(parseFloat(range.value));
    out.textContent = val;
    setOverride(varName, val, scheme);
  });
  const wrap = h('span', { class: 'ds-ed-rangewrap' }, [range, out]);
  return row(varName, wrap, () => {
    const stored = store[scheme].get(varName);
    range.value = String(stored != null ? fromValue(stored) : opts.def);
    out.textContent = stored ?? `${opts.def}${opts.unit ?? ''}`;
  });
}

function section(title: string, open = false): { details: HTMLDetailsElement; body: HTMLElement } {
  const body = h('div', { class: 'ds-ed-body' });
  const details = h('details', { class: 'ds-ed-section', ...(open ? { open: true } : {}) }, [
    h('summary', {}, [title]),
    body,
  ]) as HTMLDetailsElement;
  return { details, body };
}

// ── Section builders ────────────────────────────────────────────────────────
function buildPalette(m: Manifest): HTMLElement {
  const { details, body } = section('Palette', true);
  body.append(
    h('p', { class: 'ds-ed-hint' }, [
      'Named ramps feed the semantic roles below via var() indirection — edit a ramp and every role mapped to it updates. Edits apply to the current scheme (toggle Light/Dark in the header).',
    ]),
  );
  for (const ramp of m.colors.ramps) {
    const grid = h('div', { class: 'ds-ed-ramp' });
    grid.append(h('b', { class: 'ds-ed-rampname' }, [ramp]));
    for (const step of m.colors.steps) {
      const hex = m.colors.named[ramp]?.[step];
      if (hex == null) continue;
      const varName = `--color-${ramp}${step === 'base' ? '' : `-${step}`}`;
      grid.append(colorInput(varName, hex));
    }
    body.append(grid);
  }
  // Semantic roles — remap each to a named ramp (and add new roles).
  const rolesSec = section('Semantic roles');
  rolesSec.details.classList.add('ds-ed-subsection');
  rolesSec.body.append(
    h('p', { class: 'ds-ed-hint' }, [
      'Map a role to a named ramp — every element using that role recolours live. New roles create the tokens but their utility classes (bg-/text-…) need a rebuild.',
    ]),
  );
  const rampOpts = m.colors.ramps.map((r) => ({ label: r, value: r }));
  const addRoleRow = (role: string, ramp: string): void => {
    const select = h('select', { class: 'ds-ed-input' }) as HTMLSelectElement;
    for (const o of rampOpts) select.append(h('option', { value: o.value }, [o.label]));
    const baseVar = stepVar(role, 'base');
    select.addEventListener('change', () => remapRole(m, role, select.value));
    rolesSec.body.append(
      row(`--color-${role}`, select, () => {
        const v = store[scheme].get(baseVar);
        const parsed = v
          ? /var\(\s*--color-([a-z0-9-]+?)(?:-(?:xxd|xd|d|l|xl|xxl))?\s*\)/.exec(v)
          : null;
        select.value = parsed ? (parsed[1] as string) : ramp;
      }),
    );
  };
  for (const r of m.colors.roles) addRoleRow(r.name, r.ramp);

  const nameInput = h('input', {
    type: 'text',
    class: 'ds-ed-input',
    placeholder: 'new role name',
  }) as HTMLInputElement;
  const rampSel = h('select', { class: 'ds-ed-input' }) as HTMLSelectElement;
  for (const o of rampOpts) rampSel.append(h('option', { value: o.value }, [o.label]));
  const addBtn = h('button', { type: 'button', class: 'ds-ed-btn' }, ['+ Add']);
  addBtn.addEventListener('click', () => {
    const name = nameInput.value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!name) return;
    const ramp = rampSel.value || (m.colors.ramps[0] as string);
    remapRole(m, name, ramp);
    addRoleRow(name, ramp);
    nameInput.value = '';
  });
  rolesSec.body.append(h('div', { class: 'ds-ed-row' }, [nameInput, rampSel, addBtn]));
  body.append(rolesSec.details);
  return details;
}

function buildTypography(m: Manifest): HTMLElement {
  const { details, body } = section('Typography');
  const fontOpts = Object.keys(m.fonts).map((k) => ({ label: k, value: `var(--font-${k})` }));
  const sizeOpts = m.scales.text.map((s) => ({ label: s.name, value: `var(--text-${s.name})` }));
  const ttOpts = ['none', 'uppercase', 'lowercase', 'capitalize'].map((v) => ({
    label: v,
    value: v,
  }));
  for (const role of m.typography.roles) {
    const spec = m.typography.specs[role] ?? {};
    const sub = section(role);
    sub.details.classList.add('ds-ed-subsection');
    sub.body.append(
      selectInput(`--${role}-ff`, fontOpts),
      selectInput(`--${role}-fs`, sizeOpts),
      textInput(`--${role}-fw`, String(spec.weight ?? ''), 'weight e.g. 700'),
      textInput(`--${role}-lh`, String(spec['line-height'] ?? ''), 'line-height e.g. 1.4'),
      textInput(`--${role}-ls`, String(spec.tracking ?? ''), 'tracking e.g. -0.02em'),
      selectInput(`--${role}-tt`, ttOpts),
    );
    body.append(sub.details);
  }
  return details;
}

function buildSpacing(m: Manifest): HTMLElement {
  const { details, body } = section('Spacing');
  body.append(
    h('p', { class: 'ds-ed-hint' }, [
      'Each step overrides to a fixed rem (drops fluid clamp). Slide to 0 to restore the generated value.',
    ]),
  );
  for (const s of m.scales.space) body.append(remSlider(`--space-${s.name}`, s.max));
  return details;
}

// Structural layout knobs (from layout.css :root, not the JSON manifest): the
// vertical-rhythm dial and the .centered track widths + gutter. These are primary
// patterns, so their live controls live here rather than under the docs demos.
function buildLayout(): HTMLElement {
  const { details, body } = section('Layout');
  body.append(
    h('p', { class: 'ds-ed-hint' }, [
      'Vertical rhythm dial and the .centered track widths — global structural knobs.',
    ]),
  );
  body.append(
    sliderControl('--rhythm-scale', { min: 0.5, max: 2.5, step: 0.05, def: 1 }),
    sliderControl('--width-measure', { min: 30, max: 110, step: 1, def: 65, unit: 'ch' }),
    sliderControl('--width-breakout', { min: 40, max: 150, step: 1, def: 90, unit: 'ch' }),
    sliderControl('--width-spotlight', { min: 60, max: 200, step: 1, def: 120, unit: 'ch' }),
    sliderControl('--gutter', {
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

function buildPatternDefaults(m: Manifest): HTMLElement {
  const { details, body } = section('Pattern defaults');
  for (const [prop, val] of Object.entries(m.patterns.defaults))
    body.append(textInput(`--${prop}-default`, val, val));
  return details;
}

function buildPatternGroups(m: Manifest): HTMLElement {
  const { details, body } = section('Pattern groups');
  for (const [group, props] of Object.entries(m.patterns.groups)) {
    const sub = section(group);
    sub.details.classList.add('ds-ed-subsection');
    for (const [prop, val] of Object.entries(props))
      sub.body.append(textInput(`--${prop}-${group}`, val, val));
    body.append(sub.details);
  }
  return details;
}

function buildComponents(m: Manifest): HTMLElement {
  const { details, body } = section('Components');
  body.append(
    h('p', { class: 'ds-ed-hint' }, [
      'Per-component geometry — overrides the pattern/group defaults for just this component.',
    ]),
  );
  for (const item of m.patterns.items) {
    if (!item.wrappable.length) continue;
    const sub = section(item.name);
    sub.details.classList.add('ds-ed-subsection');
    for (const { sfx, prop } of item.wrappable) {
      const val = item.base[prop] ?? '';
      sub.body.append(textInput(`--${sfx}-${item.name}`, val, val));
    }
    body.append(sub.details);
  }
  return details;
}

// ── Toolbar (scheme, export, reset) ─────────────────────────────────────────
async function copy(text: string, btn: HTMLElement): Promise<void> {
  const label = btn.textContent;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Copied ✓';
  } catch {
    btn.textContent = 'Copy failed';
  }
  setTimeout(() => (btn.textContent = label), 1200);
}

function buildToolbar(m: Manifest): HTMLElement {
  const bar = h('div', { class: 'ds-ed-toolbar' });

  const lightBtn = h('button', { type: 'button', class: 'ds-ed-seg' }, ['Light']);
  const darkBtn = h('button', { type: 'button', class: 'ds-ed-seg' }, ['Dark']);
  const reflectScheme = (): void => {
    lightBtn.classList.toggle('is-active', scheme === 'light');
    darkBtn.classList.toggle('is-active', scheme === 'dark');
  };
  syncers.add(reflectScheme);
  lightBtn.addEventListener('click', () => {
    setScheme('light');
    reflectScheme();
  });
  darkBtn.addEventListener('click', () => {
    setScheme('dark');
    reflectScheme();
  });
  bar.append(h('div', { class: 'ds-ed-segwrap' }, [lightBtn, darkBtn]));

  const cssBtn = h('button', { type: 'button', class: 'ds-ed-btn' }, ['Copy CSS']);
  cssBtn.addEventListener('click', () => {
    const css = serializeCSS();
    void copy(css || '/* no overrides yet */', cssBtn);
  });
  const jsonBtn = h('button', { type: 'button', class: 'ds-ed-btn' }, ['Copy JSON patch']);
  jsonBtn.addEventListener('click', () => {
    const { patch, skipped } = serializeJSONPatch(m);
    const note = skipped.length
      ? `\n// runtime-only (not mapped to source): ${skipped.join(', ')}`
      : '';
    void copy(JSON.stringify(patch, null, 2) + note, jsonBtn);
  });
  const resetBtn = h('button', { type: 'button', class: 'ds-ed-btn ds-ed-btn--danger' }, [
    'Reset all',
  ]);
  resetBtn.addEventListener('click', reset);

  bar.append(cssBtn, jsonBtn, resetBtn);
  return bar;
}

// ── Panel + launcher ────────────────────────────────────────────────────────
function injectStyles(): void {
  const style = h('style', { id: 'ds-editor-styles' });
  style.textContent = STYLES;
  document.head.append(style);
}

function buildPanel(m: Manifest): void {
  const panel = h('aside', {
    id: 'ds-editor',
    class: 'ds-editor',
    hidden: true,
    'aria-label': 'Design-system editor',
  });
  panel.append(
    h('header', { class: 'ds-ed-header' }, [
      h('strong', {}, ['Design editor']),
      h('button', { type: 'button', class: 'ds-ed-close', 'aria-label': 'Close editor' }, ['×']),
    ]),
    buildToolbar(m),
    buildPalette(m),
    buildTypography(m),
    buildSpacing(m),
    buildLayout(),
    buildPatternDefaults(m),
    buildPatternGroups(m),
    buildComponents(m),
  );

  const launcher = h('button', { type: 'button', id: 'ds-editor-launch', class: 'ds-ed-launch' }, [
    '🎨 Edit theme',
  ]);
  let open = false;
  const toggle = (next: boolean): void => {
    open = next;
    panel.hidden = !next;
    launcher.setAttribute('aria-expanded', String(next));
  };
  launcher.addEventListener('click', () => toggle(!open));
  panel.querySelector('.ds-ed-close')?.addEventListener('click', () => toggle(false));

  document.body.append(launcher, panel);
}

// ── Boot ────────────────────────────────────────────────────────────────────
async function init(): Promise<void> {
  const url = new URL('./design-manifest.json', import.meta.url).href;
  let manifest: Manifest;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`manifest ${res.status}`);
    manifest = (await res.json()) as Manifest;
  } catch (err) {
    console.warn('[ds-editor] manifest unavailable — editor disabled', err);
    return;
  }

  styleEl = h('style', { id: 'ds-overrides' });
  document.head.append(styleEl); // appended last → wins on equal specificity

  hydrate();
  render();
  scheme = currentScheme();

  injectStyles();
  buildPanel(manifest);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void init());
} else {
  void init();
}

// ── Panel chrome (docs-only; no framework equivalent) ────────────────────────
const STYLES = `
.ds-ed-launch {
  position: fixed; inset-block-end: 1rem; inset-inline-end: 1rem; z-index: 9999;
  padding: 0.6em 1em; border: none; border-radius: 999px; cursor: pointer;
  background: var(--color-brand-primary-d); color: #fff; font: inherit; font-weight: 600;
  box-shadow: var(--shadow-lg, 0 8px 24px -8px rgb(0 0 0 / 0.4));
}
.ds-editor {
  position: fixed; inset-block: 0; inset-inline-end: 0; z-index: 9999;
  inline-size: min(24rem, 100vw); overflow-y: auto;
  background: var(--color-surface-xxl); color: var(--color-surface-xxd);
  border-inline-start: 1px solid var(--color-surface-l);
  box-shadow: var(--shadow-xl, -8px 0 32px -12px rgb(0 0 0 / 0.35));
  font-size: 0.85rem;
}
.ds-editor[hidden] { display: none; }
.ds-ed-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.75rem 1rem; position: sticky; inset-block-start: 0;
  background: var(--color-surface-xxl); border-block-end: 1px solid var(--color-surface-l);
}
.ds-ed-close { background: none; border: none; font-size: 1.4rem; line-height: 1; cursor: pointer; color: inherit; }
.ds-ed-toolbar { display: flex; flex-wrap: wrap; gap: 0.4rem; padding: 0.75rem 1rem; border-block-end: 1px solid var(--color-surface-l); }
.ds-ed-segwrap { display: inline-flex; border: 1px solid var(--color-surface-l); border-radius: 0.4rem; overflow: hidden; }
.ds-ed-seg { padding: 0.35em 0.8em; border: none; background: transparent; cursor: pointer; font: inherit; color: inherit; }
.ds-ed-seg.is-active { background: var(--color-brand-primary); color: #fff; }
.ds-ed-btn { padding: 0.35em 0.7em; border: 1px solid var(--color-surface-l); border-radius: 0.4rem; background: var(--color-surface-xl); cursor: pointer; font: inherit; color: inherit; }
.ds-ed-btn--danger { color: var(--color-danger-d); }
.ds-ed-section { border-block-end: 1px solid var(--color-surface-l); }
.ds-ed-section > summary { padding: 0.6rem 1rem; cursor: pointer; font-weight: 600; user-select: none; }
.ds-ed-body { padding: 0.5rem 1rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
.ds-ed-subsection { border: 1px solid var(--color-surface-l); border-radius: 0.4rem; }
.ds-ed-subsection > summary { padding: 0.4rem 0.6rem; cursor: pointer; font-weight: 600; }
.ds-ed-subsection .ds-ed-body { padding: 0.4rem 0.6rem 0.6rem; }
.ds-ed-row { display: flex; align-items: center; gap: 0.5rem; }
.ds-ed-label { flex: 0 0 8.5rem; font-family: var(--font-mono, monospace); font-size: 0.72rem; opacity: 0.8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-ed-input { flex: 1; min-inline-size: 0; padding: 0.3em 0.5em; border: 1px solid var(--color-surface-l); border-radius: 0.3rem; background: var(--color-surface-xl); color: inherit; font: inherit; font-size: 0.78rem; }
.ds-ed-colorwrap, .ds-ed-rangewrap { flex: 1; display: flex; align-items: center; gap: 0.4rem; min-inline-size: 0; }
.ds-ed-color { flex: 0 0 1.8rem; block-size: 1.8rem; padding: 0; border: 1px solid var(--color-surface-l); border-radius: 0.3rem; background: none; cursor: pointer; }
.ds-ed-hex { font-family: var(--font-mono, monospace); }
.ds-ed-range { flex: 1; min-inline-size: 0; }
.ds-ed-out { flex: 0 0 4rem; font-family: var(--font-mono, monospace); font-size: 0.72rem; text-align: end; }
.ds-ed-ramp { display: flex; flex-direction: column; gap: 0.3rem; padding-block: 0.3rem; }
.ds-ed-rampname { text-transform: capitalize; font-size: 0.78rem; }
.ds-ed-hint { font-size: 0.72rem; opacity: 0.7; line-height: 1.4; margin: 0; }
`;
