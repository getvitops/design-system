/**
 * Copying one EmDash D1 database into another — the primitive behind `vitops emdash db copy`.
 *
 * Pure planner first, executor second, the same split `plan.ts` / `wrangler.ts` make. Everything
 * that decides whether a copy is SAFE lives here as functions over strings, so the one check that
 * stands between a script and production is asserted in a test.
 *
 * Why a four-file dump instead of `wrangler d1 export` of the whole database: that command
 * refuses a database with a virtual table, and EmDash keeps its search index in FTS5 virtual
 * tables, so a plain export fails as soon as any collection has search on. EmDash's own backup
 * guide documents the workaround this follows: export the other tables by name (the search index
 * is rebuilt on first search), import `media_folders` before the rows that reference it, and
 * create indexes and triggers last so a trigger doesn't fire while rows load.
 */
import type { ExecImpl } from './wrangler.ts';

/** What a copy may write to. A target is never anything but one of these. */
export type CopyTargetKind = 'dev' | 'rehearse';

export interface CopyGuardInput {
  /** The target database's name, e.g. `site-dev` or `site-rehearse-4821`. */
  targetName: string;
  /** The id we were told the target has (an env var / the id `d1 create` printed). */
  targetId: string | undefined;
  /** The id Cloudflare reports for `targetName`. */
  targetReportedId: string | undefined;
  /** Production's id. A target equal to it is refused. */
  prodId: string | undefined;
  kind: CopyTargetKind;
}

/** `site-dev`, or `site-rehearse-<digits>` — the only names a copy will write to. */
const NAME_PATTERNS: Record<CopyTargetKind, RegExp> = {
  dev: /-dev$/,
  rehearse: /-rehearse-\d+$/,
};

/**
 * Throws unless it is safe to overwrite `targetName`. A copy DROPS every table in a `dev`
 * target, so pointing it at production would erase production — the thing the whole environment
 * split exists to prevent. Checked before the first write, and `--dry` stops after it.
 */
export function assertSafeTarget(input: CopyGuardInput): void {
  const { targetName, targetId, targetReportedId, prodId, kind } = input;
  if (!targetId) throw new Error('The target database id is not set.');
  if (!NAME_PATTERNS[kind].test(targetName)) {
    throw new Error(
      `Refusing: "${targetName}" is not a ${kind === 'dev' ? '-dev' : '-rehearse-<run id>'} database.`,
    );
  }
  if (targetReportedId !== targetId) {
    throw new Error(
      `The target id (${targetId}) does not match "${targetName}" (${targetReportedId ?? 'not found'}). One of them is stale.`,
    );
  }
  if (!prodId) throw new Error("Could not resolve production's database id.");
  if (targetId === prodId)
    throw new Error('Refusing: the target database id is the production id.');
}

/** `<name>-dev`, from the production database name. */
export const devDatabaseName = (prod: string): string => `${prod}-dev`;
/** `<name>-rehearse-<run id>`; the run id must be digits so cleanup can match it exactly. */
export function rehearseDatabaseName(prod: string, runId: string): string {
  if (!/^\d+$/.test(runId)) throw new Error(`Run id must be digits, got "${runId}".`);
  return `${prod}-rehearse-${runId}`;
}

/**
 * Pull the D1 database and R2 bucket names out of a wrangler.jsonc source. Regex rather than a
 * JSONC parser: these two keys are all that is read, and `//` comment lines are stripped first so
 * a commented-out example block can't be picked up.
 */
export function parseBindingNames(jsonc: string): { database?: string; bucket?: string } {
  const code = jsonc
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  const database = /"database_name"\s*:\s*"([^"]+)"/.exec(code)?.[1];
  const bucket = /"bucket_name"\s*:\s*"([^"]+)"/.exec(code)?.[1];
  return { ...(database ? { database } : {}), ...(bucket ? { bucket } : {}) };
}

export interface MasterRow {
  name: string;
  type: string;
  sql?: string | null;
}

/**
 * SQL that empties a database: views, then virtual tables, then ordinary tables. A virtual table
 * owns shadow tables named `<virtual>_*`, which SQLite refuses to drop on their own and removes
 * with the parent, so those are skipped.
 */
export function dropStatements(rows: MasterRow[]): string[] {
  const virtual = rows.filter((r) => /^CREATE VIRTUAL TABLE/i.test(r.sql ?? ''));
  const isShadow = (name: string) => virtual.some((v) => name.startsWith(`${v.name}_`));
  const tables = rows.filter(
    (r) => r.type === 'table' && !virtual.includes(r) && !isShadow(r.name),
  );
  const q = (name: string) => `"${name.replaceAll('"', '""')}"`;
  return [
    'PRAGMA defer_foreign_keys = true;',
    ...rows.filter((r) => r.type === 'view').map((r) => `DROP VIEW IF EXISTS ${q(r.name)};`),
    ...virtual.map((r) => `DROP TABLE IF EXISTS ${q(r.name)};`),
    ...tables.map((r) => `DROP TABLE IF EXISTS ${q(r.name)};`),
  ];
}

