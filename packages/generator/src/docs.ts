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
import { configJsonSchema, CONFIG_SCHEMA_URL } from './config.ts';
import { BASE_HOOK, DARK_SEL, REQUIRED_ROLES, SYSTEM_DARK_SEL, TW_CLASH } from './shared.ts';
import { expandPalette } from './tokens.ts';
import { TIERS, TIER_NAMES, tierPatterns } from './tiers.ts';

const DS_PATH = 'design-system.json';
/** The `resource` a config-reference doc points at. Consumers rename it freely. */
const CONFIG_PATH = 'site.json';

// Curated element display order (by $name, sans the vitops- prefix). Unlisted
// elements fall to the end alphabetically so new ones still appear.
const ORDER = [
  'split',
  'centered',
  'carousel',
  'wc-color-scheme-toggle',
  'wc-copy',
  'dismissable',
  'entries',
  'image-compare',
  'sitenav',
  'wc-multi-field',
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
  - **Web-component elements** render a Lit custom element (\`<wc-*>\`, \`<wc-copy>\`, …)
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

export interface JsonSchemaNode {
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
  maxDepth = 3,
): void {
  const indent = '  '.repeat(depth);
  const meta = `(${typeLabel(node)}${required ? ', required' : ''})`;
  out.push(`${indent}- \`${label}\` ${meta}${node.description ? ` — ${node.description}` : ''}`);
  if (depth >= maxDepth) return;
  if (node.anyOf && !node.anyOf.every(isPrimitive)) {
    for (const variant of node.anyOf) {
      out.push(`${indent}  - *one of*${variant.description ? ` — ${variant.description}` : ''}`);
      for (const c of childEntries(variant))
        renderSchemaNode(c.label, c.node, c.required, depth + 2, out, maxDepth);
    }
    return;
  }
  for (const c of childEntries(node))
    renderSchemaNode(c.label, c.node, c.required, depth + 1, out, maxDepth);
}

/**
 * One `## <key>` section per top-level property: its description, then its
 * fields as a bullet tree. Shared by both references so the two cannot drift in
 * presentation — only in which schema they are pointed at.
 */
function schemaSections(schema: JsonSchemaNode, heading = '##', maxDepth = 3): string[] {
  const required = schema.required ?? [];
  const sections: string[] = [];
  for (const [key, node] of Object.entries(schema.properties ?? {})) {
    if (key === '$schema') continue;
    const parts: string[] = [
      `${heading} \`${key}\`${required.includes(key) ? '' : ' *(optional)*'}`,
    ];
    if (node.description) parts.push('', node.description);
    const bullets: string[] = [];
    for (const c of childEntries(node))
      renderSchemaNode(c.label, c.node, c.required, 0, bullets, maxDepth);
    if (bullets.length) parts.push('', ...bullets);
    sections.push(parts.join('\n'));
  }
  return sections;
}

/* ── Schema → tree DATA (the second consumer of the same walk) ─────────────── */

const escapeHtml = (s: string): string =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );

/** Sentinel for a lifted code span. Cannot occur in authored schema prose. */
const CODE_SLOT = ' ';

/**
 * The inline markdown the schema's `desc()` text actually uses, as HTML. Closed
 * on purpose, exactly like the legal renderer's subset: these strings are
 * authored in `schema.ts`, so the set is knowable rather than guessed at.
 *
 * Escaping happens before any markup is emitted, so a description containing `<`
 * cannot inject tags — several do (`<canonical>/<key>.txt`). Exported because the
 * only safe place for this is one tested function; a caller doing its own escaping
 * is how one of them eventually doesn't.
 *
 * **Code spans are lifted out FIRST, and that is load-bearing rather than tidy.**
 * `colors.utilities` describes the target families as `` `bg-*` ``, `` `text-*` ``,
 * `` `border-*` `` — literal asterisk WILDCARDS. Run emphasis over the raw string
 * and the `*` closing `bg-*` pairs with the one closing `text-*`, wrapping the
 * text between two unrelated utilities in `<em>` and eating both asterisks. The
 * prose then silently describes families that don't exist. Lifting code spans
 * first makes emphasis structurally unable to see inside them.
 */
