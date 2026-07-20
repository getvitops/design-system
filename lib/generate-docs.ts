/**
 * Codegen: src/design-system.json + bricks/elements/*.php -> docs/ (LLM context tree)
 *
 * Emits an LLM-oriented documentation tree, published alongside the deployed theme
 * (copied to <theme>/dist/docs/ by build:elements) so an AI has context that always
 * matches what ships. Structure (nested index.md, each linking down):
 *
 *   docs/index.md          top index → css + bricks
 *   docs/css/index.md      CSS framework class vocabulary, summarized by rule (from
 *                          src/design-system.json + the static src/css partials)
 *   docs/bricks/index.md   Bricks integration; "prefer framework classes over tuning
 *                          Bricks UI properties"; links elements.md + ../css
 *   docs/bricks/elements.md per-element control reference (parsed from the PHP)
 *
 * The element reference reads each file's docblock (human-written prose), class
 * metadata, get_label()/get_keywords()/get_nestable_children(), and — via a small
 * PHP-array-literal parser — the full set_controls() definition. The CSS reference
 * pulls token-derived families (colours, type roles, shadows, animation effects,
 * component patterns) live from the JSON and states each family as a naming rule
 * rather than enumerating every class. Purely documentation; no runtime output.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ELEMENTS_DIR = 'bricks/elements';
const DS_PATH = 'src/design-system.json';
const OUT_DIR = 'docs';

// Curated display order (by element $name, without the vitops- prefix). Anything
// not listed falls to the end, alphabetically, so a new element still appears.
const ORDER = [
  'split',
  'centered',
  'carousel',
  'color-scheme-toggle',
  'copy-button',
  'dismissable',
  'entries',
  'image-compare',
  'sitenav',
  'multi-field',
  'split-link',
  'split-panel',
];

// ── PHP array-literal parser ─────────────────────────────────────────────────
// Enough of PHP to read a control/children definition: single/double strings,
// ints, true/false/null, `array( … )` and `[ … ]` (freely mixed/nested), `key =>
// value` maps, and `esc_html__( 'text', … )` / `esc_attr__( … )` calls (reduced to
// their first string argument). Comments are skipped. Anything else parses to a
// raw identifier string, which the doc layer ignores.

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

interface Tok {
  t: 'str' | 'num' | 'id' | 'punc' | 'arrow';
  v: string;
}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }
    // comments
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '#') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // strings
    if (c === "'" || c === '"') {
      const quote = c;
      i++;
      let s = '';
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\' && i + 1 < n) {
          const next = src[i + 1];
          s += next === 'n' ? '\n' : next === 't' ? '\t' : next;
          i += 2;
        } else {
          s += src[i++];
        }
      }
      i++; // closing quote
      toks.push({ t: 'str', v: s });
      continue;
    }
    if (c === '=' && src[i + 1] === '>') {
      toks.push({ t: 'arrow', v: '=>' });
      i += 2;
      continue;
    }
    if ('[](){},'.includes(c)) {
      toks.push({ t: 'punc', v: c });
      i++;
      continue;
    }
    if ((c >= '0' && c <= '9') || (c === '-' && src[i + 1] >= '0' && src[i + 1] <= '9')) {
      let s = c;
      i++;
      while (i < n && src[i] >= '0' && src[i] <= '9') s += src[i++];
      toks.push({ t: 'num', v: s });
      continue;
    }
    if (/[A-Za-z_\\]/.test(c)) {
      let s = c;
      i++;
      while (i < n && /[A-Za-z0-9_\\]/.test(src[i])) s += src[i++];
      toks.push({ t: 'id', v: s });
      continue;
    }
    i++; // skip anything else
  }
  return toks;
}

class Parser {
  p = 0;
  toks: Tok[];
  constructor(toks: Tok[]) {
    this.toks = toks;
  }

  peek(): Tok | undefined {
    return this.toks[this.p];
  }
  next(): Tok | undefined {
    return this.toks[this.p++];
  }

  parseValue(): Json {
    const t = this.peek();
    if (!t) return null;
    if (t.t === 'str') {
      this.next();
      return t.v;
    }
    if (t.t === 'num') {
      this.next();
      return Number(t.v);
    }
    if (t.t === 'id') {
      this.next();
      if (t.v === 'true') return true;
      if (t.v === 'false') return false;
      if (t.v === 'null') return null;
      // identifier followed by `(` → array() literal or a function call
      if (this.peek()?.t === 'punc' && this.peek()?.v === '(') {
        this.next(); // consume '('
        if (t.v === 'array') return this.parseBody(')');
        // function call (esc_html__, esc_attr__, …): take the first string arg.
        const args = this.parseCallArgs();
        return args.find((a) => typeof a === 'string') ?? args[0] ?? '';
      }
      return t.v; // bare identifier (e.g. PHP_INT_MAX) — kept as a string
    }
    if (t.t === 'punc' && t.v === '[') {
      this.next();
      return this.parseBody(']');
    }
    if (t.t === 'punc' && t.v === '(') {
      this.next();
      return this.parseBody(')');
    }
    this.next();
    return null;
  }

  private parseCallArgs(): Json[] {
    const args: Json[] = [];
    while (this.peek() && !(this.peek()!.t === 'punc' && this.peek()!.v === ')')) {
      args.push(this.parseValue());
      if (this.peek()?.t === 'punc' && this.peek()?.v === ',') this.next();
    }
    this.next(); // consume ')'
    return args;
  }

  private parseBody(close: string): Json {
    const list: Json[] = [];
    const map: Record<string, Json> = {};
    let keyed = false;
    while (this.peek() && !(this.peek()!.t === 'punc' && this.peek()!.v === close)) {
      const first = this.parseValue();
      if (this.peek()?.t === 'arrow') {
        this.next();
        const val = this.parseValue();
        map[String(first)] = val;
        keyed = true;
      } else {
        list.push(first);
      }
      if (this.peek()?.t === 'punc' && this.peek()?.v === ',') this.next();
    }
    this.next(); // consume close
    return keyed ? map : list;
  }
}

function parsePhpLiteral(text: string): Json {
  return new Parser(tokenize(text)).parseValue();
}

// ── Source-region helpers ────────────────────────────────────────────────────

// From an opening bracket at `open`, return the index just past its match,
// balancing () [] {} and skipping strings + comments.
function matchBalanced(src: string, open: number): number {
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const stack: string[] = [];
  let i = open;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"') {
      i++;
      while (i < n && src[i] !== c) {
        if (src[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }
    if (c in pairs) stack.push(pairs[c]);
    else if (c === ')' || c === ']' || c === '}') {
      if (stack.pop() !== c) {
        /* unbalanced — best effort */
      }
      if (stack.length === 0) return i + 1;
    }
    i++;
  }
  return n;
}

