/**
 * The previous run's sitemap state — what makes "only submit what changed"
 * possible at all.
 *
 * A plain JSON file rather than anything cleverer, because the thing reading it is
 * usually a CI job restoring a cache directory. It must survive being absent
 * (first run, cold cache) without pretending nothing changed — `readSnapshot`
 * returns `undefined` there and `plan()` treats that as "submit everything, and
 * say so".
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SitemapEntry, Snapshot } from './types.ts';

/** Default location, relative to the consumer's project root. */
export const SNAPSHOT_PATH = '.vitops/sitemap-snapshot.json';

/**
 * Read a snapshot, or `undefined` when there isn't a usable one.
 *
 * A corrupt or wrong-version file reads as absent, not as empty. The distinction
 * matters: "absent" submits everything, whereas an empty entry map would look like
 * a site that legitimately has no URLs and submit nothing — the silent-success
 * failure this whole command exists to remove.
 */
export function readSnapshot(path: string): Snapshot | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Snapshot;
    if (raw?.version !== 1 || typeof raw.entries !== 'object' || raw.entries === null)
      return undefined;
    return raw;
  } catch {
    return undefined;
  }
}

/** Build a snapshot from the entries just read. */
export function toSnapshot(sitemapUrl: string, entries: SitemapEntry[], takenAt: string): Snapshot {
  const map: Record<string, string> = {};
  for (const e of entries) map[e.loc] = e.lastmod ?? '';
  return { version: 1, sitemapUrl, takenAt, entries: map };
}

/**
 * Write the snapshot, creating its directory.
 *
 * Call this only after a submission actually succeeded. Writing it eagerly would
 * record URLs as notified that never were, and because the next run diffs against
 * it, those URLs would never be submitted again — a single transient 503 would
 * silently drop a page from every future run.
 */
export function writeSnapshot(path: string, snapshot: Snapshot): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`);
}
