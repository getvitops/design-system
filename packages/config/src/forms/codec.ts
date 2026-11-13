/**
 * The wire format between an HTML form and the config document.
 *
 * A form that works with JavaScript off can only send flat `name=value` pairs, so four field shapes
 * have to survive that trip, and the marker suffixes below are how:
 *
 *   organization.email                    a scalar leaf
 *   organization.name$loc.0.code|value    one row of a `{ en: …, fr: … }` map
 *   organization.sameAs$lines             a textarea, one array item per line
 *   organization.services$map.0.$key      the key of a repeatable keyed map
 *   organization.services$map.0.name      a field inside that row
 *   site.ads.google.enabled$bool          a checkbox (native "omitted when unchecked", paired with
 *                                         a hidden "false" sibling so unchecking still submits)
 *   site.experiments$map.0.splitRatio$num a number input, coerced to a JSON number
 *
 * `$` cannot appear in a config property name, so the markers need no escaping. Row indices are a
 * rendering detail: keyed maps are keyed by `$key`, never by position. `$bool`/`$num` compose with
 * `$map` (the marker lands on the sub-path), since a row's fields go through the same coercion as
 * a top-level field.
 *
 * The **name builders** below are the other half of the contract. `formToConfig` parses these names
 * and the renderer (`@getvitops/utils/forms`) writes them, so both import the same functions and
 * cannot drift. This module is shape, not validity: `validateAgainstSchema` decides whether the
 * result is a legal config, which is what lets a form say "must be a full URL" beside the field
 * rather than rejecting the whole submission at the parse step.
 */
import { setPath, type Json, type JsonObject } from './json-schema.ts';

const LOC = /^(?<path>.+)\$loc\.(?<index>\d+)\.(?<part>code|value)$/;
const LINES = /^(?<path>.+)\$lines$/;
const MAP = /^(?<path>.+)\$map\.(?<index>\d+)\.(?<sub>.+)$/;
const BOOL = /^(?<path>.+)\$bool$/;
const NUM = /^(?<path>.+)\$num$/;

/** Name of a plain text-like control. */
export const scalarName = (path: string): string => path;
/** Name of a checkbox / switch. */
export const boolName = (path: string): string => `${path}$bool`;
/** Name of a number input. */
export const numName = (path: string): string => `${path}$num`;
/** Name of a one-item-per-line textarea. */
export const linesName = (path: string): string => `${path}$lines`;
/** Name of the locale-code or value half of one translation row. */
export const locName = (path: string, index: number, part: 'code' | 'value'): string =>
  `${path}$loc.${index}.${part}`;
/** Name of a keyed-map row's key input. */
export const mapKeyName = (path: string, index: number): string => `${path}$map.${index}.$key`;
/** Name of a field inside a keyed-map row (`sub` may carry its own `$bool`/`$num` marker). */
export const mapFieldName = (path: string, index: number, sub: string): string =>
  `${path}$map.${index}.${sub}`;

/**
 * Strip a `$bool`/`$num` marker off `path`, coerce `raw` to the JSON type it names, then set it. A
 * checkbox's hidden "false" sibling and its own "true" both flow through here in DOM order, so
 * whichever was actually submitted last wins.
 */
function coerceAndSet(target: JsonObject, path: string, raw: string): void {
  const bool = BOOL.exec(path);
  if (bool?.groups) {
    setPath(target, bool.groups.path!, raw === 'true');
    return;
  }
  const num = NUM.exec(path);
  if (num?.groups) {
    const parsed = Number(raw);
    if (raw.trim() !== '' && Number.isFinite(parsed)) setPath(target, num.groups.path!, parsed);
    return;
  }
  if (raw.trim() !== '') setPath(target, path, raw.trim());
}

/**
 * Drop empty strings, empty arrays and empty objects, depth-first.
 *
 * Not cosmetic: the schema marks `address.streetAddress` and friends required *within* `address`,
 * so an address object holding five empty strings is invalid while no address object at all is
 * fine. "Cleared the field" and "never filled it in" must reach the document as the same thing.
 */
export function prune(value: Json): Json | undefined {
  if (typeof value === 'string') return value.trim() === '' ? undefined : value.trim();
  if (Array.isArray(value)) {
    const items = value.map(prune).filter((item): item is Json => item !== undefined);
    return items.length ? items : undefined;
  }
  if (typeof value === 'object' && value !== null) {
    const out: JsonObject = {};
    for (const [key, child] of Object.entries(value)) {
      const pruned = prune(child);
      if (pruned !== undefined) out[key] = pruned;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return value;
}

type Entries = Iterable<[string, FormDataEntryValue | string]>;

/** Turn submitted form fields into a config document. */
export function formToConfig(entries: Entries): JsonObject {
  const out: JsonObject = {};
  const locales = new Map<string, Map<string, { code?: string; value?: string }>>();
  const maps = new Map<string, Map<string, { key?: string; fields: JsonObject }>>();

  for (const [name, raw] of entries) {
    if (typeof raw !== 'string') continue;
    // A framework's own action marker, and any other non-config control.
    if (name.startsWith('_') || name === 'intent') continue;
    const value = raw;

    const loc = LOC.exec(name);
    if (loc?.groups) {
      const rows = locales.get(loc.groups.path!) ?? new Map();
      const row = rows.get(loc.groups.index!) ?? {};
      row[loc.groups.part as 'code' | 'value'] = value;
      rows.set(loc.groups.index!, row);
      locales.set(loc.groups.path!, rows);
      continue;
    }

    const map = MAP.exec(name);
    if (map?.groups) {
      const rows = maps.get(map.groups.path!) ?? new Map();
      const row = rows.get(map.groups.index!) ?? { fields: {} };
      if (map.groups.sub === '$key') row.key = value.trim();
      else coerceAndSet(row.fields, map.groups.sub!, value);
      rows.set(map.groups.index!, row);
      maps.set(map.groups.path!, rows);
      continue;
    }

    const lines = LINES.exec(name);
    if (lines?.groups) {
      const items = value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      if (items.length) setPath(out, lines.groups.path!, items);
      continue;
    }

    coerceAndSet(out, name, value);
  }

  // Locale rows win over a single-value input for the same path: a field with translations *is*
  // the map form, and carrying both would write a shape the schema's `anyOf` has no branch for.
  for (const [path, rows] of locales) {
    const translations: JsonObject = {};
    for (const { code, value } of rows.values()) {
      if (code?.trim() && value?.trim()) translations[code.trim()] = value.trim();
    }
    if (Object.keys(translations).length) setPath(out, path, translations);
  }

  for (const [path, rows] of maps) {
    const entriesOut: JsonObject = {};
    for (const { key, fields } of rows.values()) {
      if (!key) continue;
      const pruned = prune(fields);
      // A row with a key and nothing in it is the blank "add another" row someone typed a name
      // into and then thought better of.
      if (pruned === undefined) continue;
      entriesOut[key] = pruned;
    }
    if (Object.keys(entriesOut).length) setPath(out, path, entriesOut);
  }

  return (prune(out) as JsonObject | undefined) ?? {};
}
