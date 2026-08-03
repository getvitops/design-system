/**
 * OKF documentation bundle generator (ported from the repo's `generate-docs.ts`).
 *
 * Pure: `generateDocs(ds, assetsDir)` returns a `{ relPath: markdown }` map for the
 * Open Knowledge Format tree (top index, css/, bricks/), reading the Bricks element
 * PHP from `<assetsDir>/bricks/elements`. No filesystem writes — the caller decides
 * where the bundle lands (e.g. `<outDir>/docs`).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { jsonSchema, SCHEMA_URL, type DesignSystem } from './schema.ts';
import { BASE_HOOK, DARK_SEL, REQUIRED_ROLES, SYSTEM_DARK_SEL, TW_CLASH } from './shared.ts';
import { expandPalette } from './tokens.ts';

const DS_PATH = 'design-system.json';

// Curated element display order (by $name, sans the vitops- prefix). Unlisted
// elements fall to the end alphabetically so new ones still appear.
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
    const c = src[i] as string;
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }
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
      i++;
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
    if (
      (c >= '0' && c <= '9') ||
      (c === '-' && (src[i + 1] as string) >= '0' && (src[i + 1] as string) <= '9')
    ) {
      let s = c;
      i++;
      while (i < n && (src[i] as string) >= '0' && (src[i] as string) <= '9') s += src[i++];
      toks.push({ t: 'num', v: s });
      continue;
    }
    if (/[A-Za-z_\\]/.test(c)) {
      let s = c;
      i++;
      while (i < n && /[A-Za-z0-9_\\]/.test(src[i] as string)) s += src[i++];
      toks.push({ t: 'id', v: s });
      continue;
    }
    i++;
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
      if (this.peek()?.t === 'punc' && this.peek()?.v === '(') {
        this.next();
        if (t.v === 'array') return this.parseBody(')');
        const args = this.parseCallArgs();
        return args.find((a) => typeof a === 'string') ?? args[0] ?? '';
      }
      return t.v;
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
    this.next();
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
        // PHP array keys are scalars; stringify objects defensively.
        map[typeof first === 'object' && first !== null ? JSON.stringify(first) : String(first)] =
          val;
        keyed = true;
      } else {
        list.push(first);
      }
      if (this.peek()?.t === 'punc' && this.peek()?.v === ',') this.next();
    }
    this.next();
    return keyed ? map : list;
  }
}

function parsePhpLiteral(text: string): Json {
  return new Parser(tokenize(text)).parseValue();
}

// ── Source-region helpers ────────────────────────────────────────────────────
function matchBalanced(src: string, open: number): number {
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const stack: string[] = [];
  let i = open;
  const n = src.length;
  while (i < n) {
    const c = src[i] as string;
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
    if (c in pairs) stack.push(pairs[c] as string);
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

function methodBody(src: string, name: string): string | null {
  const m = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)`).exec(src);
  if (!m) return null;
  const brace = src.indexOf('{', m.index + m[0].length);
  if (brace < 0) return null;
  const end = matchBalanced(src, brace);
  return src.slice(brace + 1, end - 1);
}

function literalAt(src: string, fromIdx: number): { text: string; end: number } | null {
  let i = fromIdx;
  while (i < src.length && /\s/.test(src[i] as string)) i++;
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
  return m ? (m[1] ?? null) : null;
}

function extractDocblock(src: string): string {
  const m = /\/\*\*([\s\S]*?)\*\//.exec(src);
  if (!m) return '';
  const lines = (m[1] as string)
    .split('\n')
    .map((l) => l.replace(/^\s*\*?\s?/, '').replace(/\s+$/, ''));
  while (lines.length && lines[0] === '') lines.shift();
  if (lines.length && /Bricks Builder\)\./.test(lines[0] as string)) lines.shift();
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
    const key = m[1] as string;
    if (m[2]) continue;
    const lit = literalAt(body, m.index + m[0].length);
    if (!lit) continue;
    const def = parsePhpLiteral(lit.text);
    if (def && typeof def === 'object' && !Array.isArray(def))
      controls.push({ key, def: def as Record<string, Json> });
    re.lastIndex = lit.end;
  }
  return controls;
}

function extractChildren(src: string): string[] {
  const body = methodBody(src, 'get_nestable_children');
  if (!body) return [];
  const labels: string[] = [];
  const re = /'label'\s*=>\s*esc_html__\(\s*'([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) labels.push(m[1] as string);
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
/** Stringify a parsed-PHP Json value for prose (objects → JSON, not [object Object]). */
const asText = (v: Json | undefined): string =>
  v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);