// The body of a `function name() { … }`, braces excluded.
function methodBody(src: string, name: string): string | null {
  const m = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)`).exec(src);
  if (!m) return null;
  const brace = src.indexOf('{', m.index + m[0].length);
  if (brace < 0) return null;
  const end = matchBalanced(src, brace);
  return src.slice(brace + 1, end - 1);
}

// The array literal assigned/returned at `fromIdx` (points at `[` or `array`).
function literalAt(src: string, fromIdx: number): { text: string; end: number } | null {
  let i = fromIdx;
  while (i < src.length && /\s/.test(src[i])) i++;
  let open: number;
  if (src[i] === '[') open = i;
  else if (src.startsWith('array', i)) open = src.indexOf('(', i);
  else return null;
  const end = matchBalanced(src, open);
  return { text: src.slice(i, end), end };
}

// ── Per-element extraction ───────────────────────────────────────────────────

interface Control {
  key: string;
  def: Record<string, Json>;
}
interface Element {
  name: string;
  label: string;
  nestable: boolean;
  docblock: string;
  controls: Control[];
  cssClass: string | null;
  children: string[];
  keywords: string[];
}

function firstString(re: RegExp, src: string): string | null {
  const m = re.exec(src);
  return m ? m[1] : null;
}

function extractDocblock(src: string): string {
  const m = /\/\*\*([\s\S]*?)\*\//.exec(src);
  if (!m) return '';
  const lines = m[1].split('\n').map((l) => l.replace(/^\s*\*?\s?/, '').replace(/\s+$/, ''));
  // Drop the "Vitops — … (Bricks Builder)." title line.
  while (lines.length && lines[0] === '') lines.shift();
  if (lines.length && /Bricks Builder\)\./.test(lines[0])) lines.shift();
  // Cut the trailing "Owned by the framework repo…" boilerplate.
  const owned = lines.findIndex((l) => l.startsWith('Owned by the framework repo'));
  const kept = (owned >= 0 ? lines.slice(0, owned) : lines).map((l) => l.replace(/^•\s*/, '- '));
  while (kept.length && kept[kept.length - 1] === '') kept.pop();
  while (kept.length && kept[0] === '') kept.shift();
  return kept.join('\n');
}

function extractControls(src: string): Control[] {
  const body = methodBody(src, 'set_controls');
  if (!body) return [];
  const controls: Control[] = [];
  const re = /\$this->controls\[\s*'([^']+)'\s*\](\[\s*'([^']+)'\s*\])?\s*=\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const key = m[1];
    // `$this->controls['_cssClasses']['default'] = '…';` — a default, not a control.
    if (m[2]) continue;
    const lit = literalAt(body, m.index + m[0].length);
    if (!lit) continue;
    const def = parsePhpLiteral(lit.text);
    if (def && typeof def === 'object' && !Array.isArray(def)) {
      controls.push({ key, def: def as Record<string, Json> });
    }
    re.lastIndex = lit.end; // resume past the parsed literal
  }
  return controls;
}

function extractChildren(src: string): string[] {
  const body = methodBody(src, 'get_nestable_children');
  if (!body) return [];
  const labels: string[] = [];
  const re = /'label'\s*=>\s*esc_html__\(\s*'([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) labels.push(m[1]);
  return labels;
}

function extractKeywords(src: string): string[] {
  const body = methodBody(src, 'get_keywords');
  if (!body) return [];
  const ret = /return\s+/.exec(body);
  if (!ret) return [];
  const lit = literalAt(body, ret.index + ret[0].length);
  if (!lit) return [];
  const arr = parsePhpLiteral(lit.text);
  return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
}

function parseElement(src: string): Element | null {
  const name = firstString(/public\s+\$name\s*=\s*'vitops-([^']+)'/, src);
  if (!name) return null;
  return {
    name,
    label:
      firstString(/function get_label\(\)[\s\S]*?return\s+esc_html__\(\s*'([^']*)'/, src) ?? name,
    nestable: /public\s+\$nestable\s*=\s*true/.test(src),
    docblock: extractDocblock(src),
    controls: extractControls(src),
    cssClass: firstString(
      /\$this->controls\[\s*'_cssClasses'\s*\]\[\s*'default'\s*\]\s*=\s*'([^']*)'/,
      src,
    ),
    children: extractChildren(src),
    keywords: extractKeywords(src),
  };
}

// ── Markdown rendering ───────────────────────────────────────────────────────

function controlLine(c: Control): string {
  const def = c.def;
  if (def.type === 'info') {
    return `- _Note:_ ${def.content ?? ''}`;
  }
  const label = (def.label as string) || c.key;
  const options =
    def.options && typeof def.options === 'object' && !Array.isArray(def.options)
      ? (def.options as Record<string, string>)
      : null;

  const meta: string[] = [];
  let type = (def.type as string) || 'text';
  if (def.units === true) type += '+units';
  meta.push(type);

  if (def.default !== undefined) {
    const raw = String(def.default);
    const shown = options && options[raw] ? options[raw] : raw;
    meta.push(`default \`${shown}\``);
  }
  if (def.placeholder !== undefined && def.placeholder !== '') {
    meta.push(`placeholder \`${def.placeholder}\``);
  }
  if (def.min !== undefined || def.max !== undefined) {
    meta.push(`range ${def.min ?? '–'}–${def.max ?? '∞'}`);
  }

  const tail: string[] = [];
  if (def.description) tail.push(String(def.description));
  if (options) {
    // Backtick each label — some (e.g. placement) contain the `·` we'd otherwise
    // use as a separator, which would be ambiguous.
    tail.push(
      `Options: ${Object.values(options)
        .map((o) => `\`${o}\``)
        .join(', ')}.`,
    );
  }
  if (Array.isArray(def.css) && def.css.length) {
    const first = def.css[0];
    if (first && typeof first === 'object' && !Array.isArray(first) && 'property' in first) {
      tail.push(`Bound to \`${(first as Record<string, Json>).property}\`.`);
    }
  }
  if (def.type === 'repeater' && def.fields && typeof def.fields === 'object') {
    const fields = Object.values(def.fields as Record<string, Json>)
      .map((f) =>
        f && typeof f === 'object' && !Array.isArray(f) ? (f as Record<string, Json>).label : null,
      )
      .filter(Boolean);
    if (fields.length) tail.push(`Fields: ${fields.join(', ')}.`);
  }

  const head = `- **${label}** (${meta.join(', ')})`;
  return tail.length ? `${head} — ${tail.join(' ')}` : head;
}

