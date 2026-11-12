/**
 * `vitops emdash db …` and `vitops emdash schema …` — moving an EmDash site's data between its
 * environments (prod, the long-lived dev site, and the throwaway database a promotion rehearses
 * on) without losing work that lives only in the target.
 *
 * Thin on purpose: the decisions are in `@getvitops/utils/hosting` (`d1-copy.ts`, `sync-dev.ts`)
 * and `@getvitops/utils/emdash-schema`, each pure and tested. This file reads wrangler.jsonc and the
 * environment, calls them, and prints. Credentials are env vars, never flags or config:
 *
 *   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID   wrangler
 *   DEV_D1_ID                                      the dev database id (`db copy --target dev`)
 *   EMDASH_TOKEN_FROM / EMDASH_TOKEN_TO / EMDASH_TOKEN   an EmDash API token per side of a schema diff
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY         optional, for copying media
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyOps,
  diffSchema,
  fetchBlockTypeSlugs,
  fetchSchema,
  formatPlan,
  formatPlanMarkdown,
  hasChanges,
  hasDrift,
  type ApiTarget,
  type SchemaExport,
} from '@getvitops/utils/emdash-schema';
import {
  changedContentSql,
  COLLECTION_TABLES_QUERY,
  copyD1,
  devDatabaseName,
  dumpDatabase,
  evaluateGuard,
  MARKER_QUERY,
  MARKER_WRITE_SQL,
  parseBindingNames,
  planD1Copy,
  realExec,
  rehearseDatabaseName,
  rewriteDbBinding,
  type CopyIO,
  type CopyResult,
} from '@getvitops/utils/hosting';
import { fail } from './shared.ts';

function flagOf(argv: string[]) {
  return (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    if (i >= 0) return argv[i + 1];
    return argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  };
}

const WRANGLER = 'wrangler.jsonc';

function names() {
  if (!existsSync(WRANGLER)) fail(`Run from the project root (no ${WRANGLER}).`);
  const n = parseBindingNames(readFileSync(WRANGLER, 'utf8'));
  if (!n.database) fail(`No D1 database_name found in ${WRANGLER}.`);
  return n as { database: string; bucket?: string };
}

async function d1Id(name: string): Promise<string | undefined> {
  const res = await realExec('npx', ['wrangler', 'd1', 'info', name, '--json']);
  if (!res.ok) return undefined;
  try {
    return (JSON.parse(res.stdout) as { uuid?: string }).uuid;
  } catch {
    return undefined;
  }
}

async function rows<T>(db: string, sql: string): Promise<T[] | undefined> {
  const res = await realExec('npx', [
    'wrangler',
    'd1',
    'execute',
    db,
    '--remote',
    '--json',
    '--command',
    sql,
  ]);
  if (!res.ok) return undefined;
  try {
    return (JSON.parse(res.stdout) as Array<{ results?: T[] }>)[0]?.results ?? [];
  } catch {
    return undefined;
  }
}

function io(dir: string): CopyIO {
  return {
    exec: realExec,
    dir,
    readFile: async (p) => readFileSync(p, 'utf8'),
    writeFile: async (p, d) => writeFileSync(p, d),
  };
}

function report(label: string, res: CopyResult): void {
  if (!res.ok) fail(`${label} failed at "${res.step}": ${res.message}`);
  for (const s of res.steps) console.log(`  ${s}`);
}

/** rclone over R2's S3 API; credentials ride rclone's env config so they never show in a process list. */
function syncMedia(bucket: string): void {
  const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, CLOUDFLARE_ACCOUNT_ID } = process.env;
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !CLOUDFLARE_ACCOUNT_ID) {
    console.log(
      `Skipped media: R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY not set, ${bucket}-dev left as is.`,
    );
    return;
  }
  const r = spawnSync('rclone', ['sync', `R2:${bucket}`, `R2:${bucket}-dev`], {
    stdio: 'inherit',
    env: {
      ...process.env,
      RCLONE_CONFIG_R2_TYPE: 's3',
      RCLONE_CONFIG_R2_PROVIDER: 'Cloudflare',
      RCLONE_CONFIG_R2_ENDPOINT: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      RCLONE_CONFIG_R2_ACCESS_KEY_ID: R2_ACCESS_KEY_ID,
      RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: R2_SECRET_ACCESS_KEY,
    },
  });
  if (r.status !== 0) fail('rclone failed to sync media.');
  console.log(`Synced ${bucket} → ${bucket}-dev.`);
}

async function target(flag: ReturnType<typeof flagOf>) {
  const { database, bucket } = names();
  const kind = flag('target');
  if (kind !== 'dev' && kind !== 'rehearse') fail('give --target dev|rehearse.');
  const prodId = await d1Id(database);
  if (kind === 'dev') {
    const name = devDatabaseName(database);
    return {
      database,
      bucket,
      kind: 'dev' as const,
      name,
      told: process.env.DEV_D1_ID,
      prodId,
      reported: await d1Id(name),
    };
  }
  const id = flag('id');
  if (!id) fail('--target rehearse needs --id <run id>.');
  let name: string;
  try {
    name = rehearseDatabaseName(database, id!);
  } catch (e) {
    return fail((e as Error).message);
  }
  const reported = await d1Id(name);
  return {
    database,
    bucket,
    kind: 'rehearse' as const,
    name,
    told: process.env.REHEARSE_D1_ID ?? reported,
    prodId,
    reported,
  };
}

