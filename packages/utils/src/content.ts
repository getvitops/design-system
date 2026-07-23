/**
 * Framework-agnostic content-model types, guards, i18n, and part-attr resolution.
 *
 * Extracted from @getvitops/astro so the pure-TS helpers live in one place (no
 * Astro dependency). The Astro-typed element tag was `astro/types`' `HTMLTag`;
 * here it's a plain `string` (any tag name), keeping these fully framework-neutral.
 */

// ── content-model types ──────────────────────────────────────────────────────

/** A translatable value: a plain string, or a locale → string map. */
export type Localizable = string | Record<string, string>;

/**
 * An HTML attribute bag. `class` may be a string or a class:list-style array
 * (falsy entries dropped); everything else is passed through to the element.
 */
export interface Attrs {
  class?: string | (string | false | null | undefined)[];
  [attr: string]: unknown;
}

/** An image reference used by image links. */
export interface ImageRef {
  src: string;
  alt?: Localizable;
  [key: string]: unknown;
}

/** A link with a text label. */
export interface TextLink {
  label: Localizable;
  href: string;
  attrs?: Attrs;
  [key: string]: unknown;
}

/** A link whose content is an image. */
export interface ImageLink {
  image: ImageRef;
  href: string;
  attrs?: Attrs;
  [key: string]: unknown;
}

/** Any link — text or image. */
export type Link = TextLink | ImageLink;

/**
 * A generic content element wrapper (discriminated by `type: 'element'`),
 * carrying a payload `T` rendered as `Tag` (any HTML tag name).
 */
export interface Elmnt<T = unknown, Tag extends string = 'div'> {
  type: 'element';
  tag?: Tag;
  attrs?: Attrs;
  content?: T;
  [key: string]: unknown;
}

/**
 * A renderable node tree — a text string (Localizable) or an element with
 * optional attrs and either `text` shorthand or `children`.
 */
export type ContentNode =
  | string
  | {
      tag: string;
      attrs?: Attrs;
      text?: Localizable;
      children?: ContentNode[];
    };

// ── type guards ──────────────────────────────────────────────────────────────

export function isElmnt<T, Tag extends string = 'div'>(item: any): item is Elmnt<T, Tag> {
  return item && item.type === 'element';
}

export function isLink(item: any): item is Link {
  return item && ('label' in item || 'image' in item) && 'href' in item;
}

export function isTextLink(item: any): item is TextLink {
  return item && 'label' in item && 'href' in item;
}

export function isImageLink(item: any): item is ImageLink {
  return item && 'image' in item && 'href' in item;
}

// ── i18n ─────────────────────────────────────────────────────────────────────

/**
 * Resolve a Localizable value to a string for the given locale. A plain string
 * is returned as-is; a locale map returns the best match (locale → default → '').
 */
export function t(value: Localizable | undefined, locale: string, defaultLocale: string): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[locale] ?? value[defaultLocale] ?? '';
}

// ── part-attr resolution ─────────────────────────────────────────────────────

/**
 * Resolve per-part attrs from a presentation-type config. For the `root` part,
 * merges legacy `attrs` with `parts.root` (backward compat).
 */
export function partAttrs(
  present: { attrs?: Attrs; parts?: Record<string, Attrs> } | undefined,
  part: string,
): Attrs {
  const fromParts = present?.parts?.[part];
  if (part === 'root') {
    const legacy = present?.attrs;
    if (!legacy && !fromParts) return {};
    const { class: lc, ...lr } = legacy ?? {};
    const { class: pc, ...pr } = fromParts ?? {};
    const classes = [lc, pc].flat().filter((c): c is string => typeof c === 'string' && c !== '');
    return {
      ...(classes.length ? { class: classes } : {}),
      ...lr,
      ...pr,
    };
  }
  return fromParts ?? {};
}