function renderElement(el: Element): string {
  const out: string[] = [];
  const nest = el.nestable ? 'nestable' : 'not nestable';
  out.push(`## ${el.label} — \`vitops-${el.name}\` · ${nest}`);
  out.push('');
  if (el.docblock) {
    out.push(el.docblock);
    out.push('');
  }
  const real = el.controls.filter((c) => c.def.type !== 'info');
  if (real.length) {
    out.push('**Controls**');
    out.push('');
    for (const c of el.controls) out.push(controlLine(c));
    out.push('');
  } else {
    // Still surface any standalone info notes.
    const notes = el.controls.filter((c) => c.def.type === 'info');
    if (notes.length) {
      for (const c of notes) out.push(controlLine(c));
      out.push('');
    }
  }
  if (el.cssClass) {
    out.push(
      `**Base CSS class:** \`${el.cssClass}\` (applied automatically; add ratio/modifier classes alongside it in the element's "CSS classes" field).`,
    );
    out.push('');
  }
  if (el.children.length) {
    out.push(`**Seeded children:** ${el.children.join(', ')}.`);
    out.push('');
  }
  if (el.keywords.length) {
    out.push(`**Keywords:** ${el.keywords.filter((k) => k !== 'vitops').join(', ')}.`);
    out.push('');
  }
  return out.join('\n');
}