async function cmdDbCopy(argv: string[]) {
  const flag = flagOf(argv);
  const t = await target(flag);
  let plan;
  try {
    plan = planD1Copy({
      source: t.database,
      targetName: t.name,
      targetId: t.told,
      targetReportedId: t.reported,
      prodId: t.prodId,
      kind: t.kind,
    });
  } catch (e) {
    return fail((e as Error).message);
  }
  console.log(
    `OK to copy ${plan.source} → ${plan.target}${plan.wipeTarget ? ' (target is wiped first)' : ''}.`,
  );
  if (argv.includes('--dry')) {
    console.log('--dry: nothing written.');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'vitops-d1-copy-'));
  report('copy', await copyD1(plan, io(dir)));
  if (t.kind === 'dev' && t.bucket) syncMedia(t.bucket);
}

/** Dump a database to a directory — taken before any reset, so a forced sync is recoverable. */
async function cmdDbSnapshot(argv: string[]) {
  const flag = flagOf(argv);
  const out = flag('out');
  if (!out) fail('give --out <directory>.');
  const { database } = names();
  const which = flag('target') ?? 'dev';
  if (which !== 'dev' && which !== 'prod') fail('--target must be dev or prod for a snapshot.');
  const db = which === 'dev' ? devDatabaseName(database) : database;
  mkdirSync(out!, { recursive: true });
  console.log(`Snapshot ${db} → ${out}`);
  report('snapshot', await dumpDatabase(db, io(out!)));
}

/** Whether a sync may overwrite dev. Exits non-zero, writing nothing, when it may not. */
async function cmdDbGuardDev(argv: string[]) {
  const { database } = names();
  const dev = devDatabaseName(database);
  const marker = (await rows<{ marker: string | null }>(dev, MARKER_QUERY))?.[0]?.marker ?? null;
  let changed: Array<{ collection: string; n: number }> = [];
  if (marker) {
    const tables = (await rows<{ name: string }>(dev, COLLECTION_TABLES_QUERY)) ?? [];
    if (tables.length) {
      changed =
        (await rows<{ collection: string; n: number }>(
          dev,
          changedContentSql(
            tables.map((x) => x.name),
            marker,
          ),
        )) ?? [];
    }
  }
  const decision = evaluateGuard({ marker, changed, force: argv.includes('--force') });
  if (!decision.allow) fail(decision.reason);
  console.log(decision.note ?? 'Dev content is unchanged since the last sync.');
}

async function cmdDbMarkSynced() {
  const { database } = names();
  const dev = devDatabaseName(database);
  const file = join(mkdtempSync(join(tmpdir(), 'vitops-marker-')), 'marker.sql');
  writeFileSync(file, `${MARKER_WRITE_SQL}\n`);
  const res = await realExec('npx', [
    'wrangler',
    'd1',
    'execute',
    dev,
    '--remote',
    `--file=${file}`,
  ]);
  if (!res.ok) fail(`could not write the sync marker: ${res.message}`);
  console.log(`Marked ${dev} as synced.`);
}

/** Create or delete the throwaway database a promotion rehearses on. Delete only matches that exact name. */
async function cmdDbRehearsal(argv: string[]) {
  const [action, ...rest] = argv;
  const flag = flagOf(rest);
  const id = flag('id');
  if (!id) fail('give --id <run id>.');
  const { database } = names();
  let name: string;
  try {
    name = rehearseDatabaseName(database, id!);
  } catch (e) {
    return fail((e as Error).message);
  }
  if (action === 'create') {
    const res = await realExec('npx', ['wrangler', 'd1', 'create', name]);
    if (!res.ok) fail(`could not create ${name}: ${res.message}`);
    const uuid = await d1Id(name);
    if (!uuid) fail(`created ${name} but could not read its id.`);
    console.log(uuid);
    return;
  }
  if (action === 'drop') {
    // `name` is built by rehearseDatabaseName, so it can only ever be <db>-rehearse-<digits>.
    const res = await realExec('npx', ['wrangler', 'd1', 'delete', name, '--skip-confirmation']);
    if (!res.ok) fail(`could not delete ${name}: ${res.message}`);
    console.log(`Deleted ${name}.`);
    return;
  }
  fail('usage: vitops emdash db rehearsal create|drop --id <run id>');
}

/** Write a wrangler config whose DB binding points at another database, for `emdash migrate`. */
async function cmdDbRewriteConfig(argv: string[]) {
  const flag = flagOf(argv);
  const input = flag('in') ?? 'dist/server/wrangler.json';
  const out = flag('out');
  const id = flag('id');
  if (!out || !id) fail('give --id <run id> and --out <file>.');
  if (!existsSync(input)) fail(`${input} does not exist. Run the build first.`);
  const { database } = names();
  const name = rehearseDatabaseName(database, id!);
  const uuid = await d1Id(name);
  if (!uuid) fail(`${name} was not found.`);
  try {
    const cfg = rewriteDbBinding(JSON.parse(readFileSync(input, 'utf8')), name, uuid!);
    writeFileSync(out!, `${JSON.stringify(cfg, null, 2)}\n`);
  } catch (e) {
    return fail((e as Error).message);
  }
  console.log(`Wrote ${out} (DB → ${name}).`);
}