export const renderInlineMarkdown = (s: string): string => {
  const spans: string[] = [];
  const lifted = s.replace(/`([^`]+)`/g, (_, body: string) => {
    spans.push(body);
    return `${CODE_SLOT}${spans.length - 1}${CODE_SLOT}`;
  });
  return (
    escapeHtml(lifted)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Single-asterisk emphasis, after strong so `**x**` is already consumed. The
      // schema uses it (`*presentation*`, `*domain properties*`), so omitting it
      // printed the asterisks literally on the page.
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(
        new RegExp(`${CODE_SLOT}(\\d+)${CODE_SLOT}`, 'g'),
        (_, i: string) => `<code>${escapeHtml(spans[Number(i)] ?? '')}</code>`,
      )
  );
};

export interface SchemaTreeOptions {
  /** Dotted id prefix, so two trees on one page can't collide. */
  idPrefix?: string;
  /** Nesting cap. Unlike the markdown walk there is no reason to truncate. */
  maxDepth?: number;
  /**
   * Dotted paths to render but not descend into.
   *
   * Exists for one real case: the project config declares `designSystem.themes`
   * as a looser shape than `DesignSystemSchema`, because the full one is applied
   * separately by `resolveTheme`. Its embedded copy is therefore an
   * APPROXIMATION — measurably so, missing the descriptions for `colors`,
   * `colors.palette`, `colors.roles` and `colors.utilities`. Rendering it as the
   * token reference would quietly document the colour system less well than the
   * design-system schema does, so a caller prunes it here and renders
   * `jsonSchema` alongside instead.
   */
  prune?: readonly string[];
}

export interface SchemaTreeNode {
  /** Field name, or `<name>` / `[items]` for a map value or array item. */
  label: string;
  /** Human type label — `object`, `map`, `string | number`, `one of`. */
  type: string;
  required: boolean;
  /** Raw schema description (the closed inline-markdown subset), if any. */
  description?: string;
  /**
   * Dotted config path (`site.analytics.clarityId`). Absent when the node is not
   * addressable: a pseudo-label, or a path already claimed by an earlier node.
   */
  id?: string;
  /** True for an `anyOf` branch, which has no name of its own. */
  variant?: boolean;
  children: SchemaTreeNode[];
}

/**
 * Walk a JSON Schema into tree DATA.
 *
 * The same walk that produces the `authoring.md` / `config.md` bullet lists,
 * returned as a node model instead of a string. Returning data rather than markup
 * is deliberate and follows `roleColorUtilities()`: the *shape* of the tree is one
 * decision, and each medium renders it — markdown for agents, an accessible
 * `<details>` tree for the docs site. An HTML-emitting version here would be a
 * second source of the markup contract for `<wc-tree>` to drift from.
 *
 * Ids are dotted paths so a field can be linked to directly. Map-value and
 * array-item pseudo-labels are skipped in the path: `site.dns.records` reads
 * better than `site.dns.<domain>.records`, and neither `<domain>` nor `[items]`
 * is a real key.
 */
export function schemaTreeNodes(
  schema: JsonSchemaNode,
  opts: SchemaTreeOptions = {},
): SchemaTreeNode[] {
  const { idPrefix = '', maxDepth = 12, prune = [] } = opts;
  const pruned = new Set(prune);

  const isPseudo = (label: string) => label === '<name>' || label === '[items]';
  const join = (a: string, b: string) => (a ? `${a}.${b}` : b);

  /**
   * Paths already claimed. An `anyOf` branch has no key of its own, so sibling
   * branches sharing a field name resolve to the same dotted path
   * (`site.templates.type` exists in all three template variants). Rather than
   * invent a branch index that no real config document contains, the first
   * occurrence keeps the id — which is what `getElementById` would have picked
   * anyway, now true instead of accidental.
   */
  const seen = new Set<string>();

  const build = (
    label: string,
    n: JsonSchemaNode,
    required: boolean,
    path: string,
    depth: number,
  ): SchemaTreeNode => {
    const addressable = path !== '' && !isPseudo(label) && !seen.has(path);
    if (addressable) seen.add(path);

    // `anyOf` branches are children too: a union with object branches has to be
    // explorable, or `notifications.email` (address | object) renders as a leaf
    // with its six object fields simply absent from the page.
    const variants = n.anyOf && !n.anyOf.every(isPrimitive) ? n.anyOf : [];
    const children: SchemaTreeNode[] = [];

    if (depth < maxDepth && !pruned.has(path)) {
      for (const v of variants) {
        children.push({
          label: 'one of',
          type: typeLabel(v),
          required: false,
          variant: true,
          ...(v.description ? { description: v.description } : {}),
          children: childEntries(v).map((c) =>
            build(
              c.label,
              c.node,
              c.required,
              isPseudo(c.label) ? path : join(path, c.label),
              depth + 2,
            ),
          ),
        });
      }
      if (!variants.length)
        for (const c of childEntries(n))
          children.push(
            build(
              c.label,
              c.node,
              c.required,
              isPseudo(c.label) ? path : join(path, c.label),
              depth + 1,
            ),
          );
    }

    return {
      label,
      type: typeLabel(n),
      required,
      ...(n.description ? { description: n.description } : {}),
      ...(addressable ? { id: path } : {}),
      children,
    };
  };

  const required = schema.required ?? [];
  return Object.entries(schema.properties ?? {})
    .filter(([key]) => key !== '$schema')
    .map(([key, child]) => build(key, child, required.includes(key), join(idPrefix, key), 0));
}

function renderAuthoring(): string {
  const sections = schemaSections(jsonSchema as unknown as JsonSchemaNode);
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

// ── Config authoring reference (walked from the site JSON Schema) ────────────
// The same walker, pointed at the other published schema. Everything a consumer
// can say about their *company* and their *site* — as opposed to their tokens —
// is described here, and it is generated rather than written so it cannot claim
// a field validation does not accept.

function renderConfig(): string {
  const schema = configJsonSchema as unknown as JsonSchemaNode;
  const props = schema.properties ?? {};
  const required = schema.required ?? [];

  // The top level is three sections, so rendering it the way `authoring.md`
  // renders `design-system.json` would put ~23 unrelated fields under one
  // heading. Each section gets a `##`; each of ITS fields gets a `###`.
  const sections = Object.entries(props).map(([key, node]) => {
    const head = [
      `## \`${key}\`${required.includes(key) ? '' : ' *(optional)*'}`,
      ...(node.description ? ['', node.description] : []),
    ].join('\n');
    // `designSystem` is documented in full by authoring.md; here it needs only
    // its own wrapper fields, not a second copy of the whole token schema. The
    // depth cap is what enforces that: `themes` is a map whose value node IS the
    // design-system schema, so the default walk descended into every token field
    // and re-emitted the ~57 field lines authoring.md already owns — directly
    // under a sentence promising it hadn't. Stop at the `<name>` bullet and let
    // the link carry the reader.
    const fields = schemaSections(node, '###', key === 'designSystem' ? 0 : 3).join('\n\n');
    if (key === 'designSystem')
      return [
        head,
        'The token set. Its `themes.<name>` entries are full design systems — every field of\none is in [authoring.md](authoring.md). Only the wrapper is listed here.',
        fields,
      ].join('\n\n');
    return [head, fields].join('\n\n');
  });

  return `${frontmatter({
    type: 'Config Reference',
    title: 'Vitops — config authoring reference',
    description:
      'Every field of the three-section config (designSystem / organization / site), generated from the published JSON Schema so it always matches validation.',
    resource: CONFIG_PATH,
    tags: ['config', 'schema', 'authoring', 'site', 'organization'],
  })}

# Config authoring reference

The document that describes a **whole project**: the token set, the company, and the
published site. It is the input every command that needs more than tokens is anchored
to — \`vitops legal\`, \`vitops icons\`, \`vitops search\` — and it can also stand in for
a \`design-system.json\` anywhere the toolchain takes one, since it carries a full
\`designSystem\`.

Consumers name the file whatever suits them (\`site.json\`, \`company.json\`,
\`vitops.config.json\`); it is recognised by **shape**, not by name — a document with a
top-level \`designSystem\` key is this, and one without it is a bare
\`design-system.json\`.

- Set \`"$schema": "${CONFIG_SCHEMA_URL}"\` in the config for editor autocomplete + validation.
- Check one with \`vitops validate\`.

## The three sections

| Section | Holds | Changes when |
| --- | --- | --- |
| \`designSystem\` | the token set — named themes, which theme, which appearance | the brand's design changes |
| \`organization\` | the company — name, contact, locations, services, profiles | the company changes |
| \`site\` | this published site — locales, domains, environments, SEO, analytics, legal, icons, deployment | this site changes |

The split is what makes the multi-site case expressible: several sites can carry the
same \`organization\` and differ only in \`site\`. It is also what the generated legal
documents rely on — a privacy policy asserts facts about the *company* (who to contact,
where it is) and facts about the *site* (which forms exist, which analytics run), and
those two are separately true.

**Fields are described where they are, not where they were.** If you are migrating a
pre-3.0 flat config, \`vitops validate\` names every move rather than reporting a dozen
unknown keys.

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
WordPress target), \`data-theme\` is what the shipped \`<wc-color-scheme-toggle>\` writes on
\`<html>\`, so the toggle works on every other target. Set either.

The OS preference is a **second, opt-in block**. Set
\`designSystem.defaultColorScheme: "system"\` in your site config and the same delta is emitted again inside
\`@media (prefers-color-scheme: dark)\`, under
\`${SYSTEM_DARK_SEL}\` — i.e. whenever no explicit choice has been made. That is what makes
\`<wc-color-scheme-toggle>\`'s "System" position resolve to the OS (it *removes* the attribute,
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

/**
 * All four tiers in ONE doc — the agent-facing projection of `TIERS`.
 *
 * The docsite projects each tier as its own page, because a human arrives already
 * knowing which stack they are in ("show me the Astro components"). An agent
 * arrives the other way round: it knows the *pattern* it needs and has to be told
 * which tiers offer it and which call to make. Four docs would mean an agent
 * fetching `components/astro` learns `<Tree />` exists and never learns it must not
 * wrap it in `<wc-tree>` — the composition only exists between the tiers, so the
 * projection that serves agents is the one that keeps them together.
 *
 * `ds` is read for one thing: whether each config-authored pattern is actually
 * declared in THIS consumer's `patterns.items`. `TIERS.css.generated` records that a
 * pattern is *of that kind* against this repo's reference config; it cannot know
 * that a given consumer dropped `card`. Reporting a class that this config emits no
 * CSS for is the failure worth preventing here.
 */
function renderComponentsConcept(ds: DesignSystem): string {
  const declared = new Set(Object.keys(ds.patterns?.items ?? {}));
  // Table cells: a literal pipe would split the column, and `use` strings are prose.
  const cell = (s: string) => s.replace(/\|/g, '\\|');
  const code = (s: string) => `\`${s}\``;
  const list = (xs: string[]) => xs.map(code).join(', ');

  const tiersOf = (name: string): string[] =>
    (['css', 'wc', 'astro', 'bricks'] as const).filter((t) =>
      tierPatterns(t).some((p) => p.name === name),
    );

  const overview = TIER_NAMES.map((name) => {
    const e = TIERS[name]!;
    return `| ${code(name)} | ${tiersOf(name).join(' · ')} | ${cell(e.use)} |`;
  }).join('\n');

  const wc = tierPatterns('wc')
    .map(({ name, entry }) => {
      const w = entry.wc!;
      const ships = w.registered ? code('elements.js') : w.bundle ? code(w.bundle) : 'nothing';
      return `| ${code(`<${w.tag}>`)} | ${code(name)} | ${ships} | ${cell(w.adds)} |`;
    })
    .join('\n');

  const astro = tierPatterns('astro')
    .flatMap(({ name, entry }) =>
      entry.astro!.map(
        (a) =>
          `| ${code(a.component)} | ${code(name)} | ${
            a.wraps === 'wc'
              ? `the ${code(`<${entry.wc!.tag}>`)} tag, fallback inside`
              : 'tier-1 markup — no web component'
          } |`,
      ),
    )
    .join('\n');

  const bricks = tierPatterns('bricks')
    .map(({ name, entry }) => `| ${code(entry.bricks!)} | ${code(name)} |`)
    .join('\n');

  const css = tierPatterns('css')
    .map(({ name, entry }) => {
      const c = entry.css;
      const config = !c.generated
        ? '—'
        : declared.has(name)
          ? 'declared'
          : '**absent from this config — no CSS emitted**';
      return `| ${code(name)} | ${c.partial ? code(c.partial) : '—'} | ${
        c.classes.length ? list(c.classes) : '—'
      } | ${config} |`;
    })
    .join('\n');

  // `BASE_HOOK` maps a CSS property to a var suffix, so it has no single spelling to
  // quote — derive the distinct hooks rather than interpolating the object.
  const hooks = [...new Set(Object.values(BASE_HOOK))]
    .map((sfx) => code(`--${sfx}-<pattern>`))
    .join(', ');

  const unshipped = tierPatterns('wc')
    .filter(({ entry }) => !entry.wc!.registered && entry.wc!.bundle?.startsWith('(none'))
    .map(({ entry }) => code(`<${entry.wc!.tag}>`))
    .join(', ');

  return `${frontmatter({
    type: 'Design Concept',
    title: 'Vitops components — which tier provides a pattern, and what to write',
    description:
      'Every UI pattern across the four tiers (CSS classes, wc-* web components, Astro components, Bricks elements): which tiers provide it, which call to make, and how the tiers compose.',
    resource: DS_PATH,
    tags: ['components', 'web-components', 'astro', 'bricks', 'tiers', 'design-system'],
  })}

# Components

A pattern is provided by up to four tiers, and they **compose** rather than compete:

1. **CSS framework classes** — every pattern expressible in pure HTML/CSS. Reach here first.
2. **Web components** (${code('<wc-*>')}, Lit) — only where a pattern genuinely benefits from
   progressive enhancement. The slotted markup is the fallback and must be usable with no JS;
   the element parses and augments it in place.
3. **Astro components** — authoring conveniences that emit the correct markup. They must not
   require runtime JS. Where a pattern has a web component, the Astro component emits that tag
   **with the accessible fallback inside it**.
4. **Bricks elements** — the same patterns as WordPress/Bricks Builder elements.

## Choosing

**Use the highest-numbered tier available for your stack, and write only its call.** In Astro
that is the Astro component; in Bricks the element; anywhere else the classes, plus the
${code('<wc-*>')} tag when one exists.

The trap is composing two tiers by hand. When ${code('wraps')} below says the Astro component
emits the tag, that one call is the whole composition —
${code('<wc-tree><Tree /></wc-tree>')} nests two elements on one tree. A tier-3 component that
would need runtime JS is in the wrong tier: build a web component instead and have the wrapper
emit its tag.

## Every pattern

| Pattern | Tiers | What to write |
| --- | --- | --- |
${overview}

## Web components

Shipped as feature-detected, deferred ES-module bundles. ${code('elements.js')} carries the
registered set; ${code('<wc-consent>')} and ${code('<wc-theme-editor>')} ship separately, the
first so a site needing consent does not download a rendering framework, the second because it
is tooling and opt-in per consumer.

| Tag | Pattern | Ships in | What JS adds over the fallback |
| --- | --- | --- | --- |
${wc}

${
  unshipped
    ? `${unshipped} are **registered but in no bundle** (the editor-v2 track). The tags are inert in a consumer project — they are listed so that "the tag does nothing" is documented rather than discovered.`
    : ''
}

## Astro components

| Component | Pattern | Emits |
| --- | --- | --- |
${astro}

## Bricks elements

Controls, defaults and seeded children for each are in [the elements reference](../bricks/elements.md).

| Element | Pattern |
| --- | --- |
${bricks}

## CSS

${code('patterns.items')} patterns get the full token cascade — ${code('base')} declarations,
${code('states')}, role variants and override hooks (${hooks}); see
[component patterns](patterns.md). A structural partial has none of those. The class lists below
are representative, not exhaustive — [the class vocabulary](../css/classes.md) states the naming
rules that generate them all.

| Pattern | Partial | Classes | ${code('patterns.items')} |
| --- | --- | --- | --- |
${css}
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
* [Config reference](config.md) - every field of the three-section config (designSystem / organization / site), generated from the JSON Schema
* [Output formats](formats.md) - tailwind vs css vs bricks vs design: what's emitted, what the platform provides, which utilities Tailwind owns
* [Concepts](concepts/) - the colour system, type/space scales, pattern CSS architecture, the four component tiers, icons, and the consent / tracking / search / legal subsystems
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

The \`icons\` option on \`vitops()\` derives it by scanning your source, merged with
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

function renderConsentConcept(): string {
  return `${frontmatter({
    type: 'Design Concept',
    title: 'Vitops consent — a demand-driven permission gate',
    description:
      'How the consent gate works: inert `type="text/plain"` tags, demand-driven prompting, three-valued choices, and the invariants that make the gate real rather than a promise.',
    resource: CONFIG_PATH,
    tags: ['consent', 'cookies', 'privacy', 'gdpr', 'analytics'],
  })}

