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
