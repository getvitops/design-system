export interface ArticleAuthor {
  name: string;
  url?: string;
}

export interface ArticleGraphOptions {
  headline: string;
  description?: string;
  image?: string | string[];
  datePublished: string;
  dateModified?: string;
  author: ArticleAuthor | ArticleAuthor[];
  publisher?: {
    name: string;
    logo?: string;
  };
  mainEntityOfPage?: string;
  articleSection?: string;
  wordCount?: number;
  keywords?: string[];
}

/** Build a schema.org Article JSON-LD graph. */
export function articleGraph(options: ArticleGraphOptions): Record<string, unknown> {
  const {
    headline,
    description,
    image,
    datePublished,
    dateModified,
    author,
    publisher,
    mainEntityOfPage,
    articleSection,
    wordCount,
    keywords,
  } = options;

  const authors = Array.isArray(author) ? author : [author];

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    ...(description && { description }),
    ...(image && { image: Array.isArray(image) ? image : [image] }),
    datePublished,
    ...(dateModified && { dateModified }),
    author: authors.map((a) => ({
      '@type': 'Person',
      name: a.name,
      ...(a.url && { url: a.url }),
    })),
    ...(publisher && {
      publisher: {
        '@type': 'Organization',
        name: publisher.name,
        ...(publisher.logo && { logo: { '@type': 'ImageObject', url: publisher.logo } }),
      },
    }),
    ...(mainEntityOfPage && { mainEntityOfPage: { '@type': 'WebPage', '@id': mainEntityOfPage } }),
    ...(articleSection && { articleSection }),
    ...(wordCount && { wordCount }),
    ...(keywords && { keywords: keywords.join(', ') }),
  };
}