# The consent gate

\`@getvitops/core/consent\` is a **general permission gate, not an analytics feature**. Anything
marked \`data-consent="<category>"\` waits on one visitor choice — a third-party tag, an A/B
assignment, a personalisation cookie, an embedded map. It carries no Lit and is a separate
bundle from \`elements.js\`, because consent is a legal requirement: a site that needs it must
not be made to download a rendering framework first.

Categories are \`necessary\`, \`analytics\`, \`marketing\`, \`preferences\`.

## Gating something

A gated script renders **inert**, with its URL parked on \`data-src\`:

\`\`\`html
<script
  type="text/plain"
  data-vitops-tag
  data-consent="analytics"
  data-consent-cookies="_ga,_ga_*"
  data-src="https://example.com/analytics.js"
></script>
\`\`\`

⚠️ **\`type="text/plain"\` is what makes the gate real. Never give a gated tag a live \`src\`.**
The browser neither parses the body nor fetches the library, so an undecided visitor's page
issues **no third-party request at all**. A gate that instead loads a script and politely asks
it not to track is a promise, not a gate.

\`data-consent-cookies\` is written by whoever emitted the tag, because that is who knows what
the provider sets. It is what a revoke clears.

## Demand-driven: two different ideas

**Offered** categories are a build-time fact — which rows \`<CookieConsent />\` renders. The
default is deliberately generous; a hidden row costs nothing.

**Demanded** categories are a runtime fact — what something has actually asked for and the
visitor hasn't answered. The banner appears only when a demand is outstanding, so **a site
whose only provider is cookieless never interrupts anyone.**

Demand is registered by:

- a gated element **reaching its loading strategy** — so an \`idle\` tag asks after \`load\`, off
  the LCP path, and an \`interaction\` tag asks only once the visitor acts; or
- an explicit \`require()\` / \`request()\`.

## The runtime API

\`window.vitopsConsent\`, plus a \`vitops:consent\` \`CustomEvent\` on \`document\`.

| Call | Does |
| --- | --- |
| \`granted(cat)\` | Is it granted? **Passive — does not prompt.** |
| \`require(cat)\` | Declare a need *now* and report whether it's granted. **This is what raises the banner.** Synchronous. |
| \`request(cat)\` | \`require()\`, but resolves once the visitor answers *this* category. |
| \`needed()\` | Is a prompt warranted? True only if something demanded an unanswered category. |
| \`demanded()\` | What has asked, this page view. |
| \`set(patch)\` | Record a decision for exactly these categories. |
| \`open()\` | Re-show the banner without discarding the current choice. |
| \`reset()\` | Forget the choice and re-prompt. |

⚠️ If you want a side effect to be *possible*, you must \`require()\` it. Calling \`granted()\`
and doing nothing else is a **permanent no-op** on any site where nothing else demands that
category: it is never offered, never granted, and your write never happens — silently.

## An absent gate means "store freely"

\`consent.js\` and \`elements.js\` are both deferred with no ordering between them, so a component
can upgrade and be clicked before the gate exists. \`<Head />\` therefore emits a synchronous
inline **stub** that answers \`false\` and queues; the runtime replays the queue on load.

That makes the absence of \`window.vitopsConsent\` meaningful: it reliably means **this site has
no gate**. Read it as *store freely* — never as *denied*.

Because the stub is not the full API, listen for the \`vitops:consent\` event rather than calling
\`subscribe()\`, which the stub does not have.

## Three-valued, and why it matters

The cookie (\`vitops_consent\`, v2) records each category as \`true\` / \`false\` / **\`null\`**.
"Not asked" is a third value, not a synonym for "declined" — and only \`null\` can be
re-prompted. That is what lets a \`preferences\` demand arrive *after* an \`analytics\` prompt was
already answered.

Three consequences:

- **Nothing is stored until the visitor chooses.** Absence of the cookie is *undecided*, and
  undecided denies everything but \`necessary\`. If merely showing the banner wrote state, the
  banner would be the thing it asks permission for.
- **A corrupt or wrong-version cookie re-prompts.** It does not read as "decided, all denied" —
  that safe-looking read strands a visitor who wants to opt in with no way to say so.
- **A patch must cover exactly the categories a showing put on screen.** \`<wc-consent>\` builds
  its own patch rather than calling \`acceptAll()\`, because "Accept" on a preferences-only
  prompt that also granted analytics would be consent nobody gave. \`acceptAll()\` /
  \`rejectAll()\` mean *literally every* optional category — widening a patch to "all" is the
  easy version of this bug.

## Revoking reloads

An already-executing tracker cannot be unloaded. Clearing its cookies only stops it identifying
the visitor *next* time, while the running instance keeps reporting until the document goes
away — so a revoke clears the named cookies and **reloads**. (\`reloadOnRevoke = false\` defers
that to the next navigation.)

## The notice must match what loads

The same config facts drive the **generated cookie notice** — see
[legal.md](legal.md). \`site.analytics.clarityId\` is what makes the notice name Clarity; the
same provider in \`vitops({ analytics })\` is what makes the tag load. The Astro integration
**warns when the two disagree**, because a site running a tag its own notice omits is a
compliance defect, not a documentation gap.

## Reference consumer

\`<wc-color-scheme-toggle>\` applies the chosen scheme **immediately** and gates only the
\`localStorage\` write. Nothing about honouring a visitor's click needs permission; remembering
it does.
`;
}

