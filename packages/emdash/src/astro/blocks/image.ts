/**
 * The decisions behind a responsive block image, kept apart from the component so they can be
 * asserted without rendering.
 *
 * A block's image field stores a URL (EmDash's `media_picker` yields a string, not a media value
 * with dimensions), so the intrinsic size is unknown. Rather than fetch the file on every render
 * (Astro's `inferSize`) the editor may state an **aspect ratio**; with one the block can ask the
 * image service for a `srcset` and reserve its box (no layout shift), and without one it renders
 * the plain `<img>` it always did. Nothing existing changes until an editor opts in.
 */

/**
 * The srcset widths. Same eight steps as EmDash's own `responsiveWidths` (640–1920): that helper
 * is not part of `emdash`'s public exports, so the list is repeated here and the rule below
 * (retina up to 2x the display width, plus the exact width) is the same one.
 */
export const BREAKPOINTS = [640, 750, 828, 960, 1080, 1280, 1600, 1920] as const;

/** Narrowest and widest ratio accepted (width ÷ height). Outside this is a typo, not a photo. */
const MIN_RATIO = 0.2;
const MAX_RATIO = 5;

/**
 * Parse what an editor typed into a width ÷ height ratio. Accepts `16:9`, `16/9`, `1200x800`
 * and a bare decimal such as `1.5`. Anything else, or a ratio outside 0.2–5, is `undefined`
 * and the image renders without a srcset rather than with a wrong box.
 */
export function parseRatio(input: unknown): number | undefined {
  const raw = typeof input === 'number' ? String(input) : typeof input === 'string' ? input : '';
  const text = raw.trim().toLowerCase();
  if (!text) return undefined;
  const pair = /^(\d+(?:\.\d+)?)\s*[:/x×]\s*(\d+(?:\.\d+)?)$/.exec(text);
  const ratio = pair
    ? Number(pair[1]) / Number(pair[2])
    : /^\d+(?:\.\d+)?$/.test(text)
      ? Number(text)
      : Number.NaN;
  return Number.isFinite(ratio) && ratio >= MIN_RATIO && ratio <= MAX_RATIO ? ratio : undefined;
}

/**
 * The widths to request for an image displayed at up to `displayWidth` CSS pixels: every
 * breakpoint up to 2x that (for high-density screens) plus the display width itself, so the
 * browser always has an exact-fit candidate. Ascending, no duplicates.
 */
export function srcsetWidths(displayWidth: number): number[] {
  const width = Math.round(displayWidth);
  if (!(width >= 1)) return [];
  const widths = new Set<number>(BREAKPOINTS.filter((w) => w <= width * 2));
  widths.add(width);
  return [...widths].sort((a, b) => a - b);
}

/**
 * Make a root-relative same-origin media URL absolute so the image service will transform it
 * (Astro only transforms absolute URLs on an authorized host). Protocol-relative (`//host`) and
 * backslash forms start with `/` too but leave the origin, so they are returned unchanged and
 * the caller falls back to a plain `<img>`; the same SSRF rule EmDash's own helper follows.
 */
export function absoluteMediaUrl(src: string, origin: string | undefined): string {
  if (!src || !origin || !src.startsWith('/')) return src;
  try {
    const resolved = new URL(src, origin);
    return resolved.origin === new URL(origin).origin ? resolved.href : src;
  } catch {
    return src;
  }
}

/** What the image service needs from `getImage` (a structural slice, so tests need no Astro). */
export type GetImage = (options: {
  src: string;
  width: number;
  height: number;
  widths: number[];
  sizes: string;
  format: 'avif';
}) => Promise<{ src: string; srcSet: { attribute: string } }>;

export interface ResponsiveImage {
  src: string;
  srcset: string | undefined;
  sizes: string;
  width: number;
  height: number;
}

/**
 * The origin a block image is authorized against. The build-time `siteUrl` first: a prerendered
 * page has no real request, so `Astro.url` is localhost there, which is not the host EmDash
 * authorized. At request time on a Worker `process.env` does not carry it, so the request's own
 * origin applies (the right host).
 */
export function resolveImageOrigin(input: {
  siteUrl?: string | undefined;
  env?: string | undefined;
  site?: string | undefined;
  requestOrigin: string;
}): string {
  return input.siteUrl ?? input.env ?? input.site ?? input.requestOrigin;
}

export type ImageFallbackReason = 'unauthorized-origin' | 'transform-failed' | 'not-absolute';

/**
 * Ask the image service for a responsive AVIF `srcset`. Returns the result, or the reason it fell
 * back to the plain `<img>` so the caller can say so (a silent fallback ships the full-size
 * original with no width or height).
 */
export async function transformBlockImage(input: {
  src: string;
  ratio: number;
  displayWidth: number;
  origin: string | undefined;
  getImage: GetImage;
}): Promise<{ image: ResponsiveImage } | { reason: ImageFallbackReason }> {
  const absolute = absoluteMediaUrl(input.src, input.origin);
  if (!/^https?:\/\//i.test(absolute)) return { reason: 'not-absolute' };
  const width = Math.round(input.displayWidth);
  const height = Math.round(width / input.ratio);
  const sizes = `(min-width: ${width}px) ${width}px, 100vw`;
  try {
    const image = await input.getImage({
      src: absolute,
      width,
      height,
      widths: srcsetWidths(width),
      sizes,
      format: 'avif',
    });
    // An unauthorized host comes back unchanged: no srcset beats a srcset of one URL.
    if (!image.src || image.src === absolute) return { reason: 'unauthorized-origin' };
    return {
      image: { src: image.src, srcset: image.srcSet.attribute || undefined, sizes, width, height },
    };
  } catch {
    return { reason: 'transform-failed' };
  }
}

const warned = new Set<string>();

/** Warn once per origin and reason, so a page of images is one line, not one per image. */
export function warnImageFallback(
  reason: ImageFallbackReason,
  src: string,
  origin: string | undefined,
  warn: (message: string) => void = console.warn,
): void {
  if (reason === 'not-absolute') return;
  const key = `${reason}:${origin}`;
  if (warned.has(key)) return;
  warned.add(key);
  warn(
    `[vitops] block image not transformed (${reason}): ${src} on ${origin ?? 'no origin'}. ` +
      'It renders as the full-size original with no width or height. Set Astro `site`, or ' +
      'EMDASH_SITE_URL, to the origin the media is served from.',
  );
}
