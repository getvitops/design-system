import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
import type { ImageMetadata } from 'astro';

export type ResolvedImage =
  | { type: 'svg'; Component: AstroComponentFactory }
  | { type: 'raster'; metadata: ImageMetadata }
  | { type: 'external'; src: string };

const svgModules = import.meta.glob<{ default: AstroComponentFactory }>(
  ['/src/assets/**/*.svg', '/src/icons/**/*.svg'],
  { eager: true }
);

const rasterModules = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/**/*.{jpg,jpeg,png,gif,webp,avif}',
  { eager: true }
);

function candidates(src: string): string[] {
  return [
    `/src/${src}`,
    `/src/assets/${src.replace(/^assets\//, '')}`,
    `/${src}`,
  ];
}

export function resolveImage(src: string): ResolvedImage {
  const isSvg = src.endsWith('.svg');
  const modules = isSvg ? svgModules : rasterModules;

  for (const candidate of candidates(src)) {
    const mod = modules[candidate];
    if (mod) {
      return isSvg
        ? { type: 'svg', Component: (mod as { default: AstroComponentFactory }).default }
        : { type: 'raster', metadata: (mod as { default: ImageMetadata }).default };
    }
  }

  return { type: 'external', src };
}

/** Normalise an ImageRef to { src, alt, width, height } */
export function normalizeImageRef(ref: ImageRef): { src: string; alt: string; width?: number; height?: number } {
  if (typeof ref === 'string') {
    return { src: ref, alt: '' };
  }
  const alt = typeof ref.alt === 'string' ? ref.alt : Object.values(ref.alt)[0] ?? '';
  return { src: ref.src, alt, width: ref.width, height: ref.height };
}
