export type ItemListEntryType =
  | 'Article'
  | 'Recipe'
  | 'Movie'
  | 'Course'
  | 'Restaurant'
  | 'Product'
  // Anything else is still valid ItemList markup, just not a Google
  // carousel rich-result candidate — those six are the full supported set.
  | (string & {});

export interface ItemListEntry {
  type: ItemListEntryType;
  name: string;
  /**
   * Summary-page format: the item's own detail page (unique, same domain).
   * All-in-one-page format: this page's URL plus an HTML anchor pointing at
   * the item on it.
   */
  url: string;
  image?: string;
  description?: string;
}

export interface ItemListGraphOptions {
  items: ItemListEntry[];
  /** Recommended, not required by the spec — names the list itself. */
  name?: string;
}

/** Build a schema.org ItemList JSON-LD graph (e.g. for a carousel rich result). */
export function itemListGraph(options: ItemListGraphOptions): Record<string, unknown> {
  const { items, name } = options;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    ...(name && { name }),
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': item.type,
        name: item.name,
        url: item.url,
        ...(item.image && { image: item.image }),
        ...(item.description && { description: item.description }),
      },
    })),
  };
}