// ── OKF (Open Knowledge Format) helpers ──────────────────────────────────────
// Concept docs (non-reserved *.md) require a YAML frontmatter block with a
// non-empty `type`; index.md files are reserved and carry NO frontmatter (just a
// listing). See okf/SPEC.md. `generator`/`source` are custom keys consumers preserve.

interface Frontmatter {
  type: string;
  title: string;
  description: string;
  resource?: string;
  tags?: string[];
}

function frontmatter(fm: Frontmatter): string {
  const q = (s: string) => `"${s.replace(/"/g, '\\"')}"`;
  const lines = [
    `type: ${q(fm.type)}`,
    `title: ${q(fm.title)}`,
    `description: ${q(fm.description)}`,
  ];
  if (fm.resource) lines.push(`resource: ${q(fm.resource)}`);
  if (fm.tags) lines.push(`tags: [${fm.tags.join(', ')}]`);
  lines.push('generator: lib/generate-docs.ts');
  return `---\n${lines.join('\n')}\n---`;
}

// HTML comment for the reserved index.md files (not frontmatter).
const INDEX_NOTE = `<!-- GENERATED by lib/generate-docs.ts — do not edit; regenerate with \`npx vp run build:elements\`. -->`;

const ELEMENTS_FRONTMATTER = frontmatter({
  type: 'Bricks Elements Reference',
  title: 'Vitops — Bricks Builder elements reference',
  description:
    'Every repo-owned Bricks element, its controls, defaults, seeded children and keywords, for driving the Bricks Builder UI.',
  resource: 'bricks/elements',
  tags: ['bricks', 'wordpress', 'elements', 'design-system'],
});

