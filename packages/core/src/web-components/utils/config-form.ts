/**
 * The decisions `<wc-config-form>` makes, as functions over plain values, so they are tested without
 * a DOM (the element's own wiring is in `WCConfigForm.dom.test.ts`).
 */
import type { ValidationIssue } from '@getvitops/config/forms';

/** A trailing marker `formToConfig` strips from a control name to reach the config path. */
const TRAILING_MARKER = /(?:\$bool|\$num|\$lines|\$loc\.\d+\.(?:code|value))$/;
const MAP = /^(.*?)\$map\.(\d+)\.(.*)$/s;

/**
 * The dotted document path a control's value lands at, or `undefined` when a row it sits in has no
 * key yet (the blank "add another" row). `keyOf` returns the current text of the key control named
 * by `…$map.N.$key`, which is what turns a row index into the real map key.
 *
 *   organization.email                               → organization.email
 *   organization.name$loc.1.value                    → organization.name
 *   organization.services$map.0.price$num            → organization.services.roof.price   (key "roof")
 *   a$map.0.inner$map.1.n                            → a.outer.inner.x.n
 */
export function docPathOf(name: string, keyOf: (keyName: string) => string): string | undefined {
  let rest = name.replace(TRAILING_MARKER, '');
  let raw = '';
  let path = '';
  for (;;) {
    const match = MAP.exec(rest);
    if (!match) return rest === '$value' && path ? path.slice(0, -1) : path + rest;
    const [, before, index, tail] = match as unknown as [string, string, string, string];
    raw += before;
    const key = keyOf(`${raw}$map.${index}.$key`).trim();
    if (!key) return undefined;
    path += `${before}.${key}.`;
    raw += `$map.${index}.`;
    rest = tail;
  }
}

/**
 * The first message for a control at `path`: an issue at the path itself, or inside it (a locale
 * map's issue is at `organization.name.en` while the control's path is `organization.name`).
 */
export function messageAt(issues: readonly ValidationIssue[], path: string): string {
  const hit = issues.find((issue) => issue.path === path || issue.path.startsWith(`${path}.`));
  return hit?.message ?? '';
}

const slug = (name: string): string => name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');

/**
 * Renumber one attribute value of a cloned map row from row `from` to row `to`.
 *
 * `base` is the map's own control name (`organization.services`). Names carry `…$map.N.`; ids are
 * derived from the same name with every non-alphanumeric run turned into `-` (`…-map-N-…`), and the
 * key control's id is `<fieldset id>-N-key`. Only this map's index is changed, so a nested map's own
 * indices inside the row are left alone.
 */
export function renumber(
  value: string,
  base: string,
  from: number,
  to: number,
  kind: 'name' | 'id',
): string {
  if (kind === 'name') return value.split(`${base}$map.${from}.`).join(`${base}$map.${to}.`);
  const map = slug(base);
  return value
    .split(`${map}-map-${from}-`)
    .join(`${map}-map-${to}-`)
    .split(`${map}-${from}-key`)
    .join(`${map}-${to}-key`);
}

/** `organization.services$map.2.$key` → `{ base: 'organization.services', index: 2 }`. */
export function parseKeyName(name: string): { base: string; index: number } | undefined {
  const match = /^(.*)\$map\.(\d+)\.\$key$/s.exec(name);
  return match ? { base: match[1]!, index: Number(match[2]) } : undefined;
}