function renderTrackingConcept(): string {
  return `${frontmatter({
    type: 'Design Concept',
    title: 'Vitops conversion tracking — ad attribution and notifications',
    description:
      'How an ad click becomes a notified conversion: the `_ac` cookie, consent-demanding capture, the pure notification planner, and the Cloudflare email channel.',
    resource: CONFIG_PATH,
    tags: ['tracking', 'attribution', 'conversions', 'notifications', 'consent'],
  })}

# Conversion tracking

A visitor arrives on an ad carrying a click ID; \`<Tracking />\` captures it into the
first-party **\`_ac\`** cookie; when they later submit a form or tap a \`tel:\` link,
\`createConversionRoute()\` reads the cookie back and notifies whoever the config names.

\`\`\`json
{
  "site": {
    "tracking": { "enabled": true, "category": "marketing" },
    "notifications": { "email": "leads@example.com" }
  }
}
\`\`\`

A bare address is shorthand for \`{ provider: "cloudflare", to }\`. The recipient otherwise
falls back to the primary location's email, and the sender to \`noreply@<domains.canonical>\`.

## Where each piece lives

| Layer | Module | Why there |
| --- | --- | --- |
| Attribution vocabulary + cookie | \`@getvitops/utils/tracking\` | Needed on **both** sides of the wire |
| Plan / render / send | \`@getvitops/utils/notify\` | Pure planner, I/O sender |
| Capture script, \`<Tracking />\`, route factory | \`@getvitops/astro\` | Beside the analytics components |

Both utils entries are **separate subpaths** because they are the only modules that run in a
**Worker** rather than at build time. Keeping them off the package index is what stops a
conversion endpoint pulling \`sharp\` into its bundle. Neither may use a Node builtin.

## The capture demands consent

\`_ac\` is a 90-day identifier tying a visitor to an ad, so it waits on \`marketing\` (override
with \`site.tracking.category\`).

⚠️ The script calls **\`require()\`**, not \`granted()\` — \`require()\` is what *raises the
banner*. A passive \`granted()\` here is a permanent no-op: nothing else on a page demands
\`marketing\`, so it is never offered, never granted, and \`_ac\` is never written — silently, on
every gated site. The integration adds \`marketing\` to the offered categories when tracking is
on, so there is a row for the category the script will ask about.

**Only an arrival that carried something asks.** The demand is guarded on the URL actually
holding a click ID or UTM, so an organic visitor — who has nothing to attribute — is never
interrupted. That is demand-driven consent applied to attribution.

**The capture is synchronous; only the write waits.** Reading the query string is not storage
and needs no permission; *keeping* it does. The click ID is in the URL only on the landing
page, so deferring the read would lose it outright.

The marker element carries \`data-consent\` but deliberately **not** \`data-vitops-tag\`: the
scan never tries to "activate" it (it is ungated by design), while the revoke path — which
queries \`[data-consent="…"]\` — still finds it and clears \`_ac\`.

## The event is the abstraction

\`ConversionEvent\` is the *fact*; how it reads belongs to the channel. That is what lets an SMS
channel render 160 characters from the same event an email renders in full.

**The plan is pure and says why anything is skipped.** \`planNotifications\` touches no network
and no binding, so a misconfigured site can be told exactly why no notification will arrive — a
silently unsent conversion notification is indistinguishable from no conversion.

## The email channel

Cloudflare Email Sending's **current** binding — structured
\`env.EMAIL.send({ to, from, subject, html, text })\`, not the legacy \`EmailMessage\` plus
hand-built MIME. The binding is **passed in, never imported**, so utils takes no Cloudflare
dependency.

Only transient codes are retried. \`E_SENDER_NOT_VERIFIED\` and friends are surfaced
**verbatim**, because nothing here can check whether the sending domain was onboarded — run:

\`\`\`sh
wrangler email sending enable <domain>
\`\`\`

A generic "send failed" would hide the one thing worth knowing.

Only \`email\` is implemented. \`sms\` and \`persist\` are a planned seam
(\`NotificationsConfig\` plus a sender with \`sendEmail\`'s signature); one channel is not enough
to know what the abstraction should be.

## Disclosure

\`_ac\` is disclosed by the generated cookie notice as a first-party cookie. It has to be stated
explicitly: no provider table would ever name a first-party cookie, so a site running
attribution alongside a **cookieless** analytics provider would otherwise be described as
setting no cookies at all. See [legal.md](legal.md).
`;
}