const ELEMENTS_PREAMBLE = `${ELEMENTS_FRONTMATTER}

# Vitops — Bricks Builder elements reference

Context for driving the Bricks Builder UI (e.g. Claude for Chrome). Every section below
is generated from the element's own source, so this reference always matches the elements
currently deployed. See also the CSS class vocabulary in [/css/classes.md](../css/classes.md)
and the integration guidance in [/bricks/index.md](index.md).

## How they appear in the builder

- The elements register from \`dist/bricks/load.php\` and group under a **"Vitops"** category
  pinned to the **top** of the element panel. Insert one by searching its **label** (e.g.
  "Split", "Carousel") or any of its **keywords** (listed per element).
- Two rendering families:
  - **Web-component elements** render a Lit custom element (\`<wc-*>\`, \`<copy-button>\`, …)
    from \`dist/elements.js\` and progressively enhance. A few (Image Compare, Split Panel)
    show their children stacked in the builder canvas until the client-side upgrade runs —
    that is expected, not broken.
  - **CSS-pattern elements** (Split, Centered, Menu, Split Link) render plain markup styled
    by the framework CSS — no JS dependency.
- **Nestable** elements accept child elements dropped into them; some seed starter children
  (listed as "Seeded children"). **Non-nestable** elements are configured entirely through
  their controls.

## Configuring layout

Some layout is set through **controls**; some through **CSS classes typed into the element's
built-in "CSS classes" field** (called out per element as modifier classes). Responsive
suffixes on those classes engage from a container breakpoint: \`-sm\` = 30rem, \`-md\` = 48rem,
\`-lg\` = 64rem, \`-xl\` = 80rem.

Each control below lists its type, default/placeholder, any select options, and the CSS
custom property it writes (when it drives one). Info notes flagged _Note:_ carry the
modifier-class and structural guidance from the element itself.

---
`;

function renderElementsDoc(): string {
  const files = readdirSync(ELEMENTS_DIR).filter((f) => f.endsWith('.php'));
  const elements: Element[] = [];
  for (const f of files) {
    try {
      const el = parseElement(readFileSync(join(ELEMENTS_DIR, f), 'utf8'));
      if (el) elements.push(el);
      else console.warn(`generate-docs: skipped ${f} (no vitops element found)`);
    } catch (err) {
      console.warn(`generate-docs: failed to parse ${f}:`, (err as Error).message);
    }
  }

  elements.sort((a, b) => {
    const ia = ORDER.indexOf(a.name);
    const ib = ORDER.indexOf(b.name);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.name.localeCompare(b.name);
  });

  const body = elements.map(renderElement).join('\n---\n\n');
  console.log(`generate-docs: ${elements.length} elements`);
  return `${ELEMENTS_PREAMBLE}\n${body}`;
}

// ── CSS framework reference (rule-summarized, from design-system.json) ────────

interface DesignSystem {
  colors: {
    palette: Record<string, Record<string, string>>;
    schemes: { default: { semantic: Record<string, unknown> } };
    utilities: string[];
  };
  shadows: Record<string, unknown>;
  typeScale: { names: string[] };
  spaceScale: { names: string[] };
  patterns: {
    items: Record<
      string,
      { roles?: string[]; default_role?: string; states?: Record<string, unknown> }
    >;
    radii?: Record<string, unknown>;
  };
  typography: { roles: Record<string, unknown>; families: Record<string, unknown> };
  animations: { effects: Record<string, unknown>; journeys: Record<string, unknown> };
}

const code = (xs: string[]) => xs.map((x) => `\`${x}\``).join(', ');

