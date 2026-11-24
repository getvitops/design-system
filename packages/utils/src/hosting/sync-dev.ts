/**
 * The decisions behind syncing a long-lived dev site from production — pure, so each is asserted
 * without a database.
 *
 * Dev is a staging site people work on, so a sync that overwrites it must not do so blind. Two
 * things are protected: dev's SCHEMA (replayed afterwards, see `emdash-schema`) and dev's CONTENT.
 * Content is prod-owned, so rather than preserve dev edits the sync REFUSES when there are any
 * and says which collections. `--force` is the explicit "discard them" and a snapshot of dev is
 * always taken first, so forcing is recoverable.
 *
 * "Edited since when" needs a marker that survives the reset, so it is a one-row table written
 * into dev after each sync. Collection tables are `ec_<slug>` with an `updated_at` column.
 */

export const MARKER_TABLE = '_vitops_sync';

/** Collection tables on a dev database. */
export const COLLECTION_TABLES_QUERY =
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name GLOB 'ec_*' AND name NOT GLOB 'ec_*_fts*'";

export const MARKER_QUERY = `SELECT MAX(synced_at) AS marker FROM ${MARKER_TABLE}`;

/** Writes "dev now equals prod" into dev. Run after a sync, so the next one has a baseline. */
export const MARKER_WRITE_SQL = [
  `CREATE TABLE IF NOT EXISTS ${MARKER_TABLE} (synced_at TEXT NOT NULL);`,
  `DELETE FROM ${MARKER_TABLE};`,
  `INSERT INTO ${MARKER_TABLE} (synced_at) VALUES (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));`,
].join('\n');

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

/**
 * One query returning `{ collection, n }` per collection table with rows updated after `marker`.
 * `marker` is bound as a quoted literal (it is a timestamp read back from our own table, but it
 * still never reaches the SQL unquoted). Table names come from `sqlite_master`, and are quoted.
 */
export function changedContentSql(tables: string[], marker: string): string {
  if (!/^[0-9TZ:.\- ]+$/.test(marker))
    throw new Error(`Refusing an unexpected marker "${marker}".`);
  return tables
    .map(
      (t) =>
        `SELECT '${t.replace(/^ec_/, '').replaceAll("'", "''")}' AS collection, COUNT(*) AS n FROM ${quote(t)} WHERE updated_at > '${marker}'`,
    )
    .join(' UNION ALL ');
}

export interface GuardInput {
  /** Last sync time on dev, or `null` when dev has never been synced by this tool. */
  marker: string | null;
  /** Rows changed since the marker, per collection. Ignored when there is no marker. */
  changed: Array<{ collection: string; n: number }>;
  force: boolean;
}

export type GuardDecision = { allow: true; note?: string } | { allow: false; reason: string };

/**
 * Whether the reset may proceed. With no marker there is no baseline to compare against, so
 * anything on dev might be unsaved work: refuse once, and `--force` establishes the baseline.
 */
export function evaluateGuard({ marker, changed, force }: GuardInput): GuardDecision {
  if (force) {
    return {
      allow: true,
      note: 'Forced: dev content will be replaced by production. The snapshot is the way back.',
    };
  }
  if (marker === null) {
    return {
      allow: false,
      reason:
        'Dev has no sync marker, so there is nothing to tell its content apart from work in progress. ' +
        'Run once with --force (a snapshot is taken first); later syncs compare against that.',
    };
  }
  const edited = changed.filter((c) => c.n > 0);
  if (edited.length === 0) return { allow: true };
  return {
    allow: false,
    reason:
      `Dev content changed since the last sync (${marker}): ` +
      edited.map((c) => `${c.collection} (${c.n})`).join(', ') +
      '. Content is owned by production, so syncing replaces these. Re-run with --force to discard them; a snapshot is taken first.',
  };
}