function renderSearchConcept(): string {
  return `${frontmatter({
    type: 'Design Concept',
    title: 'Vitops search — Search Console onboarding and deploy notification',
    description:
      'What search engines actually accept, why the Indexing API is deliberately not wired, and how `vitops search setup` and `vitops search notify` work.',
    resource: CONFIG_PATH,
    tags: ['seo', 'search-console', 'indexnow', 'sitemap', 'indexing'],
  })}

# Search

Two commands, both anchored to a full config:

- **\`vitops search notify\`** — tell search engines a deploy happened (from \`site.seo.indexing\`).
- **\`vitops search setup\`** — onboard domains into Search Console (from \`site.searchConsole\`).

## Start from what engines actually accept

The obvious assumption is wrong, and every design decision here follows from that:

- **Google exposes no "request indexing" API.** The button in the Search Console UI is not in
  the Search Console API or anywhere else, and the **URL Inspection API is read-only**.
- **The sitemap ping endpoint was removed in June 2023.** \`google.com/ping?sitemap=\` is a no-op.
- **The Indexing API is scoped to \`JobPosting\` / \`BroadcastEvent\`.** It accepts other URLs and
  discards them; general use violates its terms, with *your own* GCP project on the line.
  ⚠️ **Deliberately not wired. Do not add it.**
- **Google does not participate in IndexNow.** Bing, Yandex, Naver, Seznam and Yep do.

So \`search notify\` does every sanctioned thing and then **verifies**: resubmit the sitemap,
ping IndexNow, and \`--check\` inspects \`priorityUrls\` and exits non-zero on one Google hasn't
indexed. That last part is what actually replaces the manual Search Console visit.

⚠️ Never describe this as making Google re-index faster. It cannot.

## \`search notify\`

- **The pure/I-O split is the point.** The planner decides everything — which URLs, which
  channels, why each was skipped — and touches no network, no filesystem, no clock. That is what
  makes \`--dry\` a *complete* account of a run rather than an approximation.
- **\`lastmod\` is not a nice-to-have, it is the mechanism.** The changed-URL diff compares each
  sitemap entry's \`<lastmod>\` against a stored snapshot. With no lastmod the diff can see pages
  appear and disappear but **never see one change** — so an edited page is never resubmitted, and
  the command looks healthy while doing less than it appears to. It counts lastmod-less entries
  and says so every run.

  \`gitLastmod()\` in \`@getvitops/astro\` derives real dates from \`git log\`. It is an exported
  helper rather than a \`sitemap\` option because it shells out to git and returns **nothing**
  from a shallow CI clone (\`fetch-depth: 1\`). It leaves an unmatched URL alone rather than
  stamping the build time: Google weighs lastmod only while it stays consistent with what
  actually changed, so a site that stamps every page every deploy teaches it to distrust the
  field site-wide.
- **The \`noindex\` gate reads the environment, so the URLs must too.** The run is refused
  entirely when the resolved environment's \`robots\` contains \`noindex\` — submitting a staging
  host to IndexNow publishes it to several engines and invites them to crawl it, which a later
  directive does not undo. Origins therefore derive from \`site.environments[env].url\` **before**
  \`domains.canonical\`: the canonical is the *production* origin, so deriving from it while
  notifying staging would submit production URLs the gate would not catch.
- **Verify the IndexNow key file before submitting.** A submission whose key file is unreachable
  returns \`403\`, but one whose key file is *reachable and stale* is accepted with \`202\` and then
  silently discarded. Only a prior GET distinguishes "submitted" from "submitted and ignored".
  The key is **not a secret** — the engine fetching it back is the ownership proof — so it lives
  in the config, and the Astro integration writes \`public/<key>.txt\` from it.
- **Write the snapshot last, and only on success.** Writing it eagerly records URLs as notified
  that never were; because the next run diffs against it, one transient \`503\` would drop those
  pages from every future run — silently and permanently. A corrupt or absent snapshot reads as
  "submit everything, and say so", never as "nothing changed".

## \`search setup\`

Automates the otherwise-manual DNS-paste / wait / verify / add-property dance.
\`site.searchConsole\` is keyed by bare hostname (mirroring \`site.dns\`):

\`\`\`json
{
  "site": {
    "searchConsole": {
      "example.com": {
        "delegatedOwners": ["dev@example.com"],
        "fullUserGroup": "seo@example.com"
      }
    }
  }
}
\`\`\`

Per domain it ensures the apex verification TXT in Cloudflare, verifies ownership via the Site
Verification API (\`DNS_TXT\`), adds the \`sc-domain:\` property, then adds any
\`delegatedOwners\`. The verification token is fetched live and written to DNS — never stored in
the config.

- **Idempotency lives in the planner.** A step whose desired state already holds resolves to
  \`skip\`, so re-running an onboarded domain is a no-op **by construction**, not because the
  executors check twice. \`--check\` reports drift, exits non-zero and mutates nothing;
  \`--dry\` prints the plan and stops.
- **DNS is only ever created, never edited or deleted.** The command never removes a record, so
  the Cloudflare executor simply has no update or delete verb.
- **Verification retries with backoff, then reports PENDING — not failed.** \`DNS_TXT\`
  verification fails until the record propagates, which is slow, not broken. A domain still
  unverified after the last attempt is \`PENDING\`, and its property and owner steps are skipped
  for that run. Re-run later.
- **Search Console has no user/permission API.** Adding a Google Group as a **Full User** is
  genuinely un-automatable, so \`fullUserGroup\` is surfaced as a **reminder** in the summary,
  never attempted. That is distinct from \`delegatedOwners\`, which *are* automated — those are
  Site Verification web-resource owners (an additive union, so an existing owner is never
  dropped), a different concept from Search Console property users. Don't conflate them.

## Credentials

Always from the environment; never in the config. There is **one** token exchange and **two
grants**, tracking where each command runs:

| Grant | Env vars | Used by |
| --- | --- | --- |
| **Service account** (JWT bearer) | \`VITOPS_GSC_SERVICE_ACCOUNT\` (inline JSON) or \`GOOGLE_APPLICATION_CREDENTIALS\` (path) | \`search notify\` — never expires, right for CI |
| **User OAuth** (refresh token) | \`VITOPS_GOOGLE_CLIENT_ID\` / \`_CLIENT_SECRET\` / \`_REFRESH_TOKEN\` | \`search setup\` — **required** |

Cloudflare uses \`CLOUDFLARE_API_TOKEN\` (a \`Zone:DNS:Edit\` token; the standard "Edit zone DNS"
template also carries the \`Zone:Read\` the zone-by-name lookup needs).

\`search setup\` requires user OAuth because **verifying a site makes the caller an owner** of
the property, and that should be a person, not a project robot. Note a refresh token can be
revoked, and for an OAuth client still in *Testing* publishing status Google expires it after
**7 days** — fine for a one-time human setup, bad for a deploy step.

**\`search notify\` accepts either**, preferring the service account when both are set. Search
Console does not care which identity calls it, and someone who has run \`search setup\` already
holds a Google credential.

⚠️ Do not add \`googleapis\` — an enormous dependency for a handful of REST endpoints in a CLI
that installs into every consumer project. The JWT is minted with ~30 lines of \`node:crypto\`.
`;
}