function renderCssClasses(ds: DesignSystem): string {
  const ramps = Object.keys(ds.colors.palette);
  const firstRamp = ramps[0];
  const steps = firstRamp ? Object.keys(ds.colors.palette[firstRamp] ?? {}) : [];
  const nonBase = steps.filter((s) => s !== 'base');
  const roles = Object.keys(ds.colors.schemes.default.semantic);
  const utils = ds.colors.utilities; // bg, text, border
  const typeRoles = Object.keys(ds.typography.roles);
  const shadows = Object.keys(ds.shadows);
  const effects = Object.keys(ds.animations.effects);
  const patterns = Object.keys(ds.patterns.items);
  const patternRoles = Array.from(
    new Set(
      Object.values(ds.patterns.items).flatMap(
        (p) => [p.default_role, ...(p.roles ?? [])].filter(Boolean) as string[],
      ),
    ),
  );

  return `${frontmatter({
    type: 'CSS Framework Reference',
    title: 'Vitops CSS framework — class vocabulary',
    description:
      'Every utility and component class in the Vitops CSS framework, stated as a naming rule over the design tokens it expands.',
    resource: DS_PATH,
    tags: ['css', 'utilities', 'patterns', 'design-system'],
  })}

# Vitops CSS framework — class vocabulary (LLM reference)

A variable-driven CSS framework. Classes encode the design system's **tokens** (colour,
type, space, shadow), **responsive grammar**, and **interaction states** — so styling with
these classes stays consistent and theme-/dark-mode-aware. Prefer them over hand-written
CSS or ad-hoc property values.

This is a **rule reference**, not an exhaustive list: each family below is a naming rule
plus the set of tokens it expands over. Applying a rule to any listed token yields a valid
class (e.g. rule \`bg-<color>\` + colour \`pine-xl\` → \`bg-pine-xl\`).

## Responsive & state variant grammar

Every utility accepts a **container-breakpoint prefix**; animation utilities also accept a
**state prefix**. In CSS/Bricks the separator is \`-\`; in Tailwind it is \`:\` / \`@\`.

| Intent            | CSS / Bricks               | Tailwind                                  |
| ----------------- | -------------------------- | ----------------------------------------- |
| responsive split  | \`md-split-1-2\`             | \`@md:split-1-2\`                           |
| responsive align  | \`md-items-center\`         | \`@md:items-center\`                        |
| hover effect      | \`transition hover-fade-in\` | \`transition fade-in hover:flip-fade-in\`   |

- Breakpoint prefixes (bare): \`sm-\` = 30rem, \`md-\` = 48rem, \`lg-\` = 64rem, \`xl-\` = 80rem.
- State prefixes (animation effects only): \`hover-\`, \`active-\`, \`focus-\`, and \`flip-<effect>\`
  (plays the effect in reverse on toggle). Effects require \`transition\` on the element.

## Layout & structure

- **\`centered\`** — named-track grid centering content in the reading \`measure\` track.
  Widen a **direct child** by adding \`breakout\`, \`spotlight\`, or \`fullbleed\` (each
  breakpoint-prefixable) to that child. Track widths are set via \`--width-measure\` /
  \`--width-breakout\` / \`--width-spotlight\` and \`--gutter\`.
- **\`rhythm\`** — relationship-based vertical spacing (margins between headings, paragraphs,
  lists, media) driven by the space scale. Usually paired with \`centered\`.
- **\`split\`** — equal flex columns. Ratio rule: **\`split-<a>-<b>\`** where \`<a>-<b>\` ∈
  \`1-2\`, \`2-1\`, \`1-3\`, \`3-1\`, \`1-4\`, \`4-1\`, \`2-3\`, \`3-2\` (breakpoint-prefixable).
- **Flex** — \`flex\`, \`flex-row\`, \`flex-col\`; \`g\` for gap (space-scale token).
- **Alignment** — \`items-{start,center,end,stretch}\`, \`justify-{start,center,end,between}\`,
  text align \`text-{start,center,end}\` (all breakpoint-prefixable).
- **Display** — \`block\`, \`inline\`, \`inline-block\`, \`flex\`, \`grid\`, \`hidden\`
  (breakpoint-prefixable, e.g. \`md-hidden\`).
- **Accessibility** — \`sr-only\` / \`not-sr-only\` (breakpoint-prefixable).
- **State hooks** — \`is-active\`, \`is-open\` (styling flags toggled by JS / native state).

## Spacing

The space scale is ${code(ds.spaceScale.names)} exposed as \`--space-<name>\` tokens.
Gap (\`g\`) and \`rhythm\` margins consume these tokens; prefer \`rhythm\` for vertical flow
rather than per-element margins.

## Typography

Rule: **\`font-<role>\`** — role ∈ ${code(typeRoles)}. Each role carries its own family,
size (from the type scale ${code(ds.typeScale.names)}), tracking, transform, and weight.
Families: ${code(Object.keys(ds.typography.families))} (\`--font-*\`).

## Colour

Rule: **\`<util>-<color>\`** — util ∈ ${code(utils)}; \`<color>\` is either a **named ramp**
step or a **semantic role**.

- Named ramps: ${code(ramps)}. Steps: base (no suffix) + ${code(nonBase)} — e.g. \`bg-pine\`
  (base), \`text-navy-xl\`, \`border-grey-d\`.
- Semantic roles: ${code(roles)} — e.g. \`bg-brand-primary\`, \`text-danger\`. Roles remap
  automatically under \`:root[data-brx-theme="dark"]\`.

## Shadows

Rule: **\`drop-shadow-<size>\`** — size ∈ ${code(shadows)} (applied as a \`filter\`, so it
follows non-rectangular shapes).

## Animation

Rule: **\`<effect>\`** (with the state/flip prefixes above) — effect ∈ ${code(effects)}.
Composed **journeys** chain multiple effects into one entrance: rule \`<parts>-journey\`
(e.g. \`fade-slide-journey\`, \`fade-scale-blur-journey\`). All require \`transition\` on the
element; scroll-linked entrances resolve within the first portion of the element's scroll.

## Component patterns

Each pattern is a base class \`<pattern>\` with interaction states (hover/active/focus-visible)
baked in; coloured patterns add role variants via rule **\`<pattern>-<role>\`**.

- Patterns: ${code(patterns)}.
- Roles (for coloured patterns like \`badge\`, \`tag\`, \`status\`, \`button\`):
  ${code(patternRoles)} — e.g. \`badge-success\`, \`button-danger\`. The default (unsuffixed)
  variant uses the brand-primary role.
- Shape primitives: \`--br-<name>\` radii — ${code(Object.keys(ds.patterns.radii ?? {}))}.
`;
}

