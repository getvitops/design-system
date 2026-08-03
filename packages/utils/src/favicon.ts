/**
 * Favicon generation — rasterize a source SVG/PNG into the standard favicon set.
 *
 * Ported from the repo's `lib/favicon.ts` so the logic lives in one place instead
 * of being copied per client. `sharp` + `png-to-ico` are loaded lazily (dynamic
 * import) so merely importing this module is cheap; the native `sharp` binary is
 * only touched when `generateFavicons` actually runs. `oxipng` (lossless PNG
 * crush) is used when present on PATH and skipped otherwise — it is optional.
 */
import { mkdirSync } from 'node:fs';
import { copyFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import cp from 'node:child_process';
import { join } from 'node:path';

const exec = promisify(cp.exec);

export interface FaviconOptions {
  /** Source image — an SVG or PNG. */
  source: string;
  /** Optional simplified source for the 16px icon. */
  lowResSource?: string;
  /** Directory to write into (default: current directory). */
  outputDir?: string;
  /** Run `oxipng` on the larger PNGs when available (default: true). */
  optimize?: boolean;
  /**
   * Background composited under the two MASKABLE outputs — `icon-mask.png` and
   * `apple-touch-icon.png` (default `#ffffff`, matching the web manifest's
   * `background_color`). The other outputs keep the source's transparency.
   *
   * Maskable means the OS crops the image to its own shape and expects full
   * bleed, so transparency there is not "no background", it is whatever the
   * launcher happens to composite onto — usually black. iOS discards alpha on the
   * apple-touch-icon outright. Since both files sit a deliberately-sized logo on a
   * larger canvas (the maskable safe zone), leaving that canvas transparent turned
   * ~36% of one and ~40% of the other into a black frame on the home screen.
   */
  backgroundColor?: string;
}

/** `#rgb` / `#rrggbb` → a sharp background. Anything else is rejected loudly. */
function parseBackground(color: string): { r: number; g: number; b: number; alpha: number } {
  const hex = color.trim().replace(/^#/, '');
  const full =
    hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex.length === 6 ? hex : null;
  if (full == null || !/^[0-9a-f]{6}$/i.test(full))
    throw new Error(
      `favicon: backgroundColor must be a hex colour like "#ffffff" or "#fff" (got ${JSON.stringify(color)}).`,
    );
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, alpha: 1 };
}

let warnedNoOxipng = false;
async function optimizePng(file: string, enabled: boolean): Promise<void> {
  if (!enabled) return;
  try {
    await exec(`oxipng -o 3 "${file}"`);
  } catch {
    // oxipng missing or failed — lossless crush is best-effort, so skip quietly.
    if (!warnedNoOxipng) {
      warnedNoOxipng = true;
      console.warn('favicon: oxipng not available — skipping lossless PNG optimization.');
    }
  }
}

/**
 * Does the source carry any transparency at all?
 *
 * Best-effort and deliberately quiet on failure — this only decides whether to
 * print a warning, so a probe that throws must not take the build down with it.
 * `stats().isOpaque` is sharp's own answer and covers the SVG case too, since it
 * rasterises first.
 */
async function hasTransparency(
  sharp: typeof import('sharp').default,
  source: string,
): Promise<boolean> {
  try {
    return !(await sharp(source, { density: 384 }).stats()).isOpaque;
  } catch {
    return false;
  }
}

/**
 * Generate the standard favicon set from an SVG/PNG source into `outputDir`:
 * `favicon.ico`, `icon-{16?,32,192,512}.png`, `apple-touch-icon.png`, `icon-mask.png`.
 * Returns the list of written file paths.
 */
export async function generateFavicons(opts: FaviconOptions): Promise<string[]> {
  const { source, lowResSource } = opts;
  if (!source) throw new Error('favicon: no source path provided');
  if (!source.endsWith('.svg') && !source.endsWith('.png'))
    throw new Error('favicon: source must be an SVG or PNG file');

  const dir = (opts.outputDir ?? '.').replace(/\/+$/, '');
  const optimize = opts.optimize ?? true;
  // Same default as the web manifest's `background_color`. The two disagreeing is
  // the actual bug: `backgroundColor` reached the manifest and never the raster.
  const maskBg = parseBackground(opts.backgroundColor ?? '#ffffff');
  mkdirSync(dir, { recursive: true });
  const out = (name: string) => join(dir, name);

  const written: string[] = [];

  // Modern browsers prefer a scalable SVG favicon (and it supports dark-mode via
  // CSS media queries) — ship the source verbatim as favicon.svg when it is one.
  if (source.endsWith('.svg')) {
    await copyFile(source, out('favicon.svg'));
    written.push(out('favicon.svg'));
  }

  // Lazy-load the native/heavy deps only when actually generating.
  const [{ default: sharp }, { default: pngToIco }] = await Promise.all([
    import('sharp'),
    import('png-to-ico'),
  ]);

  // Rasterize the main source at each size. sharp reads SVG natively via libvips;
  // rendering at high density first keeps small-size edges crisp (ignored for PNG).
  await Promise.all(
    [32, 192, 512].map((size) =>
      sharp(source, { density: 384 })
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(out(`icon-${size}.png`))
        .then(() => written.push(out(`icon-${size}.png`))),
    ),
  );

  // Optional low-res 16px variant.
  if (lowResSource) {
    await sharp(lowResSource, { density: 384 })
      .resize(16, 16, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(out('icon-16.png'));
    written.push(out('icon-16.png'));
  }

  // favicon.ico — sharp can't encode .ico, so png-to-ico packs the PNGs into the
  // multi-resolution container. Browsers pick the best size inside the file.
  const icoSources = [out('icon-32.png')];
  if (lowResSource) icoSources.unshift(out('icon-16.png'));
  await writeFile(out('favicon.ico'), await pngToIco(icoSources));
  written.push(out('favicon.ico'));

  // The two MASKABLE outputs below are composited onto an opaque background: the
  // OS crops them to its own shape, so transparency reads as a black frame rather
  // than as "no background". Warn when we're inventing that colour rather than
  // being told it, since white is a guess that a dark logo would lose against.
  if (opts.backgroundColor == null && (await hasTransparency(sharp, source))) {
    console.warn(
      `favicon: ${source} has transparency, and the maskable outputs (icon-mask.png, ` +
        'apple-touch-icon.png) must be opaque — the OS crops them to its own shape. ' +
        'Defaulting their background to #ffffff; set backgroundColor to choose.',
    );
  }

  // apple-touch-icon: 140x140 logo centered on a 180x180 canvas.
  await sharp(out('icon-512.png'))
    .resize(140, 140, { fit: 'contain', background: maskBg })
    .extend({ top: 20, bottom: 20, left: 20, right: 20, background: maskBg })
    .flatten({ background: maskBg }) // iOS discards alpha; do it ourselves so we pick the colour
    .png()
    .toFile(out('apple-touch-icon.png'));
  written.push(out('apple-touch-icon.png'));

  // icon-mask (maskable): 409x409 logo centered on a 512x512 canvas. The 409/512
  // inset IS the maskable safe zone — the geometry was always right, only the
  // fill was wrong.
  await sharp(out('icon-512.png'))
    .resize(409, 409, { fit: 'contain', background: maskBg })
    .extend({ top: 52, bottom: 51, left: 52, right: 51, background: maskBg })
    .flatten({ background: maskBg })
    .png()
    .toFile(out('icon-mask.png'));
  written.push(out('icon-mask.png'));

  // Lossless crush of the larger PNGs (best-effort; needs oxipng on PATH).
  await Promise.all(
    ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'icon-mask.png'].map((image) =>
      optimizePng(out(image), optimize),
    ),
  );

  return written;
}

// ── Head tags + web manifest (the "tag layer" over the generated image files) ──

export interface FaviconLink {
  rel: string;
  href: string;
  type?: string;
  sizes?: string;
}

export interface FaviconTagOptions {
  /** Whether a favicon.svg was emitted (source was an SVG). */
  hasSvg?: boolean;
  /** Include the `<link rel="manifest">` (default true). */
  manifest?: boolean;
  /** URL base the favicon files are served from (default '' → site root). */
  base?: string;
}

/**
 * The ordered `<link>` data matching what `generateFavicons` writes. Pure — no
 * I/O — so it can drive an Astro `<Head />`, the CLI, or plain HTML.
 */
export function faviconLinks(opts: FaviconTagOptions = {}): FaviconLink[] {
  const base = (opts.base ?? '').replace(/\/+$/, '');
  const href = (f: string) => `${base}/${f}`;
  const links: FaviconLink[] = [{ rel: 'icon', href: href('favicon.ico'), sizes: '32x32' }];
  if (opts.hasSvg) links.push({ rel: 'icon', type: 'image/svg+xml', href: href('favicon.svg') });
  links.push({ rel: 'icon', type: 'image/png', sizes: '32x32', href: href('icon-32.png') });
  links.push({ rel: 'apple-touch-icon', href: href('apple-touch-icon.png') });
  if (opts.manifest !== false) links.push({ rel: 'manifest', href: href('site.webmanifest') });
  return links;
}

export interface WebManifestOptions {
  name: string;
  shortName?: string;
  themeColor?: string;
  backgroundColor?: string;
  /** URL base the icon files are served from (default '' → site root). */
  base?: string;
}

/** Build the web-app-manifest object (icons match `generateFavicons` output). */
export function faviconManifest(opts: WebManifestOptions): Record<string, unknown> {
  const base = (opts.base ?? '').replace(/\/+$/, '');
  const src = (f: string) => `${base}/${f}`;
  return {
    name: opts.name,
    short_name: opts.shortName ?? opts.name,
    // `purpose` is stated on all three rather than left to default. An entry with
    // no purpose is implicitly "any", so omitting it worked — but with a maskable
    // present and nothing else claiming "any", some launchers picked the maskable
    // for slots that wanted a plain icon, i.e. the one with the safe-zone inset.
    icons: [
      { src: src('icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: src('icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: src('icon-mask.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    theme_color: opts.themeColor ?? '#ffffff',
    background_color: opts.backgroundColor ?? '#ffffff',
    display: 'standalone',
    start_url: '/',
  };
}

/** Write `site.webmanifest` into `dir`. Returns the written path. */
export async function writeFaviconManifest(dir: string, opts: WebManifestOptions): Promise<string> {
  const path = join(dir.replace(/\/+$/, ''), 'site.webmanifest');
  await writeFile(path, `${JSON.stringify(faviconManifest(opts), null, 2)}\n`);
  return path;
}