export async function cmdEmdashDb(argv: string[]) {
  const [sub, ...rest] = argv;
  switch (sub) {
    case 'copy':
      return cmdDbCopy(rest);
    case 'snapshot':
      return cmdDbSnapshot(rest);
    case 'guard-dev':
      return cmdDbGuardDev(rest);
    case 'mark-synced':
      return cmdDbMarkSynced();
    case 'rehearsal':
      return cmdDbRehearsal(rest);
    case 'rewrite-config':
      return cmdDbRewriteConfig(rest);
    default:
      fail(
        `unknown "emdash db" subcommand "${sub ?? ''}" (expected: copy | snapshot | guard-dev | mark-synced | rehearsal | rewrite-config).`,
      );
  }
}

// ── schema ───────────────────────────────────────────────────────────────────

const isUrl = (s: string) => /^https?:\/\//i.test(s);

function token(side: 'FROM' | 'TO'): string {
  return process.env[`EMDASH_TOKEN_${side}`] ?? process.env.EMDASH_TOKEN ?? '';
}

/** A schema source is a site URL (fetched with a token) or a saved export file. */
async function load(
  spec: string,
  side: 'FROM' | 'TO',
): Promise<{ schema: SchemaExport; blockTypes?: string[] }> {
  if (!isUrl(spec)) {
    if (!existsSync(spec)) fail(`${spec} does not exist.`);
    const parsed = JSON.parse(readFileSync(spec, 'utf8')) as SchemaExport & {
      blockTypes?: string[];
    };
    return { schema: parsed, ...(parsed.blockTypes ? { blockTypes: parsed.blockTypes } : {}) };
  }
  const t: ApiTarget = { baseUrl: spec, token: token(side) };
  const got = await fetchSchema(t);
  if (!got.ok) return fail(got.message);
  const bt = await fetchBlockTypeSlugs(t);
  return { schema: got.value, ...(bt.ok ? { blockTypes: bt.value } : {}) };
}

async function cmdSchemaExport(argv: string[]) {
  const flag = flagOf(argv);
  const url = flag('url');
  const out = flag('out');
  if (!url || !out) fail('give --url <site> and --out <file>.');
  const t: ApiTarget = { baseUrl: url!, token: process.env.EMDASH_TOKEN ?? '' };
  const got = await fetchSchema(t);
  if (!got.ok) return fail(got.message);
  const bt = await fetchBlockTypeSlugs(t);
  writeFileSync(
    out!,
    `${JSON.stringify({ ...got.value, ...(bt.ok ? { blockTypes: bt.value } : {}) }, null, 2)}\n`,
  );
  console.log(
    `Saved the schema of ${url} to ${out} (${got.value.collections.length} collections).`,
  );
}

async function cmdSchemaDiffOrApply(mode: 'diff' | 'apply', argv: string[]) {
  const flag = flagOf(argv);
  const from = flag('from');
  const to = flag('to');
  if (!from || !to) fail('give --from <site URL or saved export> and --to <site URL>.');
  if (mode === 'apply' && !isUrl(to!)) fail('--to must be a site URL when applying.');

  const [a, b] = [await load(from!, 'FROM'), await load(to!, 'TO')];
  const plan = diffSchema(a.schema, b.schema, {
    ...(a.blockTypes ? { fromBlockTypes: a.blockTypes } : {}),
    ...(b.blockTypes ? { toBlockTypes: b.blockTypes } : {}),
  });

  if (argv.includes('--json')) console.log(JSON.stringify(plan, null, 2));
  else if (argv.includes('--markdown')) console.log(formatPlanMarkdown(plan));
  else console.log(formatPlan(plan));

  if (mode === 'diff') {
    if (argv.includes('--check') && hasDrift(plan)) process.exit(1);
    return;
  }
  if (!hasChanges(plan)) return;
  if (argv.includes('--dry')) {
    console.log('\n--dry: nothing applied.');
    return;
  }
  const results = await applyOps({ baseUrl: to!, token: token('TO') }, plan.apply);
  const failed = results.find((r) => !r.ok);
  console.log(`\nApplied ${results.filter((r) => r.ok).length} of ${plan.apply.length}.`);
  if (failed) {
    fail(
      `stopped at a failed step: ${failed.message}. Nothing after it was applied; re-run to re-diff and continue.`,
    );
  }
}

export async function cmdEmdashSchema(argv: string[]) {
  const [sub, ...rest] = argv;
  switch (sub) {
    case 'diff':
    case 'apply':
      return cmdSchemaDiffOrApply(sub, rest);
    case 'export':
      return cmdSchemaExport(rest);
    default:
      fail(`unknown "emdash schema" subcommand "${sub ?? ''}" (expected: diff | apply | export).`);
  }
}
