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
import { writeFile } from 'node:fs/promises';
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
  mkdirSync(dir, { recursive: true });
  const out = (name: string) => join(dir, name);

  // Lazy-load the native/heavy deps only when actually generating.
  const [{ default: sharp }, { default: pngToIco }] = await Promise.all([
    import('sharp'),
    import('png-to-ico'),
  ]);

  const written: string[] = [];

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

  // apple-touch-icon: 140x140 logo centered on a 180x180 transparent canvas.
  await sharp(out('icon-512.png'))
    .resize(140, 140, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 20,
      bottom: 20,
      left: 20,
      right: 20,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(out('apple-touch-icon.png'));
  written.push(out('apple-touch-icon.png'));

  // icon-mask (maskable): 409x409 logo centered on a 512x512 canvas.
  await sharp(out('icon-512.png'))
    .resize(409, 409, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 52,
      bottom: 51,
      left: 52,
      right: 51,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
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
