export interface FAQItem {
  question: string;
  answer: string;
}

export interface FAQGraphOptions {
  items: FAQItem[];
}

/**
 * Build a schema.org FAQPage JSON-LD graph.
 *
 * NOTE: Google recommends FAQ markup only for authoritative government
 * and health sites. For other sites, consider using QAPage schema instead.
 */
export function faqGraph(options: FAQGraphOptions): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: options.items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