// Reserved index.md files: NO frontmatter, OKF listing form (`* [Title](path) - desc`).

function renderTopIndex(): string {
  return `${INDEX_NOTE}

# Vitops design system

LLM-oriented documentation bundle (Open Knowledge Format) for the Vitops design system — a
variable-driven CSS framework plus progressively-enhanced web components, generated from
\`src/design-system.json\` and published alongside the deployed theme.

# Contents

* [CSS framework](css/) - the class vocabulary (colour, type, space, layout, animation, component patterns), stated as naming rules
* [Bricks Builder](bricks/) - custom elements and how to style them
`;
}

function renderCssIndex(): string {
  return `${INDEX_NOTE}

# CSS framework

# Contents

* [Class vocabulary](classes.md) - every utility and component class, summarized by naming rule
`;
}

function renderBricksIndex(): string {
  return `${INDEX_NOTE}

# Bricks Builder integration

# Styling

Prefer adding the framework **CSS classes** — see [/css/classes.md](../css/classes.md) — in a
Bricks element's "CSS classes" field over hand-setting spacing, colour, or typography through
the Bricks Builder property panels. The classes encode the design system's tokens, responsive
grammar, and interaction states, so they stay consistent, respond to theme / dark mode, and
update with the system. Values typed directly into Bricks' property controls are one-off,
drift from the system, and don't react to theme changes — reserve them for genuinely bespoke,
one-element cases.

# Contents

* [Elements reference](elements.md) - every custom Vitops element, its controls, defaults, seeded children and keywords
* [Class vocabulary](../css/classes.md) - the framework CSS classes to apply to elements
`;
}

function main() {
  const ds = JSON.parse(readFileSync(DS_PATH, 'utf8')) as DesignSystem;

  mkdirSync(join(OUT_DIR, 'bricks'), { recursive: true });
  mkdirSync(join(OUT_DIR, 'css'), { recursive: true });

  // Reserved index.md listings + non-reserved concept docs (frontmatter'd).
  const files: Array<[string, string]> = [
    [join(OUT_DIR, 'index.md'), renderTopIndex()],
    [join(OUT_DIR, 'css', 'index.md'), renderCssIndex()],
    [join(OUT_DIR, 'css', 'classes.md'), renderCssClasses(ds)],
    [join(OUT_DIR, 'bricks', 'index.md'), renderBricksIndex()],
    [join(OUT_DIR, 'bricks', 'elements.md'), renderElementsDoc()],
  ];
  for (const [path, content] of files) writeFileSync(path, content);
  console.log(`generate-docs: wrote ${files.length} files under ${OUT_DIR}/`);
}

main();
