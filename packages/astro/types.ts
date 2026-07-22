/**
 * Shared content-model types for @getvitops/astro — the shapes the HTML helpers
 * (src/html.ts), type guards (src/types.ts), part-attr resolution (src/parts.ts),
 * and i18n resolution (src/i18n.ts) operate over.
 *
 * NOTE: reconstructed from usage (the original file predates the package split);
 * adjust shapes here if the canonical definitions differ.
 */
import type { HTMLTag } from 'astro/types';

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
 * carrying a payload `T` rendered as `Tag`.
 */
export interface Elmnt<T = unknown, Tag extends HTMLTag = 'div'> {
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
