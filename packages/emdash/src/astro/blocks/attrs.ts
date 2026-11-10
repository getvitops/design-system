/**
 * The escape hatches every block carries: `anchor` (an `id`), `className` (extra classes)
 * and `style` (CSS custom properties).
 *
 * All three are editor-supplied strings that land in attributes, so each is validated against
 * a closed grammar and anything outside it is dropped, never escaped into place.
 *
 * **`style` is custom properties only.** `--p-card: 2rem` tunes a framework hook, which is how
 * the design system is meant to be overridden. Free-form declarations (`display`, `position`,
 * `background: url(…)`) would let one page quietly diverge from the tokens, and `url(` is a
 * request the visitor's browser makes to wherever an editor points it.
 *
 * **`className` and the `tailwind` format.** Tailwind scans source for class names, not CMS
 * content, so a utility typed here exists only if something else already used it. Under the
 * `css` and `bricks` formats every framework class ships, so the caveat does not apply.
 */

import { resolveTheme } from './tone.ts';

export interface BlockAttrs {
  id?: string;
  class?: string;
  style?: string;
}

const ANCHOR = /^[a-z][a-z0-9-]{0,63}$/;
const CLASS_TOKEN = /^[A-Za-z0-9_:@/.[\]-]{1,80}$/;
const MAX_CLASSES = 20;
const PROPERTY = /^--[a-zA-Z][a-zA-Z0-9-]{0,60}$/;
/** Characters that could end the declaration, open a function that fetches, or leave the attribute. */
const FORBIDDEN_VALUE = /[\\<>@{}"'`]|url\(|expression\(|image-set\(|;/i;

/** Lowercase an anchor and replace anything else with `-`; `undefined` when nothing valid remains. */
export function anchorId(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ANCHOR.test(slug) ? slug : undefined;
}

export function classTokens(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const tokens = input
    .split(/\s+/)
    .filter((t) => CLASS_TOKEN.test(t))
    .slice(0, MAX_CLASSES);
  return tokens.length ? tokens.join(' ') : undefined;
}

/** Keep each `--name: value` pair that passes; drop the rest. */
export function customProperties(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const kept: string[] = [];
  for (const decl of input.split(';')) {
    const at = decl.indexOf(':');
    if (at < 0) continue;
    const name = decl.slice(0, at).trim();
    const value = decl.slice(at + 1).trim();
    if (!PROPERTY.test(name) || !value || value.length > 200 || FORBIDDEN_VALUE.test(value))
      continue;
    kept.push(`${name}: ${value}`);
  }
  return kept.length ? kept.join('; ') : undefined;
}

/** The validated `id` / `class` / `style` for a block's saved value. Empty when none is set. */
export function blockAttrs(input: object | undefined): BlockAttrs {
  const value = input as Record<string, unknown> | undefined;
  const out: BlockAttrs = {};
  const id = anchorId(value?.anchor);
  // Portable Text blocks name it `className`; a block TYPE's slugs must be lowercase, so `class_name`.
  const cls = classTokens(value?.className ?? value?.class_name);
  const style = customProperties(value?.style);
  if (id) out.id = id;
  if (cls) out.class = cls;
  if (style) out.style = style;
  return out;
}

type ClassPart = string | false | null | undefined;

/**
 * The attributes for a block's outermost element: its own classes and style with the editor's
 * `anchor` / `className` / `style` merged in. Spread it on that element (`<div {...root}>`) or pass
 * it to the pattern component that renders it — there is never an extra wrapper node, so a block's
 * DOM shape does not depend on which fields an editor filled in.
 *
 * An anchored element also gets `.block-anchor`, which offsets `scroll-margin-top` for a sticky header.
 */
export function rootAttrs(
  value: object | undefined,
  own: ClassPart[] = [],
  ownStyle?: string,
): BlockAttrs {
  const user = blockAttrs(value);
  // `theme` is the block's backdrop: classes and `--tone-*` properties on its own root, after the
  // block's own tone so an explicit theme wins, and before the editor's `style` so that wins over it.
  const theme = resolveTheme((value as Record<string, unknown> | undefined)?.theme);
  const out: BlockAttrs = {};
  if (user.id) out.id = user.id;
  const cls = [
    ...own.filter((c) => !theme || (c !== 'tone' && c !== 'tone--solid')),
    theme?.className,
    user.id && 'block-anchor',
    user.class,
  ]
    .filter(Boolean)
    .join(' ');
  if (cls) out.class = cls;
  const style = [ownStyle, theme?.style, user.style].filter(Boolean).join('; ');
  if (style) out.style = style;
  return out;
}