function controlLine(c: Control): string {
  const def = c.def;
  if (def.type === 'info') return `- _Note:_ ${asText(def.content)}`;
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
    const raw = asText(def.default);
    const shown = options && options[raw] ? options[raw] : raw;
    meta.push(`default \`${shown}\``);
  }
  if (def.placeholder !== undefined && def.placeholder !== '')
    meta.push(`placeholder \`${asText(def.placeholder)}\``);
  if (def.min !== undefined || def.max !== undefined)
    meta.push(
      `range ${def.min != null ? asText(def.min) : '–'}–${def.max != null ? asText(def.max) : '∞'}`,
    );
  const tail: string[] = [];
  if (def.description) tail.push(asText(def.description));
  if (options)
    tail.push(
      `Options: ${Object.values(options)
        .map((o) => `\`${o}\``)
        .join(', ')}.`,
    );
  if (Array.isArray(def.css) && def.css.length) {
    const first = def.css[0];
    if (first && typeof first === 'object' && !Array.isArray(first) && 'property' in first)
      tail.push(`Bound to \`${asText((first as Record<string, Json>).property)}\`.`);
  }
  if (def.type === 'repeater' && def.fields && typeof def.fields === 'object') {
    const fields = Object.values(def.fields as Record<string, Json>)
      .map((f) =>
        f && typeof f === 'object' && !Array.isArray(f)
          ? asText((f as Record<string, Json>).label)
          : null,
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

// ── OKF helpers ──────────────────────────────────────────────────────────────
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
  lines.push('generator: "@getvitops/generator"');
  return `---\n${lines.join('\n')}\n---`;
}

const INDEX_NOTE = `<!-- GENERATED by @getvitops/generator — do not edit; regenerate with \`vitops generate\`. -->`;

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

function renderElementsDoc(elementsDir: string): string {
  const files = existsSync(elementsDir)
    ? readdirSync(elementsDir).filter((f) => f.endsWith('.php'))
    : [];
  const elements: Element[] = [];
  for (const f of files) {
    try {
      const el = parseElement(readFileSync(join(elementsDir, f), 'utf8'));
      if (el) elements.push(el);
    } catch {
      /* skip unparseable element */
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
  return `${ELEMENTS_PREAMBLE}\n${body}`;
}

// ── CSS framework reference (rule-summarized, from the config) ────────────────
const code = (xs: string[]) => xs.map((x) => `\`${x}\``).join(', ');

function renderCssClasses(ds: DesignSystem): string {
  const expanded = expandPalette(ds.colors.palette as Record<string, unknown>);
  const ramps = Object.keys(expanded);
  const roles = Object.keys(ds.colors.roles ?? {});
  const utils = ds.colors.utilities ?? ['bg', 'text', 'icon', 'border'];
  const typeRoles = Object.keys(ds.typography?.roles ?? {});
  const shadows = Object.keys(ds.shadows ?? {});
  const effects = Object.keys(ds.animations?.effects ?? {});
  // Split by keyframe family, because only composite/paint effects get the
  // hover-/focus-/active- state variants — `.transition` deliberately doesn't
  // transition `height`, so a `hover-size-grow` would be a class that resolves
  // to nothing. Listing every effect under "with the state prefixes above" is
  // what sent the docs site rendering exactly that.
  const stateful = Object.entries(ds.animations?.effects ?? {})
    .filter(([, e]) => e.kf === 'composite' || e.kf === 'paint')
    .map(([name]) => name);
  const keyframeOnly = effects.filter((name) => !stateful.includes(name));
  const items = (ds.patterns?.items ?? {}) as Record<
    string,
    { roles?: string[]; default_role?: string }
  >;
  const patterns = Object.keys(items);
  const patternRoles = Array.from(
    new Set(
      Object.values(items).flatMap(
        (p) => [p.default_role, ...(p.roles ?? [])].filter(Boolean) as string[],
      ),
    ),
  );
  const spaceNames = ds.spaceScale?.names ?? [];
  const typeNames = ds.typeScale?.names ?? [];
  const families = Object.keys(ds.typography?.families ?? {});
  const radii = Object.keys(ds.patterns?.radii ?? {});

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

The tokens themselves are authored in \`design-system.json\` — see
[/authoring.md](../authoring.md); the systems behind them are explained in
[/concepts/](../concepts/index.md); per-format output differences (including which of
these utilities Tailwind provides natively) in [/formats.md](../formats.md).

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
- **\`split\`** — a two-column pair. Ratio rule: **\`split-<a>-<b>\`** where \`<a>-<b>\` ∈
  \`1-2\`, \`2-1\`, \`1-3\`, \`3-1\`, \`1-4\`, \`4-1\`, \`2-3\`, \`3-2\` (breakpoint-prefixable); equal
  columns without one. The ratio is a flex **basis**, so a column's padding counts
  inside its share, and \`min-inline-size: 0\` is built in so long unbreakable content
  can't stretch a column past it.
  - **Stacking is \`flex-col\`** — there is no split-specific class for it:
    \`class="split flex-col md-split-1-2"\` is stacked below 48rem and 1:2 above,
    because the \`<bp>-\` ratio classes assert the row. While stacked the ratio goes
    inert on its own (a percentage basis against an auto-height column resolves as
    \`content\`), unless you give the split a definite \`block-size\`.
  - **\`split-reverse\`** — swaps the two panels (breakpoint-prefixable). Implemented
    as \`order\` on the first child, so it reverses on whichever axis the split is
    currently on: bare, it swaps the columns in a row AND the rows in a stack;
    scoped (\`md-split-reverse\`) it swaps only once there are two columns — media
    first in source so it leads on mobile, on the right at width. The ratio stays
    with the source-first child, not with the visual position.
    - **Accessibility:** reversing makes visual order disagree with DOM order, and
      focus order follows the DOM (WCAG 2.4.3 Focus Order). Put focusable content in
      **only one** of the two panels, or the tab order will not be linear. The
      pattern declares \`reading-flow: flex-visual\`, which fixes this properly where
      it is supported; support is not yet broad enough to rely on.
- **Flex** — \`flex\`, \`flex-row\`, \`flex-col\`, \`flex-row-reverse\`, \`flex-col-reverse\`
  (all breakpoint-prefixable).
- **Alignment** — \`items-{start,center,end,stretch}\`, \`justify-{start,center,end,between}\`,
  text align \`text-{start,center,end}\` (all breakpoint-prefixable).
- **Display** — \`block\`, \`inline\`, \`inline-block\`, \`flex\`, \`grid\`, \`hidden\`
  (breakpoint-prefixable, e.g. \`md-hidden\`).
- **Accessibility** — \`sr-only\` / \`not-sr-only\` (breakpoint-prefixable).
- **State hooks** — \`is-active\`, \`is-open\` (styling flags toggled by JS / native state).

## Spacing

The space scale is ${code(spaceNames)} exposed as \`--space-<name>\` tokens.
\`rhythm\` margins consume these tokens; prefer \`rhythm\` for vertical flow rather than
per-element margins.

Rule: **\`gap-<name>\`**, **\`gap-x-<name>\`** (column) and **\`gap-y-<name>\`** (row), name ∈
${code(spaceNames)} — all breakpoint-prefixable (\`md-gap-l\`, \`@md:gap-l\`). These are the
framework's own utilities in every format: the fluid steps are deliberately kept out of
Tailwind's \`--spacing-*\` namespace (named keys there shadow the size scales, so
\`max-w-7xl\` would resolve to \`var(--spacing-7xl)\`), which means Tailwind's numeric
\`gap-4\` still uses its own multiplier and coexists with these.

## Typography

Rule: **\`font-<role>\`** — role ∈ ${code(typeRoles)}. Each role carries its own family,
size (from the type scale ${code(typeNames)}), tracking, transform, weight and \`text-wrap\`.
Families: ${code(families)} (\`--font-*\`).

Because the role owns \`text-wrap\`, a heading is balanced and copy is \`pretty\` with **no
class at all** wherever \`typography.headings\` maps the bare element to a role. Override one
element with \`text-{wrap,nowrap,balance,pretty}\` — the per-element escape hatch, for markup
that carries no role class. (These four are Tailwind's own in the tailwind format.)

## Colour

**Functional tokens are the primary vocabulary** — classes name the *job*, not the tone, and
every one remaps automatically under \`${DARK_SEL}\` (background/text ends
swap; \`solid\` fills stay mode-stable with a computed \`on-\` foreground). Prefer these over
raw steps.

**Role names are yours.** \`colors.roles\` is an open map: add a key, and the generator emits
that role's full token set, its dark flip and every utility below. Your config
currently defines ${code(roles)}. Six of those are a **required core** — the framework's own
component CSS references \`${REQUIRED_ROLES.join('`, `')}\` with no fallback, so removing one
leaves those components uncoloured (\`vitops validate\` warns). Everything beyond them is free.

The rule is one shape — **\`<target>-<role>[-<variant>]\`**, target ∈ \`bg\` \`text\` \`icon\`
\`border\` — and the class name is exactly its token name minus \`--color-\`. Variants are
ordinal (\`xx-muted\` < \`x-muted\` < \`muted\` < bare < \`bold\` < \`x-bold\`) and sparse: only the
cells that hold their contrast target exist.

**Which cells exist depends on the role's \`kind\`:**

*Surface roles* (page and panel colours):

- **Backgrounds** — \`bg-<role>\` (the card/panel), \`bg-<role>-muted\` (the page behind it),
  \`bg-<role>-x-muted\` (well / inset), \`bg-<role>-bold\` and \`-x-bold\` (inverse surface).
  Elevation is *which* token you reach for, not a raised/sunken pair.
- **Content** — \`text-<role>\` (body), \`text-<role>-bold\`, \`text-<role>-muted\` (secondary),
  \`text-<role>-x-muted\` (placeholder) and \`-xx-muted\` (disabled). The last two are
  contrast-exempt by design.
- **Borders** — \`border-<role>-muted\` (hairline), \`border-<role>\`, \`border-<role>-bold\`
  (the one guaranteed to carry a boundary on its own).

*Chromatic roles* (signal colours) — **there is no bare \`bg-<role>\`**; say tint or solid:

- **Tints** — \`bg-<role>-x-muted\` (alert wash), \`bg-<role>-muted\` (badge).
- **Solids** — \`bg-<role>-solid\`, \`-solid-bold\` (hover), \`-solid-x-bold\` (active), each
  pairing with \`text-on-<role>\` for a guaranteed-contrast foreground.
- **Content** — \`text-<role>\`, \`text-<role>-bold\`. There is deliberately no
  \`text-<role>-muted\`: it could not hold its contrast target off a light surface, so soften
  coloured text with weight or size instead.
- **Borders** — \`border-<role>\`, \`border-<role>-bold\` (decorative status edges).

Both kinds also get **\`icon-<role>\`** — a separate non-text tier, so a glyph may run more
vivid than text — plus \`glass\` (translucent surface + backdrop blur), the \`--overlay\` scrim
and \`--color-border-focus\` for focus rings.

Everyday pairings, using the roles this config defines: page
\`bg-${roles[0] ?? 'neutral'}-muted\`, cards \`bg-${roles[0] ?? 'neutral'}\` on top of it, body
\`text-${roles[0] ?? 'neutral'}\`, captions \`text-${roles[0] ?? 'neutral'}-muted\`; buttons
\`bg-${roles[2] ?? roles[0] ?? 'ui-primary'}-solid text-on-${roles[2] ?? roles[0] ?? 'ui-primary'}\`;
alerts \`bg-danger-x-muted text-danger\`.

**Raw scale** (secondary / fine control) — rule \`<util>-<hue>-<step>\` with util ∈
${code(utils)}: every hue is an 11-step OKLCH scale generated from its seed (or fixed brand
tones), numeric steps \`50\` … \`950\` (tinted near-white → tinted near-black) — e.g.
\`bg-${ramps[0] ?? 'brand'}-100\`, \`text-${ramps[0] ?? 'brand'}-800\`. Hues: ${code(ramps)}.

> **Raw scale classes are frozen — they do NOT remap in dark mode.**
> \`bg-${ramps[0] ?? 'brand'}-800\` is that exact colour in every appearance. The automatic
> dark flip described above applies **only** to the functional role tokens, because
> \`--color-<hue>-<step>\` is emitted once and never re-pointed under \`${DARK_SEL}\`.
> A raw step on a page that can switch appearance is a latent bug: it looks correct in
> whichever mode you built it in and inverts in the other.
>
> If you are reaching for a raw step, you usually want a **role** instead — and roles are
> extensible, so adding one is a two-line config change:
>
> | instead of | use | why |
> | --- | --- | --- |
> | \`bg-<hue>-50\` / \`-950\` | \`bg-<role>\` (surface kind) | the card plane, flips automatically |
> | \`bg-<hue>-100\` / \`-900\` | \`bg-<role>-muted\` | the page, or a chromatic tint |
> | \`bg-<hue>-500\`…\`-700\` | \`bg-<role>-solid\` | vivid fill, mode-stable, pairs with \`text-on-<role>\` |
> | \`text-<hue>-950\` / \`-50\` | \`text-<role>\` | contrast-guaranteed body text |
> | \`text-<hue>-800\` / \`-200\` | \`text-<role>-muted\` | secondary text |
> | \`border-<hue>-200\` / \`-800\` | \`border-<role>\` | |
>
> Raw steps stay the right tool for genuinely fixed colours — a brand mark, a chart series,
> an illustration — where the value must not move between appearances.

## Shadows

Rule: **\`drop-shadow-<size>\`** — size ∈ ${code(shadows)} (applied as a \`filter\`, so it
follows non-rectangular shapes).

## Animation

An effect carries no motion of its own — it sets \`--<prop>-from\`/\`-to\` and picks a keyframe.
A **driver** supplies the motion, and you always compose one of each:

- \`animate-view\` — plays as the element crosses the viewport
- \`animate-scroll\` — scrubs against page scroll
- \`animate-trigger\` — time-based; plays once when \`.is-active\` / \`[data-active]\` is set
- \`transition\` — transitions the same from/to vars, so it reverses on a state flip

Rule: **\`<effect>\`** — effect ∈ ${code(effects)}. The state/flip prefixes above pair with
\`transition\` and apply to every one of them.

Each state matches the element **or its direct parent** (\`.hover-<fx>:hover, :hover > .hover-<fx>\`),
which is what makes \`reveal-*\` usable: it rests at a zero-area \`clip-path\`, and \`clip-path\` clips
hit-testing as well as painting, so the element itself can never be hovered.${
    keyframeOnly.length
      ? `

${code(keyframeOnly)} animate \`height\`, the only stage that reflows and the only one behind a
feature gate: \`0 → auto\` is not interpolable without \`interpolate-size: allow-keywords\`, so
\`transition\` declares \`height\` only inside an \`@supports\` for it. The \`layout\` **keyframe**
has the same dependency — this is not a limit of the transition driver.`
      : ''
  }

**When it plays.** \`animate-view\` and \`.is-active\` are both timed off the element's **midpoint**:
motion starts once that midpoint is 10% of the viewport in, and a one-shot entrance completes at
25%. Both stops are the element's position on screen rather than a fraction of its own height, so a
small card and a full-bleed section behave alike. Shift the window with \`--anim-start\` /
\`--anim-end\`, or replace it outright with \`--anim-range\`.

Composed **journeys** chain multiple effects into one entrance: rule \`<parts>-journey\`
(e.g. \`fade-slide-journey\`, \`fade-scale-blur-journey\`). They need a **keyframe** driver, not
\`transition\`. A journey is entry → hold → exit, so it starts on that same 10% pivot but runs to the
end of the exit phase — the hold occupies the middle of the crossing instead of the bottom edge of
the screen.

**\`stagger\`** on a parent offsets each child by \`--stagger-amount\` (time-based drivers) and by
\`--stagger-range-step\` (scroll-driven ones — \`animation-delay\` is ignored on a progress-based
timeline). Journeys set an explicit range and opt out.

## Component patterns

Each pattern is a base class \`<pattern>\` with interaction states (hover/active/focus-visible)
baked in; coloured patterns add role variants via rule **\`<pattern>-<role>\`**. (How the
pattern CSS is assembled — token cascade, \`--p-<pattern>\`-style override hooks, state
shortcuts — is explained in [/concepts/patterns.md](../concepts/patterns.md).)

- Patterns: ${code(patterns)}.
- Roles (for coloured patterns — \`badge\`, \`tag\`, \`status\`, \`cta\`, \`btn\`, …):
  ${code(patternRoles)} — e.g. \`badge-success\`, \`cta-danger\`. A pattern that also styles an
  element accepts the bare role class too (\`<button class="danger">\`). The default
  (unsuffixed) variant uses the pattern's \`default_role\`.
- Shape primitives: \`--br-<name>\` radii — ${code(radii)}.
`;
}

// ── design-system.json authoring reference (walked from the JSON Schema) ─────
// Field docs are rendered from `jsonSchema`'s `description` metadata (authored
// once in schema.ts via `desc()`), so this reference cannot drift from validation.

interface JsonSchemaNode {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  additionalProperties?: JsonSchemaNode | boolean;
  anyOf?: JsonSchemaNode[];
  items?: JsonSchemaNode;
  enum?: unknown[];
}

const isPrimitive = (n: JsonSchemaNode): boolean =>
  !n.properties && !n.anyOf && n.type != null && n.type !== 'object' && n.type !== 'array';

function typeLabel(node: JsonSchemaNode): string {
  if (node.enum) return node.enum.map(String).join(' | ');
  if (node.anyOf)
    return node.anyOf.every(isPrimitive) ? node.anyOf.map((v) => v.type).join(' | ') : 'one of';
  if (node.type === 'array') {
    const it = node.items;
    if (it?.enum) return `array of ${it.enum.map(String).join(' | ')}`;
    return it?.type && it.type !== 'object' ? `array of ${it.type}` : 'array';
  }
  if (node.type === 'object') {
    const ap = node.additionalProperties;
    return ap && typeof ap === 'object' ? 'map' : 'object';
  }
  return node.type ?? 'value';
}

/** A node's documentable children: object properties, map values, or array items. */
function childEntries(
  node: JsonSchemaNode,
): Array<{ label: string; node: JsonSchemaNode; required: boolean }> {
  if (node.properties) {
    const req = node.required ?? [];
    return Object.entries(node.properties).map(([k, v]) => ({
      label: k,
      node: v,
      required: req.includes(k),
    }));
  }
  const ap = node.additionalProperties;
  if (ap && typeof ap === 'object' && (ap.description || ap.properties || ap.anyOf))
    return [{ label: '<name>', node: ap, required: false }];
  if (node.items && (node.items.description || node.items.properties || node.items.anyOf))
    return [{ label: '[items]', node: node.items, required: false }];
  return [];
}

function renderSchemaNode(
  label: string,
  node: JsonSchemaNode,
  required: boolean,
  depth: number,
  out: string[],
): void {
  const indent = '  '.repeat(depth);
  const meta = `(${typeLabel(node)}${required ? ', required' : ''})`;
  out.push(`${indent}- \`${label}\` ${meta}${node.description ? ` — ${node.description}` : ''}`);
  if (depth >= 3) return;
  if (node.anyOf && !node.anyOf.every(isPrimitive)) {
    for (const variant of node.anyOf) {
      out.push(`${indent}  - *one of*${variant.description ? ` — ${variant.description}` : ''}`);
      for (const c of childEntries(variant))
        renderSchemaNode(c.label, c.node, c.required, depth + 2, out);
    }
    return;
  }
  for (const c of childEntries(node)) renderSchemaNode(c.label, c.node, c.required, depth + 1, out);
}

function renderAuthoring(): string {
  const schema = jsonSchema as unknown as JsonSchemaNode;
  const required = schema.required ?? [];
  const sections: string[] = [];
  for (const [key, node] of Object.entries(schema.properties ?? {})) {
    if (key === '$schema') continue;
    const parts: string[] = [`## \`${key}\`${required.includes(key) ? '' : ' *(optional)*'}`];
    if (node.description) parts.push('', node.description);
    const bullets: string[] = [];
    for (const c of childEntries(node)) renderSchemaNode(c.label, c.node, c.required, 0, bullets);
    if (bullets.length) parts.push('', ...bullets);
    sections.push(parts.join('\n'));
  }
  return `${frontmatter({
    type: 'Config Reference',
    title: 'Vitops — design-system.json authoring reference',
    description:
      'Every field of the design-system.json config, generated from the published JSON Schema so it always matches validation.',
    resource: DS_PATH,
    tags: ['config', 'schema', 'authoring', 'design-system'],
  })}

# \`design-system.json\` authoring reference

The single source of truth every output format is generated from. Each consumer authors
their own config — there is no shared canonical token set. The field docs below are
rendered from the published JSON Schema, so they always match what \`vitops validate\`
enforces.

- Set \`"$schema": "${SCHEMA_URL}"\` in the config for editor autocomplete + validation.
- Scaffold a starter config with \`vitops init\`; check one with \`vitops validate\`.
- **This can be a standalone file, or live inside a site config.** Anywhere the
  toolchain takes a config — \`--input\`, the Vite plugin, the Astro integration's
  \`css.input\` — that file may be a \`design-system.json\` or the larger site config
  that embeds one under \`designSystem.themes.<name>\`. They are told apart by shape,
  and the fields below are the same either way. A site config additionally supplies
  the site-level facts generation reads (its default colour scheme, legal documents,
  icon sprite), so the path is declared once rather than per option.
- The *why* behind each section: [colour system](concepts/color.md),
  [type & space scales](concepts/scales.md), [component patterns](concepts/patterns.md).
- What each output format does with these tokens: [formats.md](formats.md).

${sections.join('\n\n')}
`;
}

// ── Output formats reference ──────────────────────────────────────────────────
function renderFormats(ds: DesignSystem): string {
  const clashList = Array.from(TW_CLASH).sort();
  const spaceName = ds.spaceScale?.baseline ?? ds.spaceScale?.names?.[0] ?? 'm';
  return `${frontmatter({
    type: 'Formats Reference',
    title: 'Vitops — output formats (tailwind vs css vs bricks vs design)',
    description:
      'What each vitops generate format emits, what the target platform provides instead, and the Tailwind-specific rules (which framework utilities are stripped in favour of Tailwind defaults).',
    resource: DS_PATH,
    tags: ['formats', 'tailwind', 'bricks', 'css', 'design', 'design-system'],
  })}

# Output formats — \`tailwind\` vs \`css\` vs \`bricks\` vs \`design\`

One config, four targets: \`vitops generate --format <tailwind|css|bricks|design>\`. Three of
them are stylesheets, and across those the **class vocabulary is the same** (see
[css/classes.md](css/classes.md)); what differs is which layers the generator emits versus
which the platform provides, and the variant separator (\`-\` in CSS/Bricks, \`:\` / \`@\` in
Tailwind). The fourth, \`design\`, emits no CSS at all.

\`--format\` takes a comma-separated list, so the brief composes with a stylesheet:
\`vitops generate --format css,design\`.

## \`tailwind\` — single-file Tailwind v4 layer

Emits one self-contained \`tailwind.css\` (plus \`tokens.json\`): \`@import "tailwindcss"\`,
\`@theme\` tokens, the framework's structural CSS + component patterns inlined, and
\`@utility\` definitions for the bespoke families (type roles, animation effects,
split ratios, track placement).

**Use Tailwind's own utilities for these class names.** The framework's rules for them are
deliberately stripped from the bundle because Tailwind provides them natively — writing
them still works, but they are Tailwind's, not the framework's:

${clashList.map((c) => `\`${c}\``).join(', ')}

Other Tailwind-specific behaviour:

- **Variants are Tailwind's job.** No pre-expanded breakpoint/state classes are emitted
  (the framework's \`@container (min-width: …)\` **variant** blocks are dropped; component
  container queries such as the sitenav's desktop switch are kept); use Tailwind syntax —
  \`@md:split-1-2\`, \`hover:flip-fade-in\`. Container breakpoints are registered as
  \`--container-{sm,md,lg,xl}\` = 30/48/64/80rem, backing the \`@sm:\`…\`@xl:\` variants.

  > **Three spellings, and only two of them work here.**
  >
  > | you write | in \`tailwind\` | note |
  > | --- | --- | --- |
  > | \`@md:flex-row\` | ✅ container query | the framework's breakpoints (48rem) |
  > | \`md:flex-row\` | ✅ media query | **Tailwind's** breakpoints, which differ — \`sm:\` is 40rem where \`@sm:\` is 30rem |
  > | \`md-flex-row\` | ❌ silently nothing | the css/bricks spelling; not emitted in this format |
  >
  > \`md-*\` is the trap: it is a real class in \`css\`/\`bricks\` and a no-op here, and
  > nothing errors — the element simply never changes at the breakpoint. Prefer \`@md:\`
  > so one vocabulary of breakpoints applies throughout.

- **Overriding \`--container-*\` also moves Tailwind's width scale.** Registering the
  framework breakpoints in \`@theme\` re-points \`max-w-sm\`…\`max-w-xl\` at the same values,
  so \`max-w-md\` is 48rem here rather than Tailwind's stock 28rem. Use
  \`max-w-(--container-md)\` style arbitrary values if you need to be explicit.
- **The space scale is NOT mapped into Tailwind's \`--spacing-*\` namespace** (that would
  corrupt Tailwind's numeric multipliers and \`max-w-*\` sizes). Numeric utilities like
  \`p-4\` keep Tailwind's 0.25rem meaning; use the design-system scale via arbitrary
  values — \`p-(--space-${spaceName})\`, \`gap-(--space-${spaceName})\`.
- **Functional colour roles are plain \`:root\` variables, not \`@theme\` colours**, so
  Tailwind doesn't auto-derive utilities from them; the emitted \`@utility\` set
  (\`bg-<role>\`, \`text-<role>-muted\`, …) is the public API. The raw hue scales ARE
  \`@theme\` colours, so native \`bg-<hue>-500\`-style utilities work.

  This split is deliberate and load-bearing. When a token sits in \`@theme\` *and* an
  \`@utility\` of the derived name exists, Tailwind merges both into one rule with the
  \`@theme\` declaration last — regardless of source order. Only palette hues belong in
  \`@theme\`, where nothing competes for the name. Role tokens stay in a plain \`:root\`
  block, and \`format-parity.test.ts\` derives that guard from the emitted token names so
  it cannot go quiet if the grammar moves again.
- **\`colors.utilities\` is a floor here, not a ceiling.** It controls which families get
  explicit role \`@utility\` rules, exactly as in \`css\`/\`bricks\`. But the raw hue scales
  are \`@theme\` colours, and Tailwind derives *every* colour family from those on demand
  (\`ring-\`, \`divide-\`, \`accent-\`, \`caret-\`, …), so hue-step utilities you did not enable
  still resolve in this format.

## \`css\` — standalone bundle

Emits a bundled, self-contained \`styles.css\` + \`tokens.json\` + \`design-manifest.json\`.
The colour and font/scale layers are fully included, and every utility family is
pre-expanded — including breakpoint/state variants with \`-\` separators
(\`md-split-1-2\`, \`hover-fade-in\`). For non-Bricks, non-Tailwind consumers and the
docs build.

**Cascade layers.** The bundle ships three, in precedence order:

\`\`\`
@layer vitops.base, vitops.components, vitops.utilities;
\`\`\`

- \`vitops.base\` — the reset (\`box-sizing: border-box\` on every element and pseudo-element,
  a 16px root, no body margin) and the pure \`:root\` token blocks. Lowest of the three, so
  your own reset overrides it — unlayered, or from a layer you declare before \`vitops.base\`.
- \`vitops.components\` — the animation engine, the structural patterns (\`.rhythm\`,
  \`.centered\`, \`.region\`, \`.split\`, \`.reveal\`) and every UI pattern.
- \`vitops.utilities\` — \`bg-*\`, \`text-*\`, \`border-*\`, \`drop-shadow-*\`, \`font-*\`,
  \`gap-*\`, animation effects, the layout utilities (\`.m-*\`, \`.flex-*\`, \`.items-*\`,
  \`.split-<a>-<b>\`, track placement) and the display/\`sr-only\` families.

So a utility overrides a pattern: \`class="card bg-danger-muted"\` tints the card,
\`class="split flex-col"\` stacks the split, \`class="table text-center"\` centres the table.
Your own unlayered CSS beats all three — see [concepts/patterns.md](concepts/patterns.md) for
the override story and the one gotcha (a reset must be layered and ordered first).

The classification is by RULE, not by file: a partial that mixes patterns and utilities is
split in two rather than shelved whole. \`layout.css\` (patterns) and \`layout-utilities.css\`
(utilities) are the same family in two files for exactly this reason, and the \`tailwind\`
format reaches the same arrangement by its own route — patterns in \`@layer components\`,
utilities as \`@utility\`.

Known gap: the \`typography.headings\` bare-element bindings (\`h1\`, \`h2\`, \`body\`) are
emitted alongside \`.font-<role>\` and so sit in \`vitops.utilities\`, where a tag rule
outranks every pattern — \`<h2 class="pull-quote">\` keeps the heading's font-size in
\`css\`/\`bricks\` and the pattern's in \`tailwind\`, which puts the bindings in \`@layer base\`.
Give the element a \`.font-<role>\` class to pin it either way.

## \`bricks\` — WordPress / Bricks Builder payload

Emits the full deployable theme payload: \`styles.min.css\`, the Bricks import JSONs
(\`bricks-colors-{named,semantic}.json\`, \`bricks-variables.json\`), \`tokens.json\`, the JS
bundles (polyfills / elements / deferred), the Bricks element PHP under \`bricks/\`, and
this docs bundle under \`docs/\`.

- **Bricks provides the token layer.** \`color.css\` and \`type-tokens.css\` are one-line
  stubs: the colour \`:root\` tokens, dark-mode overrides, colour utility classes, fonts,
  and type/space scales are generated live by Bricks' Color / Font / Variables Managers
  from the imported JSONs. Semantic palette entries carry \`darkModeEnabled\` + a \`dark\` ref so
  Bricks emits the dark-mode overrides on import.
- Everything else (patterns, shadows, typography roles, animation effects, structural
  framework CSS) ships in \`styles.min.css\` as in the other formats.
- Pattern states reference shadows by name, compiled to
  \`filter: drop-shadow(var(--shadow-<name>))\`.

## \`design\` — the agent-facing brief

Emits exactly one file, \`DESIGN.md\`, in the
[google-labs-code/design.md](https://github.com/google-labs-code/design.md) format: YAML
front matter carrying the tokens (\`colors\`, \`typography\`, \`rounded\`, \`spacing\`,
\`components\`, with \`{group.token}\` references) followed by a prose body carrying the
rationale. It is meant to be run with \`--out .\` — DESIGN.md conventionally sits at a repo
root beside \`AGENTS.md\`, not in a build directory.

**No CSS, no \`tokens.json\`, nothing else.** This format is a description of the system for
a tool that has to work without it — a coding agent in another repo, a Figma import, a
designer. It is not a build target, and \`vitops lint\` does not accept it.

Three things the format cannot represent, and what is emitted instead:

| Ours | Why it doesn't fit | Emitted as |
| --- | --- | --- |
| fluid \`clamp()\` type / space steps | a spec \`Dimension\` is a number + px/em/rem | the **max** (desktop) value, with the prose saying so |
| the automatic dark flip | the spec has no notion of a second appearance | **light** values only, with the flip explained in prose |
| a \`50%\` radius | same \`Dimension\` restriction | dropped from \`rounded\`, named in the Shapes prose |

Role tokens are emitted as \`{colors.<hue>-<step>}\` **references** into the raw ramps rather
than flattened hexes, so the role → ramp lineage survives the export. \`on-solid\` is the
exception — it is a computed contrast literal with no step behind it.

\`meta.name\` / \`meta.description\` in \`design-system.json\` supply the brand name and the
Overview paragraph; everything else is derived from the config, so the brief cannot drift
from what the other three formats build.
`;
}

// ── Concept docs (colour / scales / patterns) ─────────────────────────────────
function renderColorConcept(ds: DesignSystem): string {
  const hues = Object.keys(ds.colors.palette ?? {});
  const roles = Object.keys(ds.colors.roles ?? {});
  return `${frontmatter({
    type: 'Design Concept',
    title: 'Vitops colour system — seeded scales, target-prefixed tokens, automatic dark mode',
    description:
      'How palette hues become 11-step OKLCH scales on a shared lightness ladder, how semantic roles derive target-prefixed tokens from them, and how dark mode flips automatically.',
    resource: DS_PATH,
    tags: ['color', 'oklch', 'dark-mode', 'design-system'],
  })}

# Colour system

Authoring is two maps in \`design-system.json\` (see [authoring.md](../authoring.md)):
\`colors.palette\` (hues) and \`colors.roles\` (semantic role → hue). Everything else —
scales, role tokens, utilities, dark mode — is derived.

## From seed to scale

Each palette hue becomes an **11-step numeric OKLCH scale**, \`--color-<hue>-50…950\`,
running tinted near-white → tinted near-black. Two authoring modes:

- **Seeded** (\`{ seed, anchors? }\`): the scale is generated from one colour. The seed is
  preserved at its natural lightness step; \`anchors\` pin specific steps and the rest
  interpolate around them.
- **Fixed** (\`{ tones }\`): a brand kit used verbatim — each authored tone lands at its
  nearest step, endpoints are tinted off-white/off-black, no interpolation.

Current hues: ${code(hues)}.

## The token grammar

Every colour token is named:

\`\`\`
--color-<target>-<role>[-<variant>]      target ∈ bg | text | icon | border
\`\`\`

The target sits **inside** the name on purpose. \`--color-bg-danger-muted\` and
\`--color-text-danger-muted\` are different tokens, so there is nothing to arbitrate between
them — an earlier grammar put both on one \`<family>-<role>-<modifier>\` name and needed a
precedence rule, which made half the variants unreachable and the rest non-monotonic.

**The token name is also the utility class name**, minus the \`--color-\` prefix. Write
\`class="bg-danger-muted"\` and you are using \`--color-bg-danger-muted\`. One vocabulary, not
two (see [css/classes.md](../css/classes.md)).

Variants are ordinal — \`xx-muted\` < \`x-muted\` < \`muted\` < (bare) < \`bold\` < \`x-bold\` — and
the tables are **sparse**: only cells that actually hold their contrast target exist.
\`bold\` means *more emphatic in the current appearance*, not darker.

## Role kinds

A role in \`colors.roles\` (currently ${code(roles)}) is one of two kinds, and the kind decides
which tokens exist:

- **\`surface\`** — a page or panel colour. \`bg-<role>\` is the card, \`bg-<role>-muted\` the page
  behind it, \`bg-<role>-x-muted\` a well, \`bg-<role>-bold\` the inverse surface a tooltip sits
  on. Full text scale, and \`border-<role>-bold\` as the contrast-guaranteed boundary.
- **\`chromatic\`** (the default, and what the bare-string form means) — a signal colour.
  Backgrounds split into *tints* (\`bg-<role>-x-muted\`, \`bg-<role>-muted\`) and *solids*
  (\`bg-<role>-solid\`, \`-solid-bold\`, \`-solid-x-bold\`). There is deliberately **no bare
  \`bg-<role>\`**: "how loud?" is a question the author answers. \`text-on-<role>\` is the
  guaranteed foreground for the solid family.

Plus \`--surface-glass\` (translucent surface), \`--overlay\` (scrim) and
\`--color-border-focus\` (the focus ring, taken from \`ui-primary\`'s solid tone).

## Automatic dark mode

Dark mode re-points which step each token reads, under \`${DARK_SEL}\`:
background and text ends of each scale swap, while the **solid family stays mode-stable**
along with the \`text-on-<role>\` foreground computed against it — so a filled button keeps
its identity when the appearance flips. There is no per-appearance scheme grammar to author
and no named steps: a role token means the same *job* in both appearances.

Raw hue steps (\`--color-<hue>-<step>\`) are the exception — they are fixed values and are
**not** re-pointed. Reach for a role token unless you specifically want a colour that
ignores the appearance.

Two attributes, one flip: \`data-brx-theme\` is Bricks' own (Bricks sets it on the
WordPress target), \`data-theme\` is what the shipped \`<color-scheme-toggle>\` writes on
\`<html>\`, so the toggle works on every other target. Set either.

The OS preference is a **second, opt-in block**. Set
\`designSystem.defaultColorScheme: "system"\` in your site config and the same delta is emitted again inside
\`@media (prefers-color-scheme: dark)\`, under
\`${SYSTEM_DARK_SEL}\` — i.e. whenever no explicit choice has been made. That is what makes
\`<color-scheme-toggle>\`'s "System" position resolve to the OS (it *removes* the attribute,
so without this block it fell through to light), and it gives a no-JS page the OS
appearance, which the toggle alone never could. An explicit light choice still wins.

It is opt-in rather than default because turning it on flips a site dark for dark-OS
visitors, which is the site's decision and not the design system's.

## Contrast guarantees

Enforced **at build time** — a violation fails \`generate\`, so an unreadable pairing cannot
ship. In both appearances:

| tier | target | applies to |
| --- | --- | --- |
| text | APCA Lc ≥ 75 | \`text-<role>\` on the role's primary background |
| secondary | Lc ≥ 60 | text on any other background plane; \`text-<role>-muted\`; \`text-on-<role>\` on its solid |
| non-text | Lc ≥ 45 | \`icon-<role>\`, and a surface role's \`border-<role>-bold\` |

Two deliberate exemptions: \`text-<role>-x-muted\` (placeholders) and \`-xx-muted\` (disabled
text) are *required* to look unavailable, and holding them to the body-text bar would defeat
the affordance. Nothing else is exempt.

Chromatic text is checked against the **surface planes it actually sits on**, not only its
own tints — coloured text appears over the page far more often than over its own wash.

A \`tones\` kit thin enough that snapping can't cover a tier is reported rather than shipped;
the fix is another tone, and the failure says so.
`;
}

function renderScalesConcept(ds: DesignSystem): string {
  const t = ds.typeScale;
  const s = ds.spaceScale;
  const scaleLine = (label: string, sc: typeof t): string =>
    sc
      ? `- **${label}**: base \`${sc.base}\` at step \`${sc.names?.[(sc.baseStep ?? 1) - 1] ?? sc.baseStep}\`, ratio ${sc.ratio}${sc.fluid ? ` (${sc.fluid.minRatio} below ${sc.fluid.minVw})` : ''}; steps ${code(sc.names ?? [])}.`
      : `- **${label}**: not configured.`;
  return `${frontmatter({
    type: 'Design Concept',
    title: 'Vitops type & space scales — fluid modular scales',
    description:
      'How typeScale and spaceScale compile to clamp()-based fluid modular scales, and which utilities consume the resulting tokens.',
    resource: DS_PATH,
    tags: ['typography', 'spacing', 'fluid', 'modular-scale', 'design-system'],
  })}

# Type & space scales

Both scales share one model (authored in \`design-system.json\` as \`typeScale\` /
\`spaceScale\` — see [authoring.md](../authoring.md)): a **fluid modular scale**.

## The model

- \`base\` anchors the value at \`baseStep\`; every other step is a power of the \`ratio\`
  away (step n = base × ratio^(n − baseStep)).
- With \`fluid\`, each step compiles to a **\`clamp()\`**: the scale uses \`fluid.minRatio\`
  at/below \`fluid.minVw\` and grows to \`ratio\` at \`fluid.maxVw\`, interpolating between —
  so large steps spread apart on wide viewports and compress on phones, with no
  breakpoint jumps. \`baseline\` names the pivot step that stays closest to \`base\`.
- \`names\` become the token suffixes.

${scaleLine('Type', t)}
${scaleLine('Space', s)}

## What consumes them

- **Type**: \`--text-<name>\` tokens → typography role sizes (\`font-<role>\` classes,
  heading defaults) and text-size utilities.
- **Space**: \`--space-<name>\` tokens → gap (\`g\`), spacing utilities, and \`rhythm\`
  (relationship-based vertical margins between headings, paragraphs, lists, media).
  Prefer \`rhythm\` for vertical flow over per-element margins.
- In the \`tailwind\` format these stay in their own namespaces (\`--text-*\` via \`@theme\`,
  \`--space-*\` as plain vars) — see [formats.md](../formats.md) for why \`--spacing-*\` is
  deliberately not used.
`;
}

function renderPatternsConcept(ds: DesignSystem): string {
  const items = (ds.patterns?.items ?? {}) as Record<string, { group?: string }>;
  const groups = Object.keys(ds.patterns?.groups ?? {});
  const patternNames = Object.keys(items);
  const hookTable = Object.entries(BASE_HOOK)
    .map(([prop, sfx]) => `| \`${prop}\` | \`--${sfx}-<pattern>\` |`)
    .join('\n');
  return `${frontmatter({
    type: 'Design Concept',
    title: 'Vitops component patterns — token cascade, override hooks, states',
    description:
      'How pattern CSS is assembled: the token cascade (defaults → groups → per-pattern overrides), per-pattern override-hook variables, state shortcuts, and role variants.',
    resource: DS_PATH,
    tags: ['patterns', 'components', 'cascade', 'css', 'design-system'],
  })}

# Component patterns — the CSS chain

Patterns (currently ${code(patternNames)}) are authored declaratively under \`patterns\` in
\`design-system.json\` (see [authoring.md](../authoring.md)) and compiled to CSS in a
**components cascade layer** — so utility classes, which live in a later layer, always win over
pattern styling without specificity fights. \`class="card bg-danger-muted"\` tints the card.

The layer names differ by format, because each defers to its host:

| format | layer stack (last wins) |
| --- | --- |
| \`css\`, \`bricks\` | \`vitops.base\` → \`vitops.components\` → \`vitops.utilities\` |
| \`tailwind\` | Tailwind's own \`theme\` → \`base\` → \`components\` → \`utilities\` |

**Your own CSS beats all of it.** Unlayered styles outrank every cascade layer regardless of
specificity, so a plain stylesheet, an Astro scoped \`<style>\`, or a Bricks-authored class
overrides the framework with no \`!important\` and no specificity escalation. That is the
intended override story.

The one thing to watch: a **reset** must be layered too, and ordered *below* the framework —
left unlayered it beats the very component rules it is meant to sit under (a bare
\`p { margin: 0 }\` would defeat \`.rhythm\`). Declare the order before you load the stylesheet,
since layer precedence is fixed by first declaration:

\`\`\`html
<style>@layer my.reset, vitops.base, vitops.components, vitops.utilities;</style>
<link rel="stylesheet" href="/styles.css">
\`\`\`

Put it *after* the link and \`my.reset\` becomes a new name introduced later — which sorts
**last**, i.e. highest priority, and the reset wins. That is the one non-obvious step.

## 1 — Token cascade

Shared geometry resolves through a variable chain, most-specific first:

- \`patterns.defaults\` → \`--<prop>-default\` (cascade-wide fallbacks).
- \`patterns.groups.<group>\` → \`--<prop>-<group>\` (e.g. groups ${code(groups)}); a pattern
  opts in via its \`group\` key.
- Per-pattern: each grouped pattern gets aliases \`--<prop>-<name>-group\` →
  \`var(--<prop>-<group>)\`, and \`overrides\` replace individual aliases with literal values.
- \`patterns.radii\` → \`--br-<name>\` shape primitives; \`patterns.z\` → \`--z-tier-<name>\`.

## 2 — Base declarations & override hooks

Each pattern's \`base\` block is emitted on its selector:

- \`class\` only → \`.<class ?? name>\`, at normal class specificity.
- \`element\` only → a **zero-specificity** \`:where(<element>)\` rule, so author CSS can always
  override it.
- **both** → one \`:where(<element>, .<class>)\` rule (e.g. \`:where(button, .btn)\`). The element
  gets the styling with no class needed, the class carries it to any other tag, and — because the
  whole thing sits at zero specificity — any explicit class wins, including a louder pattern
  (\`.cta\`) or a component's own rule (\`.dialog__close\`).

Geometry properties are wrapped in a **per-pattern override hook**:

| base property | hook variable |
| --- | --- |
${hookTable}

e.g. \`padding: var(--p-btn, 0.4em 0.8em)\` — a consumer restyles every button by setting
\`--p-btn\` on \`:root\`, without touching the pattern. The hook is named after the pattern's
**key**, not its class.

\`background\` and \`background-color\` share the \`bg\` hook, since a pattern may author either.
That is what makes a pattern's fill **undoable** — a flat, border-only card:

\`\`\`html
<!-- via the hook: applies wherever you set it, including :root for all cards -->
<div class="card" style="--bg-card: transparent; --ds-card: none">…</div>

<!-- or compose a utility, which reads better inline and is what most authors want -->
<div class="card bg-transparent" style="--ds-card: none">…</div>
\`\`\`

\`bg-transparent\` and \`bg-inherit\` are emitted for \`css\`/\`bricks\`; in \`tailwind\` they
come from Tailwind itself. There is no utility for the shadow, so \`--ds-card: none\` is the
way to drop it in every format.

Role variants are emitted as their own rules and are **not** wrapped, so setting \`--bg-card\`
tunes the default fill without silently defeating \`.card-danger\`.

## 3 — States

\`states\` (hover / active / focus-visible) compile from shortcuts:

- \`step: n\` — intensify the pattern's colour one rung: fills swap
  \`--color-bg-<role>-solid\` → \`-solid-bold\`; text patterns swap
  \`--color-text-<role>\` → \`--color-text-<role>-bold\`.
- \`scale: 0.97\` — transform scale; \`lift: "<length>"\` — \`translate: 0 calc(-1 * <length>)\`.
- \`shadow: "<name>"\` — \`filter: drop-shadow(var(--shadow-<name>))\`; \`shadow: true\` — the
  generic lift box-shadow.
- \`ring: true\` — focus ring (\`box-shadow\` in the role's solid tone, or
  \`--color-border-focus\` when the pattern has no role; outline removed).
- \`css: { … }\` — raw declarations escape hatch.

Any pattern with states also gets a composed transition block (translate / scale / filter /
box-shadow / colours, \`--interact-duration\` / \`--interact-easing\` overridable). Hover
rules are wrapped in \`@media (hover: hover)\` so touch devices never stick.

## 4 — Role variants

\`roles\` lists semantic colour variants: class patterns emit \`.<pattern>-<role>\`
(\`.badge-success\`). A pattern with an \`element\` emits both the bare role class on the
element and the \`-<role>\` form (\`:where(button, .btn).danger, .btn-danger\`), so the same
variant works on a non-element host — both at class specificity, so neither outranks a
plain class. Fill
patterns set \`background-color: var(--color-bg-<role>-solid)\` +
\`color: var(--color-text-on-<role>)\`; text patterns use \`var(--color-text-<role>)\`, the
token guaranteed legible over a surface in both appearances. \`default_role\` colours the
bare, unsuffixed pattern. States re-apply per variant with the variant's role.
`;
}

// ── Reserved index.md listings (no frontmatter) ──────────────────────────────
function renderTopIndex(): string {
  return `${INDEX_NOTE}

# Vitops design system

LLM-oriented documentation bundle (Open Knowledge Format) for the Vitops design system — a
variable-driven CSS framework plus progressively-enhanced web components, generated from
\`design-system.json\` and published alongside the deployed theme.

# Contents

* [Authoring reference](authoring.md) - every design-system.json field, generated from the JSON Schema
* [Output formats](formats.md) - tailwind vs css vs bricks vs design: what's emitted, what the platform provides, which utilities Tailwind owns
* [Concepts](concepts/) - the colour system, type/space scales, and pattern CSS architecture
* [CSS framework](css/) - the class vocabulary (colour, type, space, layout, animation, component patterns), stated as naming rules
* [Bricks Builder](bricks/) - custom elements and how to style them
`;
}

function renderIconsConcept(): string {
  return `${frontmatter({
    type: 'Design Concept',
    title: 'Vitops icons — one semantic vocabulary across icon sets',
    description:
      'Semantic icon names that resolve per configured set, how the bundle is derived on a server build, and the three delivery paths (astro-icon, astro-iconset, SVG sprite).',
    resource: DS_PATH,
    tags: ['icons', 'svg', 'sprite', 'astro-icon', 'design-system'],
  })}

# Icons

Icons are named by **meaning**, not by set. \`menu\` resolves to \`fa7-solid:bars\`,
\`lucide:menu\` or \`ph:list\` depending on which set the site configures, so changing
sets is a config edit rather than a find-and-replace across templates.

The escape hatch is deliberate and always available: **a name containing \`:\` passes
through untouched**. \`<Icon name="simple-icons:zoho" />\` renders that exact glyph
whether or not the semantic map knows it.

## Declaring them

The \`icons\` block lives in the **site config**, not \`design-system.json\` — it
describes what a site uses, not what the design system defines.

\`\`\`json
{
  "icons": {
    "ui": "ph",
    "brand": "simple-icons",
    "weight": "bold",
    "semantic": ["menu", "close", "arrow-right"],
    "simple-icons": ["zoho", "cloudflare"],
    "sprite": true
  }
}
\`\`\`

\`ui\` and \`brand\` pick which set a semantic name resolves against. Any other key is
an iconify collection name with an explicit list, passed through verbatim.

**\`weight\` is only meaningful for sets that encode weight in the icon NAME.**
Phosphor does (\`list\`, \`list-bold\`, \`list-fill\`), so \`ph\` accepts it; Font Awesome
splits weights across collections instead (\`fa7-solid\` vs \`fa7-regular\`), so there
the weight is part of the prefix and this key is ignored.

## Why the bundle list exists

astro-icon is **zero-config on a static build**. Under \`output: 'server'\` it bundles
*every icon in a set* unless given an \`include\` map — which is why projects end up
hand-maintaining one.

The \`icons\` option on \`getvitops()\` derives it by scanning your source, merged with
whatever you declare. On a static build **no include is passed at all**: there is
nothing to trim there, and a list could only drop a glyph the scan couldn't see.

Two failure modes, treated differently on purpose:

- A name you **declared** that doesn't resolve is a config error and **throws**.
- A name only the **scan** found and can't resolve just **warns** — a bare unmapped
  name is more often a local \`src/icons/*.svg\` than a mistake, and a dev server
  that dies on a template typo is worse than one that tells you.

Names computed at runtime (\`<Icon name={expr} />\`) can't be read statically. They are
reported with file and line, never guessed at — declare them in \`semantic\` or a
per-set list. Run \`vitops icons\` to see the whole report.

## Delivery

| Path | Used by | Needs |
| --- | --- | --- |
| \`astro-icon\` / \`astro-iconset\` | Astro sites | the integration, an optional peer |
| **SVG sprite** (\`icons.svg\`) | Bricks/WordPress, EmDash renderers, plain HTML | \`icons.sprite: true\` |

The sprite is the no-JavaScript path: \`<svg><use href="/vitops/icons.svg#ph--list"></svg>\`.
Ids are the qualified name with \`:\` replaced by \`--\` (\`:\` is not valid in a fragment
identifier), **plus a set-independent \`icon-<name>\` alias for every semantic name** —
so sprite markup survives an icon-set change the same way \`resolveIcon\` protects Astro
call sites.

In WordPress, \`vitops_icon('menu')\` and \`[vitops_icon name="menu"]\` emit that markup,
and a **Vitops → Icon** Bricks element wraps the same helper.

⚠️ An external-file \`<use>\` is **same-origin only** and dead under \`file://\`. Serving
\`dist/\` from a different origin makes every icon vanish with no console error.

## Markup

Always the framework's \`.icon\` box:

\`\`\`html
<span class="icon" aria-hidden="true"><svg>…</svg></span>
\`\`\`

\`.icon\` sizes in \`em\` via \`--icon-size\` (default \`1.25em\`) and sets \`fill: currentColor\`,
so an icon inherits the colour of whatever it sits in. Because \`.cta\` and
\`:where(button, .btn)\` are already \`inline-flex\` with a \`gap\`, **a start or end icon is
child order — not a modifier class**.

Icons are \`aria-hidden\` by default. Pass a label only when the icon carries meaning on
its own; beside a text label it would be announced twice.

Note \`.icon-mask\` is a different thing: the CSS-only adornment path used by
\`.link--icon::before\`, where the glyph is a \`mask-image\` on a pseudo-element and there
is no markup to hang an \`<svg>\` on.
`;
}

function renderConceptsIndex(): string {
  return `${INDEX_NOTE}

# Design-system concepts

# Contents

* [Colour system](color.md) - seeded OKLCH scales on a shared lightness ladder, target-prefixed tokens, automatic dark mode
* [Type & space scales](scales.md) - fluid modular scales and the tokens they emit
* [Component patterns](patterns.md) - token cascade, override hooks, states, role variants
* [Icons](icons.md) - semantic names across icon sets, bundle derivation, sprite delivery
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

/**
 * Build the OKF docs bundle for a config. Returns a `{ relPath: content }` map;
 * the caller writes it wherever the bundle should live (e.g. `<outDir>/docs`).
 */
export function generateDocs(ds: DesignSystem, assetsDir: string): Record<string, string> {
  const elementsDir = join(assetsDir, 'bricks', 'elements');
  return {
    'index.md': renderTopIndex(),
    'authoring.md': renderAuthoring(),
    'formats.md': renderFormats(ds),
    'concepts/index.md': renderConceptsIndex(),
    'concepts/color.md': renderColorConcept(ds),
    'concepts/scales.md': renderScalesConcept(ds),
    'concepts/patterns.md': renderPatternsConcept(ds),
    'concepts/icons.md': renderIconsConcept(),
    'css/index.md': renderCssIndex(),
    'css/classes.md': renderCssClasses(ds),
    'bricks/index.md': renderBricksIndex(),
    'bricks/elements.md': renderElementsDoc(elementsDir),
  };
}
