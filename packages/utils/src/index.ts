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