/** Tables that are never dumped: the search index (rebuilt on first search) and SQLite/CF internals. */
export const TABLES_QUERY =
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT GLOB '_emdash_fts_*' AND name NOT GLOB 'sqlite_*' AND name NOT GLOB '_cf_*' AND name != 'media_folders'";

/** Indexes and triggers, minus those of the search index. They are created last. */
export const INDEXES_QUERY =
  "SELECT sql FROM sqlite_master WHERE type IN ('index', 'trigger') AND sql IS NOT NULL AND name NOT GLOB '_emdash_fts_*' AND tbl_name NOT GLOB '_emdash_fts_*' AND tbl_name NOT GLOB '_cf_*'";

/** What to wipe before importing into an existing database. */
export const WIPE_QUERY =
  "SELECT name, type, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' AND type IN ('table','view')";

/** The four files, in the order they must be imported. */
export const DUMP_FILES = [
  'backup-schema.sql',
  'backup-folders.sql',
  'backup-data.sql',
  'backup-indexes.sql',
] as const;

/** D1 rejects a statement of this many bytes or more (SQLITE_TOOBIG), failing the whole file. */
export const D1_MAX_STATEMENT_BYTES = 100_000;

/**
 * 1-based line numbers (per file) whose statement D1 would refuse. Exports write one INSERT per
 * line, so a long entry or revision can exceed the limit. Counts bytes, not UTF-16 units: the
 * limit is on the encoded statement.
 */
export function tooBigStatements(
  files: Record<string, string>,
): Array<{ file: string; line: number }> {
  const out: Array<{ file: string; line: number }> = [];
  for (const [file, text] of Object.entries(files)) {
    text.split('\n').forEach((line, i) => {
      if (new TextEncoder().encode(line).length >= D1_MAX_STATEMENT_BYTES) {
        out.push({ file, line: i + 1 });
      }
    });
  }
  return out;
}

export interface CopyPlan {
  source: string;
  target: string;
  kind: CopyTargetKind;
  /** A `dev` target already holds tables and is wiped; a fresh `rehearse` one is not. */
  wipeTarget: boolean;
}

/** Validates the guard, then says what a copy will do. Throws when it is unsafe. */
export function planD1Copy(input: CopyGuardInput & { source: string }): CopyPlan {
  assertSafeTarget(input);
  return {
    source: input.source,
    target: input.targetName,
    kind: input.kind,
    wipeTarget: input.kind === 'dev',
  };
}

export type CopyResult =
  | { ok: true; steps: string[] }
  | { ok: false; step: string; message: string };

const wr = (args: string[]): [string, string[]] => ['npx', ['wrangler', ...args]];

/** Run a wrangler command and parse `--json` D1 results (first statement's rows). */
async function queryRows<T>(
  exec: ExecImpl,
  db: string,
  sql: string,
): Promise<{ ok: true; rows: T[] } | { ok: false; message: string }> {
  const [cmd, args] = wr(['d1', 'execute', db, '--remote', '--json', '--command', sql]);
  const res = await exec(cmd, args);
  if (!res.ok) return { ok: false, message: res.message ?? 'query failed' };
  try {
    const parsed = JSON.parse(res.stdout) as Array<{ results?: T[] }>;
    return { ok: true, rows: parsed[0]?.results ?? [] };
  } catch {
    return { ok: false, message: 'wrangler returned output that is not JSON' };
  }
}

export interface CopyIO {
  exec: ExecImpl;
  /** Directory for the dump files; the caller owns its lifetime. */
  dir: string;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, data: string) => Promise<void>;
}

const join = (dir: string, name: string) => `${dir.replace(/\/$/, '')}/${name}`;

/**
 * Dump `source` to `dir` as the four files. Used by `copy` and, on its own, as the pre-reset
 * snapshot of a dev database. Stops on the first failure and says which step it was.
 */
