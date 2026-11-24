/**
 * Merge one form submission into a document, touching only the paths that form owns.
 *
 * NOT a deep merge, and NOT "replace the top-level key the patch mentions". A deep merge cannot
 * delete: a value the visitor cleared, a row they removed or a key they renamed would come straight
 * back from the base. Replacing a top-level key is the opposite mistake once a section is split
 * across steps (identity, contact and locations all live under `organization`): a step would erase
 * the others'. Ownership is stated by the form instead, as the projections it rendered, and this
 * touches only those paths:
 *
 * - Inside an owned path the submission is a complete replacement. The form always resubmits every
 *   field, so a field absent from the patch was cleared and is removed (and an ancestor the removal
 *   leaves empty goes with it).
 * - A path outside the owned set is ignored, which is also what stops a forged post writing where
 *   its page never rendered.
 * - A projection may narrow a map to some of each row's fields (locations show `name`, never
 *   `hours`; the brand step shows a palette `seed`, never its `anchors`). For those, a row keeps the
 *   fields the form does not own and takes the owned ones from the patch; a row left with nothing is
 *   dropped.
 *
 * Moved here from the portal, which had its own copy. `/configure` had a plain deep merge and so
 * could not delete anything.
 */
import { valueAt, type JsonObject } from './json-schema.ts';
import type { Projection } from './projections.ts';

export interface OwnedItem {
  /** Dotted config path the form owns. */
  path: string;
  /** For a map of objects: only these fields of each row are the form's. */
  fields?: readonly string[];
}

/** The paths the given projections own: what to pass `mergeOwned`. A notice owns nothing. */
export function ownedFromProjections(projections: readonly Projection[]): OwnedItem[] {
  return projections.flatMap((projection) =>
    projection.items.flatMap((item): OwnedItem[] => {
      if (typeof item === 'string') return [{ path: item }];
      if ('kind' in item) return [];
      return [item.fields ? { path: item.path, fields: item.fields } : { path: item.path }];
    }),
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);

function setAt(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.');
  if (segments.some((segment) => UNSAFE.has(segment))) return;
  let node = target;
  for (const segment of segments.slice(0, -1)) {
    const next = node[segment];
    if (isPlainObject(next)) {
      node = next;
    } else {
      const created: Record<string, unknown> = {};
      node[segment] = created;
      node = created;
    }
  }
  node[segments[segments.length - 1]!] = value;
}

/** Delete `path`, then any ancestor the deletion left empty. */
function deleteAt(target: Record<string, unknown>, path: string): void {
  const segments = path.split('.');
  const chain: Record<string, unknown>[] = [target];
  for (const segment of segments.slice(0, -1)) {
    const next = chain[chain.length - 1]![segment];
    if (!isPlainObject(next)) return;
    chain.push(next);
  }
  delete chain[chain.length - 1]![segments[segments.length - 1]!];
  for (let i = chain.length - 1; i > 0; i--) {
    if (Object.keys(chain[i]!).length > 0) break;
    delete chain[i - 1]![segments[i - 1]!];
  }
}

export function mergeOwned<T extends JsonObject>(
  current: T,
  patch: Record<string, unknown>,
  owned: readonly OwnedItem[],
): T {
  const out = clone(current) as Record<string, unknown>;

  for (const item of owned) {
    const incoming = valueAt(patch, item.path);

    if (!item.fields) {
      if (incoming === undefined) deleteAt(out, item.path);
      else setAt(out, item.path, clone(incoming));
      continue;
    }

    const existing = valueAt(out, item.path);
    const before = isPlainObject(existing) ? existing : {};
    const after = isPlainObject(incoming) ? incoming : {};
    const rows: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (UNSAFE.has(key)) continue;
      const kept: Record<string, unknown> = {};
      const old = before[key];
      if (isPlainObject(old)) {
        for (const [field, value] of Object.entries(old)) {
          if (!item.fields.includes(field)) kept[field] = value;
        }
      }
      const row = after[key];
      if (isPlainObject(row)) {
        for (const field of item.fields) {
          if (row[field] !== undefined) kept[field] = clone(row[field]);
        }
      }
      if (Object.keys(kept).length > 0) rows[key] = kept;
    }
    if (Object.keys(rows).length === 0) deleteAt(out, item.path);
    else setAt(out, item.path, rows);
  }

  return out as T;
}