function renderLegalConcept(): string {
  return `${frontmatter({
    type: 'Design Concept',
    title: 'Vitops legal documents — generated policy, terms and cookie notice',
    description:
      'How the privacy policy, terms of service and cookie notice are derived from config facts, why the provider table exists, and the four delivery paths.',
    resource: CONFIG_PATH,
    tags: ['legal', 'privacy', 'cookies', 'pipeda', 'compliance'],
  })}

# Legal documents

A privacy policy, terms of service and cookie notice, rendered from a full config: the company
from \`organization\`, what the site actually *does* from \`site\`.

It is a **sibling of the docs generator, not a \`generate()\` format** — structurally, not
stylistically. \`generate()\` is keyed to a design system, so a "legal format" would be a format
that ignores its own input.

## The governing rule

**The config records facts; the template owns prose.**

Nothing in the derivation writes a sentence a lawyer would review, and no template invents a
fact. That is what lets wording be corrected without touching your config, and your provider
change land without touching prose.

⚠️ It also means **the fix for a wrong policy is a corrected config.** Hand-editing the output
is overwritten by the next build.

## What derives from what

- **The provider table is what makes derivation possible.** A policy naming Plausible while the
  site runs GA is a compliance defect, not a typo — so the provider comes from *which analytics
  ID is set*, whether \`site.security.turnstile.siteKey\` exists, and what
  \`site.deployment.platform\` says. Never from a hand-maintained string.

  It covers only what the schema can imply. Everything else — payment, CRM, mail — is declared
  in \`site.legal.privacyPolicy.processors\` and flows through the same pipeline.

- **\`cookies: []\` is meaningfully different from \`undefined\`.** It *asserts* a provider is
  cookieless (Plausible), which the cookie notice states **positively** rather than omitting.

- **"Stored in" is not the same fact as "reachable by".** A processor's \`storage\` is where the
  information rests; \`operatorCountry\` is the jurisdiction that can compel the provider to hand
  it over. Privacy law turns on foreign **access**, not merely foreign storage, so the two get
  separate sentences — an Azure tenant in a Canadian region never moves the data and is still
  subject to US law. \`country\` is shorthand asserting both, and combining it with either is
  **rejected** rather than resolved by a silent rule: whether it narrows or adds is a
  contradiction between two legal claims, not a formatting choice.

  A \`storage\` entry may be \`scope\`d to a category, which is what makes a Canadian tenant
  holding identity data abroad expressible. A country in the policy's own jurisdiction is not a
  transfer and is filtered out — that is what stopped \`country: "Canada"\` rendering "outside of
  Canada, including Canada". Only what the config states is asserted: hosts like Cloudflare
  declare an \`operatorCountry\` and **no** storage, because anycast means the config cannot know
  which region served a request, and "we don't know" is a fact.

- **Form templates are the PII inventory.** \`site.templates\` entries of type \`form\` are the
  only place the config says what personal information the site actually collects, so the
  disclosed list derives from their fields. \`hidden\` fields and honeypots are **excluded** —
  neither is visitor-supplied, and describing them as collected would be untrue.

- **First-party cookies are declared, not detected.** The attribution cookie \`_ac\` is disclosed
  this way; see [tracking.md](tracking.md).

## The markdown subset is closed

We author every template, so the renderer is exactly as capable as they are: \`#\`/\`##\`/\`###\`,
\`- \` bullets, \`> \` quote, \`**strong**\`, \`\\\`code\\\`\`. **An unsupported construct is an error,
not a silent degrade** — that is what stops a literal \`| --- |\` reaching a published page.

Portable Text maps the \`> \` quote to a banner block and **drops the \`# \` heading**, which is
EmDash's own title field.

## Jurisdictions

Adding one is: author three templates, add one enum member, add one registry key. The two are
checked against each other at compile time, so skipping either **fails to compile** rather than
rendering against the wrong body of law.

⚠️ Only **\`ca\` (PIPEDA)** ships. Its prose names the Office of the Privacy Commissioner of
Canada and frames transfers as "outside of Canada" — **do not reuse it for another
jurisdiction.**

## Delivery: one renderer, four consumers

| Consumer | How |
| --- | --- |
| **any stack** | \`vitops legal [--doc <name>] [--format md\\|html\\|portable-text] [--out <dir>]\` — stdout without \`--out\`. Hugo, Eleventy or a hand-built WordPress theme need no integration code. |
| **WordPress** | \`generate({ site })\` also emits \`dist/legal/*.html\`; \`[vitops_legal doc="privacy"]\` renders one. \`doc\` is matched against a fixed allowlist, because it lands in a filesystem read. |
| **Astro** | \`vitops({ legal: { input, out } })\` — a sibling of \`css\`, not a widening of it. Regenerates on config change; writes markdown to a content collection. No route injection. |
| **EmDash** | \`--format portable-text\`, pasted into the admin. |

The CLI is the load-bearing one: it is the surface every consumer has regardless of stack.

## The review banner

Every document opens with a **non-optional** review banner. These are rendered from a template
by a build tool; the one failure mode with real consequences is a consumer publishing one as-is.
`;
}

