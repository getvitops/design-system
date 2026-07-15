import { fileURLToPath } from 'node:url';
import { realpathSync, mkdirSync } from 'node:fs';
import { promisify } from 'node:util';
import cp from 'node:child_process';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFile } from 'node:fs/promises';

const exec = promisify(cp.exec);

// oxipng handles lossless compression; sharp already emits reasonable PNGs,
// so the earlier `convert -colors 64` quantization step is dropped (it was
// lossy and mainly compensated for ImageMagick's heavier output).
async function optimizePng(file: string) {
  return exec(`oxipng -o 3 "${file}"`);
}

/**
 * Generates favicons from a given image file (SVG or PNG):
 * - favicon.ico
 * - icon-16.png (if lowResSource provided)
 * - icon-32.png
 * - icon-192.png
 * - icon-512.png
 * - apple-touch-icon.png
 * - icon-mask.png
 *
 * NOTE: requires oxipng on PATH. SVG and PNG sources are both handled by sharp.
 */
export async function generateFavicons({
  source,
  lowResSource,
  outputDir,
}: {
  source: string;
  lowResSource?: string;
  outputDir?: string;
}) {
  if (!source) {
    console.error('No source path provided');
    return;
  }

  if (!source.endsWith('.svg') && !source.endsWith('.png')) {
    console.error('Source must be an SVG or PNG file');
    return;
  }

  outputDir = outputDir ? outputDir.replace(/\/+$/, '') + '/' : './';

  mkdirSync(outputDir, { recursive: true });

  // Rasterize the main source at each size. sharp reads SVG natively via
  // libvips, so the same path works for SVG and PNG sources.
  //
  // density: for SVG, libvips renders at 72 DPI by default and then scales,
  // which softens small output. Rendering at high density first, then
  // resizing down, keeps edges crisp. Harmless for PNG sources (ignored).
  await Promise.all(
    [32, 192, 512].map((size) =>
      sharp(source, { density: 384 })
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(`${outputDir}icon-${size}.png`),
    ),
  );

  // Low-res 16px variant, optionally from a simplified source.
  if (lowResSource) {
    await sharp(lowResSource, { density: 384 })
      .resize(16, 16, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(`${outputDir}icon-16.png`);
  }

  // favicon.ico — sharp/libvips can't encode .ico, so png-to-ico packs the
  // PNGs into the multi-resolution container. Pass 32 (and 16 if present);
  // browsers pick the best size from inside the file.
  const icoSources = [`${outputDir}icon-32.png`];
  if (lowResSource) icoSources.unshift(`${outputDir}icon-16.png`);
  await writeFile(`${outputDir}favicon.ico`, await pngToIco(icoSources));

  // apple-touch-icon: 140x140 logo centered on a 180x180 transparent canvas.
  await sharp(`${outputDir}icon-512.png`)
    .resize(140, 140, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 20,
      bottom: 20,
      left: 20,
      right: 20,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(`${outputDir}apple-touch-icon.png`);

  // icon-mask (maskable): 409x409 logo centered on a 512x512 canvas.
  // NOTE: maskable icons are meant to fill the full canvas so the platform
  // can crop to any shape without clipping the logo. A transparent 409/512
  // safe-zone inset works, but if you want a proper maskable icon you'd
  // usually use an opaque background here matching your brand.
  await sharp(`${outputDir}icon-512.png`)
    .resize(409, 409, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 52,
      bottom: 51,
      left: 52,
      right: 51,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(`${outputDir}icon-mask.png`);

  // Lossless crush of the larger PNGs.
  await Promise.all(
    ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'icon-mask.png'].map((image) =>
      optimizePng(`${outputDir}${image}`),
    ),
  );
}

const isMainModule = await (async () => {
  try {
    return fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
})();

export async function cli() {
  const source = process.argv[2];
  if (!source) {
    console.error('Usage: generate-favicons <source.svg|source.png>');
    process.exit(1);
  }

  await generateFavicons({ source, outputDir: './public/' });
}

if (isMainModule) cli();
