/**
 * @getvitops/utils — shared build-time utilities for the Vitops toolchain.
 */
export {
  faviconLinks,
  faviconManifest,
  generateFavicons,
  writeFaviconManifest,
} from './favicon.ts';
export type {
  FaviconLink,
  FaviconOptions,
  FaviconTagOptions,
  WebManifestOptions,
} from './favicon.ts';

// Framework-agnostic content model + HTML helpers (extracted from @getvitops/astro).
export { isElmnt, isImageLink, isLink, isTextLink, partAttrs, t } from './content.ts';
export type {
  Attrs,
  ContentNode,
  Elmnt,
  ImageLink,
  ImageRef,
  Link,
  Localizable,
  TextLink,
} from './content.ts';
export {
  getAttribute,
  nodesToHtml,
  parseRenderedSlots,
  serialize,
  styleList,
  toHtml,
} from './html.ts';
export type { ChildNode, El, StyleList, StyleValue } from './html.ts';

// schema.org JSON-LD graph builders (shared by @getvitops/astro schema
// components and platform metadata hooks).
export {
  articleGraph,
  breadcrumbGraph,
  faqGraph,
  itemListGraph,
  localBusinessGraph,
  organizationGraph,
} from './schema/index.ts';
export type {
  ArticleAuthor,
  ArticleGraphOptions,
  BreadcrumbGraphOptions,
  BreadcrumbItem,
  FAQGraphOptions,
  FAQItem,
  ItemListEntry,
  ItemListEntryType,
  ItemListGraphOptions,
  LocalBusinessGraphOptions,
  OpeningHoursSpecification,
  OrganizationGraphOptions,
  SpecialHoursSpecification,
} from './schema/index.ts';

/**
 * Semantic icon names → per-set icon names, plus the build-time `include` map.
 *
 * Lives here (rather than in core) because it's a build-time concern and this is
 * the package @getvitops/astro re-exports wholesale — so a consumer can reach
 * `generateIconInclude` from their astro.config without a new export path. Core's
 * icon picker consumes it from here too.
 */
export {
  WEIGHTED_SETS,
  generateIconInclude,
  iconMap,
  prefixToMapKey,
  resolveBrandIcon,
  resolveIcon,
} from './icons.ts';
export type { BrandIcon, IconSet, SemanticIcon } from './icons.ts';

/**
 * Consumer-source scanning. Shared by `vitops lint` (classes) and the Astro
 * integration's icon pass (names) — the CLI can't be imported as a library, so
 * anything both need lives here.
 */
export { SCAN_EXT, SCAN_SKIP, scanFiles } from './scan.ts';
export type { ScanOptions, SourceFile } from './scan.ts';
export { collectIconRefs, extractIconRefs } from './icons-scan.ts';
export type {
  DynamicIconRef,
  IconRef,
  IconRefKind,
  IconScanOptions,
  IconScanResult,
} from './icons-scan.ts';
