/**
 * Read/write helpers shared by every `.vitops/*.json` cache
 * (`indexing/snapshot.ts`, `reviews/cache.ts`, `media/manifest.ts`).
 *
 * All three follow the same rule: a corrupt or wrong-version file reads as
 * absent, never as an empty-but-valid record — the alternative is
 * indistinguishable from "there is genuinely nothing here" and silently ships
 * an empty result. Each module keeps its own `toX` sorter (they differ in
 * which field holds the record and how its entries are ordered); only the
 * read/write mechanics are shared here.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** A cache file's shape: a version tag plus one record field, keyed by `key`. */
type Versioned<Key extends string> = { version: 1 } & Record<Key, Record<string, unknown> | null>;

/**
 * Read a versioned cache file, or `undefined` when there isn't a usable one
 * (missing, unparsable, wrong version, or `key`'s field isn't an object).
 */
export function readVersioned<T extends Versioned<Key>, Key extends string>(
  path: string,
  key: Key,
): T | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as T;
    if (raw?.version !== 1 || typeof raw[key] !== 'object' || raw[key] === null) return undefined;
    return raw;
  } catch {
    return undefined;
  }
}

/** Write a cache file, creating its directory. Call only once the value is final. */
export function writeVersioned(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