function renderConceptsIndex(): string {
  return `${INDEX_NOTE}

# Design-system concepts

# Contents

* [Colour system](color.md) - seeded OKLCH scales on a shared lightness ladder, target-prefixed tokens, automatic dark mode
* [Type & space scales](scales.md) - fluid modular scales and the tokens they emit
* [Component patterns](patterns.md) - token cascade, override hooks, states, role variants
* [Components](components.md) - which of the four tiers provides each pattern, and the call to make
* [Icons](icons.md) - semantic names across icon sets, bundle derivation, sprite delivery
* [Consent gate](consent.md) - inert gated tags, demand-driven prompting, three-valued choices
* [Conversion tracking](tracking.md) - ad-click attribution, the \`_ac\` cookie, conversion notifications
* [Search](search.md) - what engines accept, Search Console onboarding, deploy notification
* [Legal documents](legal.md) - policy/terms/cookie notice derived from config facts
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
    'config.md': renderConfig(),
    'formats.md': renderFormats(ds),
    'concepts/index.md': renderConceptsIndex(),
    'concepts/color.md': renderColorConcept(ds),
    'concepts/scales.md': renderScalesConcept(ds),
    'concepts/patterns.md': renderPatternsConcept(ds),
    'concepts/components.md': renderComponentsConcept(ds),
    'concepts/icons.md': renderIconsConcept(),
    'concepts/consent.md': renderConsentConcept(),
    'concepts/tracking.md': renderTrackingConcept(),
    'concepts/search.md': renderSearchConcept(),
    'concepts/legal.md': renderLegalConcept(),
    'css/index.md': renderCssIndex(),
    'css/classes.md': renderCssClasses(ds),
    'bricks/index.md': renderBricksIndex(),
    'bricks/elements.md': renderElementsDoc(elementsDir),
  };
}