export async function dumpDatabase(source: string, io: CopyIO): Promise<CopyResult> {
  const steps: string[] = [];
  const fail = (step: string, message: string): CopyResult => ({ ok: false, step, message });

  const tables = await queryRows<{ name: string }>(io.exec, source, TABLES_QUERY);
  if (!tables.ok) return fail('list tables', tables.message);
  const tableArgs = tables.rows.map((r) => `--table=${r.name}`);
  steps.push(`listed ${tables.rows.length} tables`);

  const exportStep = async (name: string, extra: string[]): Promise<CopyResult | undefined> => {
    const [cmd, args] = wr([
      'd1',
      'export',
      source,
      '--remote',
      ...extra,
      `--output=${join(io.dir, name)}`,
    ]);
    const res = await io.exec(cmd, args);
    if (!res.ok) return fail(`export ${name}`, res.message ?? 'export failed');
    steps.push(`wrote ${name}`);
    return undefined;
  };

  const failed =
    (await exportStep('backup-schema.sql', ['--no-data', '--table=media_folders', ...tableArgs])) ??
    (await exportStep('backup-folders.sql', ['--no-schema', '--table=media_folders'])) ??
    (await exportStep('backup-data.sql', ['--no-schema', ...tableArgs]));
  if (failed) return failed;

  const idx = await queryRows<{ sql: string }>(io.exec, source, INDEXES_QUERY);
  if (!idx.ok) return fail('list indexes', idx.message);
  await io.writeFile(
    join(io.dir, 'backup-indexes.sql'),
    idx.rows.map((r) => `${r.sql};`).join('\n') + (idx.rows.length ? '\n' : ''),
  );
  steps.push(`wrote backup-indexes.sql (${idx.rows.length} indexes and triggers)`);

  const contents: Record<string, string> = {};
  for (const f of DUMP_FILES) contents[f] = await io.readFile(join(io.dir, f));
  const big = tooBigStatements(contents);
  if (big.length) {
    return fail(
      'size check',
      `D1 would reject ${big.length} statement(s) as SQLITE_TOOBIG (${D1_MAX_STATEMENT_BYTES} bytes or more): ` +
        `${big
          .slice(0, 5)
          .map((b) => `${b.file}:${b.line}`)
          .join(', ')}. The dump is kept, but cannot be imported into D1 as is.`,
    );
  }
  steps.push('size check passed');
  return { ok: true, steps };
}

/** Import the four files into `target` in order, after wiping it when the plan says so. */
export async function importDump(plan: CopyPlan, io: CopyIO): Promise<CopyResult> {
  const steps: string[] = [];
  if (plan.wipeTarget) {
    const master = await queryRows<MasterRow>(io.exec, plan.target, WIPE_QUERY);
    if (!master.ok) return { ok: false, step: 'list target objects', message: master.message };
    const wipe = join(io.dir, 'wipe.sql');
    await io.writeFile(wipe, `${dropStatements(master.rows).join('\n')}\n`);
    const [cmd, args] = wr(['d1', 'execute', plan.target, '--remote', `--file=${wipe}`]);
    const res = await io.exec(cmd, args);
    if (!res.ok) return { ok: false, step: 'wipe target', message: res.message ?? 'wipe failed' };
    steps.push(`dropped ${master.rows.length} objects from ${plan.target}`);
  }
  for (const f of DUMP_FILES) {
    const [cmd, args] = wr(['d1', 'execute', plan.target, '--remote', `--file=${join(io.dir, f)}`]);
    const res = await io.exec(cmd, args);
    if (!res.ok) return { ok: false, step: `import ${f}`, message: res.message ?? 'import failed' };
    steps.push(`imported ${f}`);
  }
  return { ok: true, steps };
}

/** Dump the source and import it into the target. The only way a copy happens. */
export async function copyD1(plan: CopyPlan, io: CopyIO): Promise<CopyResult> {
  const dumped = await dumpDatabase(plan.source, io);
  if (!dumped.ok) return dumped;
  const imported = await importDump(plan, io);
  if (!imported.ok) return imported;
  return { ok: true, steps: [...dumped.steps, ...imported.steps] };
}

interface WranglerLike {
  d1_databases?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

/**
 * Re-point a generated wrangler config's `DB` binding at another database, for running
 * `emdash migrate` against it. Only the binding named `DB` is touched; everything else, including
 * the worker name and routes, is left as it is, because the config is used for the migration only
 * and is never deployed. Throws when there is no `DB` binding to rewrite rather than returning a
 * config that still points at production.
 */
export function rewriteDbBinding(
  config: WranglerLike,
  databaseName: string,
  databaseId: string,
): WranglerLike {
  const dbs = config.d1_databases ?? [];
  if (!dbs.some((d) => d.binding === 'DB')) {
    throw new Error('No d1_databases entry with binding "DB" to rewrite.');
  }
  return {
    ...config,
    d1_databases: dbs.map((d) =>
      d.binding === 'DB' ? { ...d, database_name: databaseName, database_id: databaseId } : d,
    ),
  };
}
