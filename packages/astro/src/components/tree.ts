/** One node of a `<Tree />`. See `Tree.astro` for the rendering contract. */
export interface TreeItem {
  label: string;
  /** Small type/meta chip after the label. */
  badge?: string;
  /**
   * Rendered with `set:html`, so it MUST already be escaped. For schema text use
   * the generator's `renderInlineMarkdown()` — one tested escaper beats each
   * caller doing its own, which is how one of them eventually doesn't.
   */
  descriptionHtml?: string;
  /** Extra chip, e.g. "required". */
  flag?: string;
  /** Anchor id, so the node is linkable with no JS. */
  id?: string;
  /** An unnamed group (a union branch) — label renders as emphasis, not code. */
  unnamed?: boolean;
  children?: TreeItem[];
}
