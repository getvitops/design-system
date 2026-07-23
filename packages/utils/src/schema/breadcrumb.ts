export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface BreadcrumbGraphOptions {
  items: BreadcrumbItem[];
}

/** Build a schema.org BreadcrumbList JSON-LD graph. */
export function breadcrumbGraph(options: BreadcrumbGraphOptions): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: options.items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
