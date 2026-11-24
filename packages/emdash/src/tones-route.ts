/**
 * The `tones/list` plugin route: what fills every block's `tone` select with the site's own
 * colour roles (UPSTREAM 21 — "role names the admin never offered").
 *
 * EmDash's Block Kit `select` takes an `optionsRoute` for exactly this, and falls back to the
 * field's static options if the route fails or answers with no `items`, so a site that
 * configures nothing still gets the semantic names from `STATIC_TONE_OPTIONS`.
 *
 * **Where the roles come from.** Plugin code has no site config at runtime, so the site hands
 * it over: `tones: [...]` verbatim, or — if the design-system editor is already wired with the
 * site's `Config` — the `colors.roles` keys of that config, so there is nothing to keep in
 * step. A role is listed under its own name (`brand-primary`), because that is what
 * `resolveTone()` and the token names (`--color-bg-brand-primary-muted`) both use.
 */
import { resolveInput } from '@getvitops/generator/config';
import type { PluginRoute } from 'emdash';
import { SEMANTIC_TONES } from './astro/blocks/tone.ts';

export interface ToneItem {
  id: string;
  name: string;
}

/** Role names of a design system or full config, or `[]` if it cannot be resolved. */
export function rolesOf(config: unknown): string[] {
  if (!config || typeof config !== 'object') return [];
  try {
    const { designSystem } = resolveInput(config as never, { siteEnv: 'production' });
    return Object.keys(designSystem.colors?.roles ?? {});
  } catch {
    // A config the editor cannot resolve is the editor's error to report; here it just
    // means the select keeps its static options.
    return [];
  }
}

/** The items the select shows: the site's roles first, then any semantic name it lacks. */
export function toneItems(roles: readonly string[]): ToneItem[] {
  const names = [...new Set([...roles, ...SEMANTIC_TONES])];
  return [{ id: '', name: 'None' }, ...names.map((id) => ({ id, name: id.replace(/-/g, ' ') }))];
}

export function createTonesRoute(roles: () => readonly string[]): PluginRoute {
  return {
    // An editor opening a block needs this; it reads names, never content.
    permission: 'content:read',
    handler: async () => ({ items: toneItems(roles()) }),
  };
}

/** The `theme` select's items: `None`, then each role tinted and filled (`role`, `role:solid`). */
export function themeItems(roles: readonly string[]): ToneItem[] {
  const names = [...new Set([...roles, ...SEMANTIC_TONES])];
  const label = (id: string) => id.replace(/-/g, ' ');
  return [
    { id: '', name: 'None' },
    ...names.flatMap((id) => [
      { id, name: label(id) },
      { id: `${id}:solid`, name: `${label(id)} (filled)` },
    ]),
  ];
}

export function createThemesRoute(roles: () => readonly string[]): PluginRoute {
  return {
    permission: 'content:read',
    handler: async () => ({ items: themeItems(roles()) }),
  };
}
