/**
 * Config-aware icon resolver.
 *
 * Reads the `icons` section from site.config.yaml and provides a single
 * `icon()` function that auto-detects UI vs brand based on semantic name.
 * Names containing ':' are passed through as-is for backward compatibility.
 */
import siteConfig from '#site-config';
import { resolveIcon, resolveBrandIcon, iconMap, prefixToMapKey, type IconSet } from '../../utils/icons.js';

const iconsConfig = (siteConfig as any).icons as IconsConfig | undefined;
const uiPrefix: string = iconsConfig?.ui || 'fa7-solid';
const brandPrefix: string = iconsConfig?.brand || 'simple-icons';
const uiMapKey = prefixToMapKey[uiPrefix] as IconSet | undefined;
const brandMapKey = prefixToMapKey[brandPrefix] as IconSet | undefined;

/**
 * Resolve a semantic icon name to a fully-qualified astro-icon string.
 * Auto-detects UI vs brand set based on where the name exists.
 * Names containing ':' are returned as-is (pass-through).
 */
export function icon(name: string): string {
  if (name.includes(':')) return name;
  if (uiMapKey && name in iconMap[uiMapKey]) return resolveIcon(name, uiPrefix);
  if (brandMapKey && name in iconMap[brandMapKey]) return resolveBrandIcon(name, brandPrefix);
  throw new Error(`Semantic icon "${name}" not found in UI set "${uiPrefix}" or brand set "${brandPrefix}"`);
}

/** Resolve a brand icon name specifically using the configured brand set */
export function brandIcon(name: string): string {
  return resolveBrandIcon(name, brandPrefix);
}
