/**
 * Site/company config — public entry point.
 *
 * The schema itself now lives in the `@getvitops/generator` package
 * (`packages/generator/src/site.ts`), so it composes with the design-system schema,
 * exports one JSON Schema, and validates without a workspace-root zod install.
 * This file re-exports it and keeps the pattern-group mappings.
 *
 * YAML loading is the consumer's job (this stays dependency-light): read the
 * YAML, then hand the parsed object to `resolveSiteConfig(obj, siteEnv)`.
 *
 *   import { load as loadYaml } from 'js-yaml';
 *   import { resolveSiteConfig } from '@getvitops/generator';
 *   export default resolveSiteConfig(loadYaml(yamlRaw), import.meta.env.SITE_ENV);
 */

export {
  SiteConfigSchema,
  siteJsonSchema,
  SITE_SCHEMA_URL,
  validateSite,
  resolveSiteConfig,
  resolveTheme,
  stripNulls,
  deepMerge,
} from './packages/generator/src/site.ts';
export type { SiteConfig, SiteValidationResult } from './packages/generator/src/site.ts';

// ── Pattern Group Mappings ────────────────────────────────────────────────────
// Retained for downstream pattern-group tooling.

export const defaultPatternGroupMappings: Record<string, string> = {
  // tag group
  badge: 'tag',
  label: 'tag',
  status: 'tag',
  tooltip: 'tag',
  // control group
  button: 'control',
  link: 'control',
  toggle: 'control',
  switch: 'control',
  copy: 'control',
  combobox: 'control',
  checkbox: 'control',
  select: 'control',
  'input-group': 'control',
  'chip-list': 'control',
  'filtered-list': 'control',
  // panel group
  card: 'panel',
  dialog: 'panel',
  modal: 'panel',
  dropdown: 'panel',
  popover: 'panel',
  notification: 'panel',
  'tab-panel': 'panel',
  tile: 'panel',
  comment: 'panel',
  fieldset: 'panel',
  lightbox: 'panel',
  // area group
  drawer: 'area',
  section: 'area',
  aside: 'area',
  banner: 'area',
  'notification-area': 'area',
  // content group
  details: 'content',
  accordion: 'content',
  figure: 'content',
  list: 'content',
  tree: 'content',
  // pull group
  blockquote: 'pull',
  'pull-quote': 'pull',
};

export const patternGroupNames = ['tag', 'control', 'panel', 'area', 'content', 'pull'] as const;
export type PatternGroupName = (typeof patternGroupNames)[number];
