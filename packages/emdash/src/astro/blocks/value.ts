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
