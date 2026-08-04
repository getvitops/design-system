/**
 * Top-level config — public entry point.
 *
 * The schema itself now lives in the `@getvitops/generator` package
 * (`packages/generator/src/config.ts`), so it composes with the design-system schema,
 * exports one JSON Schema, and validates without a workspace-root zod install.
 * This file re-exports it and keeps the pattern-group mappings.
 *
 * YAML loading is the consumer's job (this stays dependency-light): read the
 * YAML, then hand the parsed object to `resolveConfig(obj, siteEnv)`.
 *
 *   import { load as loadYaml } from 'js-yaml';
 *   import { resolveConfig } from '@getvitops/generator';
 *   export default resolveConfig(loadYaml(yamlRaw), import.meta.env.SITE_ENV);
 */

export {
  ConfigSchema,
  configJsonSchema,
  CONFIG_SCHEMA_URL,
  validateConfig,
  resolveConfig,
  resolveTheme,
  stripNulls,
  deepMerge,
} from '@getvitops/generator';
export type { Config, ConfigValidationResult } from '@getvitops/generator';

// ── Pattern Group Mappings ────────────────────────────────────────────────────
// Retained for downstream pattern-group tooling.

export const defaultPatternGroupMappings: Record<string, string> = {
  // label group — small inline labels. `badge` is the static one, `tag` the
  // editable/dismissable one. (The group is named `label`, not `tag`, so the
  // group tokens `--<prop>-label` don't collide with the `tag` pattern's own
  // override hooks `--<prop>-tag`.)
  badge: 'label',
  tag: 'label',
  status: 'label',
  tooltip: 'label',
  // control group
  btn: 'control',
  cta: 'control',
  link: 'control',
  toggle: 'control',
  switch: 'control',
  copy: 'control',
  combobox: 'control',
  checkbox: 'control',
  select: 'control',
  'input-group': 'control',
  'tag-list': 'control',
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

export const patternGroupNames = ['label', 'control', 'panel', 'area', 'content', 'pull'] as const;
export type PatternGroupName = (typeof patternGroupNames)[number];
