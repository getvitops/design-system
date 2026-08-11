/**
 * schema.org JSON-LD graph builders — pure functions shared by the
 * @getvitops/astro schema components and platform hooks (e.g. the EmDash
 * plugin's page:metadata contributions).
 */
export { articleGraph } from './article.ts';
export type { ArticleAuthor, ArticleGraphOptions } from './article.ts';
export { breadcrumbGraph } from './breadcrumb.ts';
export type { BreadcrumbGraphOptions, BreadcrumbItem } from './breadcrumb.ts';
export { faqGraph } from './faq.ts';
export type { FAQGraphOptions, FAQItem } from './faq.ts';
export { itemListGraph } from './itemList.ts';
export type { ItemListEntry, ItemListEntryType, ItemListGraphOptions } from './itemList.ts';
export { localBusinessGraph } from './localBusiness.ts';
export type {
  LocalBusinessGraphOptions,
  OpeningHoursSpecification,
  SpecialHoursSpecification,
} from './localBusiness.ts';
export { organizationGraph } from './organization.ts';
export type { OrganizationGraphOptions } from './organization.ts';
