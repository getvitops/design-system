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
