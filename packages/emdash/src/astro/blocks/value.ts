/**
 * Normalize the props EmDash passes to a Portable Text block component.
 *
 * Verified against emdash 1.4: <PortableText> still delegates to astro-portabletext,
 * which passes the block object as `props.node` (fields flat on the block next
 * to _type/_key). The `value` and spread branches are kept as tolerance for the
 * shapes shown elsewhere in the EmDash docs, so a host-side change is a
 * one-line fix here rather than a change in every block component.
 */
export function resolveBlockValue<T extends Record<string, unknown>>(
  props: Record<string, unknown>,
): T {
  const candidate = props.value ?? props.node ?? props;
  return candidate as T;
}

// Shared with the Astro components and `nodesToHtml`; re-exported so blocks import one place.
import { safeHref } from '@getvitops/utils/url';
export { safeHref };

/** Split a newline/comma-separated editor field into trimmed non-empty items. */
export function splitLines(input: unknown): string[] {
  if (typeof input !== 'string') return [];
  return input
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** A repeater field's saved value: an array of row objects. Anything else is no rows. */
export function rows<T extends Record<string, unknown> = Record<string, unknown>>(
  input: unknown,
): T[] {
  return Array.isArray(input)
    ? (input.filter((row) => row && typeof row === 'object' && !Array.isArray(row)) as T[])
    : [];
}

/** A trimmed string field, or `''` when the value is absent or not a string. */
export function text(input: unknown): string {
  return typeof input === 'string' ? input.trim() : '';
}

/** Split a multiline editor field into paragraphs on blank lines. */
export function paragraphs(input: unknown): string[] {
  return text(input)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** A heading element chosen by an editor's `level` field, clamped to `h2`–`h6`. `h1` is the page's title. */
export function headingTag(
  level: unknown,
  fallback: 2 | 3 | 4 | 5 | 6 = 2,
): 'h2' | 'h3' | 'h4' | 'h5' | 'h6' {
  const n = Math.round(Number(level));
  const clamped = Number.isFinite(n) && n >= 2 && n <= 6 ? n : fallback;
  return `h${clamped}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

/**
 * The element for a block that may own the page's title: `h1`–`h6`, or `p` when the heading is
 * visual only and the outline should not carry it (the role class still styles it). Hero and
 * section use this; every other block keeps `headingTag`'s `h2`–`h6`, so a page's `h1` only
 * comes from a block an editor chose it for.
 */
export function outlineTag(
  level: unknown,
  fallback: 1 | 2 | 3 | 4 | 5 | 6 = 2,
): 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' {
  if (String(level).trim().toLowerCase() === 'p') return 'p';
  const n = Math.round(Number(level));
  const clamped = Number.isFinite(n) && n >= 1 && n <= 6 ? n : fallback;
  return `h${clamped}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

/** One run of inline text, optionally a link. */
export interface Run {
  text: string;
  href?: string;
}

/**
 * Plain text with `[label](url)` links, as runs a template renders with no `set:html`.
 *
 * Repeater sub-fields are scalar strings, so a card's body cannot hold a link node; this is
 * the smallest syntax that lets an editor write one. Every `href` goes through
 * {@link safeHref}, and an unsafe one degrades to its label as plain text. Anything else —
 * including HTML — stays literal text, which the template escapes.
 */
export function linkRuns(input: unknown): Run[] {
  const source = text(input);
  const runs: Run[] = [];
  let last = 0;
  for (const m of source.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    if (m.index > last) runs.push({ text: source.slice(last, m.index) });
    const href = safeHref(m[2]);
    runs.push(href ? { text: m[1]!, href } : { text: m[1]! });
    last = m.index + m[0].length;
  }
  if (last < source.length) runs.push({ text: source.slice(last) });
  return runs;
}

/**
 * A heading with accent marks: `Two services. *One team.*` → the starred run is `accent`.
 * Unbalanced stars stay literal.
 */
export function accentRuns(input: unknown): { text: string; accent: boolean }[] {
  const source = text(input);
  const runs: { text: string; accent: boolean }[] = [];
  let last = 0;
  for (const m of source.matchAll(/\*([^*]+)\*/g)) {
    if (m.index > last) runs.push({ text: source.slice(last, m.index), accent: false });
    runs.push({ text: m[1]!, accent: true });
    last = m.index + m[0].length;
  }
  if (last < source.length) runs.push({ text: source.slice(last), accent: false });
  return runs;
}

/** Non-empty trimmed lines of a multiline field (a checklist, a feature list). */
export function lines(input: unknown): string[] {
  return text(input)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * `Term | Value` lines → pairs. A line with no `|` is a term with an empty value, so a typo
 * loses nothing visible.
 */
export function pairs(input: unknown): { term: string; value: string }[] {
  return lines(input).map((line) => {
    const i = line.indexOf('|');
    return i < 0
      ? { term: line, value: '' }
      : { term: line.slice(0, i).trim(), value: line.slice(i + 1).trim() };
  });
}

/** One node of an outline: what `<Tree />` takes, minus the raw-HTML `descriptionHtml` field. */
export interface OutlineNode {
  label: string;
  badge?: string;
  id?: string;
  children?: OutlineNode[];
}

/** Most nodes and deepest nesting one outline field may produce. A tree this big isn't an outline. */
export const OUTLINE_MAX_NODES = 500;
export const OUTLINE_MAX_DEPTH = 6;

const slug = (label: string) =>
  label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * An indented outline → a tree. One node per line; each level is indented further than its parent
 * (spaces or tabs, any amount: only "deeper than the line above" matters, so an editor who uses
 * two spaces in one place and four in another still gets what they meant). A leading `- ` or `* `
 * is ignored, and ` | ` splits a label from a small badge:
 *
 *     - src
 *       - index.ts | entry
 *     - package.json
 *
 * Built so a CMS field can drive a recursive component without a nested field type: the editor
 * types text, and the only thing that ever reaches the tree is `label`, `badge` and a derived `id`
 * as plain strings. In particular it never produces `descriptionHtml`, which `<Tree />` renders as
 * raw HTML. Capped at `OUTLINE_MAX_NODES` and `OUTLINE_MAX_DEPTH`: lines past either are dropped
 * rather than failing the page, and a line nested deeper than the cap attaches at the cap.
 *
 * `idPrefix` makes node ids unique across a page (`<prefix>-<slug>`, de-duplicated within the tree);
 * without it nodes carry no id.
 */
export function outline(input: unknown, opts: { idPrefix?: string } = {}): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const stack: Array<{ indent: number; node: OutlineNode }> = [];
  const used = new Set<string>();
  let count = 0;

  for (const raw of text(input).split('\n')) {
    if (!raw.trim()) continue;
    if (count >= OUTLINE_MAX_NODES) break;
    const indent = (/^[\t ]*/.exec(raw)?.[0] ?? '').replaceAll('\t', '  ').length;
    const body = raw.trim().replace(/^[-*]\s+/, '');
    const bar = body.indexOf('|');
    const label = (bar < 0 ? body : body.slice(0, bar)).trim();
    const badge = bar < 0 ? '' : body.slice(bar + 1).trim();
    if (!label) continue;

    const node: OutlineNode = { label, ...(badge ? { badge } : {}) };
    if (opts.idPrefix) {
      const stem = `${opts.idPrefix}-${slug(label) || 'node'}`;
      let id = stem;
      for (let n = 2; used.has(id); n++) id = `${stem}-${n}`;
      used.add(id);
      node.id = id;
    }

    while (stack.length && stack[stack.length - 1]!.indent >= indent) stack.pop();
    // Past the depth cap a line stays at the cap: it becomes a sibling of the deepest allowed level
    // rather than nesting further, and the stack is trimmed so the lines after it can't either.
    if (stack.length >= OUTLINE_MAX_DEPTH) stack.length = OUTLINE_MAX_DEPTH - 1;
    const parent = stack[stack.length - 1]?.node;
    if (parent) (parent.children ??= []).push(node);
    else roots.push(node);

    stack.push({ indent, node });
    count++;
  }
  return roots;
}
