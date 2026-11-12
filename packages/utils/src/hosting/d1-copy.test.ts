import { describe, expect, it } from 'vite-plus/test';
import {
  assertSafeTarget,
  copyD1,
  D1_MAX_STATEMENT_BYTES,
  DUMP_FILES,
  dropStatements,
  parseBindingNames,
  planD1Copy,
  rehearseDatabaseName,
  rewriteDbBinding,
  tooBigStatements,
  type CopyIO,
} from './d1-copy.ts';
import type { ExecImpl } from './wrangler.ts';

const safe = {
  targetName: 'site-dev',
  targetId: 'dev-id',
  targetReportedId: 'dev-id',
  prodId: 'prod-id',
  kind: 'dev' as const,
};

describe('assertSafeTarget', () => {
  it('accepts a matching -dev database', () => {
    expect(() => assertSafeTarget(safe)).not.toThrow();
  });
  it('accepts a rehearse database with a numeric run id', () => {
    expect(() =>
      assertSafeTarget({ ...safe, targetName: 'site-rehearse-4821', kind: 'rehearse' }),
    ).not.toThrow();
  });
  it("refuses production's id even when the name looks right", () => {
    expect(() =>
      assertSafeTarget({ ...safe, targetId: 'prod-id', targetReportedId: 'prod-id' }),
    ).toThrow(/production id/);
  });
  it('refuses a name that is neither -dev nor -rehearse-<digits>', () => {
    expect(() => assertSafeTarget({ ...safe, targetName: 'site' })).toThrow(/not a -dev/);
    expect(() =>
      assertSafeTarget({ ...safe, targetName: 'site-rehearse-abc', kind: 'rehearse' }),
    ).toThrow(/rehearse/);
  });
  it('does not let a dev name satisfy the rehearse kind, or the reverse', () => {
    expect(() => assertSafeTarget({ ...safe, kind: 'rehearse' })).toThrow();
    expect(() =>
      assertSafeTarget({ ...safe, targetName: 'site-rehearse-1', kind: 'dev' }),
    ).toThrow();
  });
  it('refuses when the told id and the reported id disagree', () => {
    expect(() => assertSafeTarget({ ...safe, targetReportedId: 'other' })).toThrow(/stale/);
  });
  it('refuses a missing target id or an unresolved production id', () => {
    expect(() => assertSafeTarget({ ...safe, targetId: undefined })).toThrow(/not set/);
    expect(() => assertSafeTarget({ ...safe, prodId: undefined })).toThrow(/production/);
  });
});

describe('names', () => {
  it('rehearse names carry a numeric run id only', () => {
    expect(rehearseDatabaseName('site', '77')).toBe('site-rehearse-77');
    expect(() => rehearseDatabaseName('site', '7;rm')).toThrow(/digits/);
  });
  it('reads database and bucket names, ignoring commented examples', () => {
    const src = `{
      // "database_name": "commented"
      "d1_databases": [{ "database_name": "real-db" }],
      "r2_buckets": [{ "bucket_name": "real-bucket" }]
    }`;
    expect(parseBindingNames(src)).toEqual({ database: 'real-db', bucket: 'real-bucket' });
    expect(parseBindingNames('{}')).toEqual({});
  });
});

describe('dropStatements', () => {
  it('drops virtual tables but not their shadow tables, views first', () => {
    const sql = dropStatements([
      { name: 'v', type: 'view' },
      { name: 'fts', type: 'table', sql: 'CREATE VIRTUAL TABLE fts USING fts5(a)' },
      { name: 'fts_data', type: 'table', sql: 'CREATE TABLE fts_data(x)' },
      { name: 'posts', type: 'table', sql: 'CREATE TABLE posts(x)' },
    ]);
    expect(sql[0]).toMatch(/defer_foreign_keys/);
    expect(sql.indexOf('DROP VIEW IF EXISTS "v";')).toBeLessThan(
      sql.indexOf('DROP TABLE IF EXISTS "fts";'),
    );
    expect(sql).toContain('DROP TABLE IF EXISTS "posts";');
    expect(sql.join('\n')).not.toContain('fts_data');
  });
  it('quotes identifiers', () => {
    expect(dropStatements([{ name: 'a"b', type: 'table', sql: 'CREATE TABLE x' }])).toContain(
      'DROP TABLE IF EXISTS "a""b";',
    );
  });
});

describe('tooBigStatements', () => {
  it('flags a statement at or over the limit, counting bytes not characters', () => {
    const big = 'x'.repeat(D1_MAX_STATEMENT_BYTES);
    const multibyte = 'é'.repeat(D1_MAX_STATEMENT_BYTES / 2); // 2 bytes each
    const out = tooBigStatements({ 'a.sql': `ok\n${big}`, 'b.sql': multibyte, 'c.sql': 'small' });
    expect(out).toEqual([
      { file: 'a.sql', line: 2 },
      { file: 'b.sql', line: 1 },
    ]);
  });
});

describe('planD1Copy', () => {
  it('wipes a dev target and not a fresh rehearse one', () => {
    expect(planD1Copy({ ...safe, source: 'site' }).wipeTarget).toBe(true);
    expect(
      planD1Copy({
        ...safe,
        targetName: 'site-rehearse-9',
        kind: 'rehearse',
        source: 'site',
      }).wipeTarget,
    ).toBe(false);
  });
  it('throws before planning anything unsafe', () => {
    expect(() =>
      planD1Copy({ ...safe, targetId: 'prod-id', targetReportedId: 'prod-id', source: 'site' }),
    ).toThrow();
  });
});

function fakeIO(
  over: Partial<{ failOn: string; dataFile: string }> = {},
): CopyIO & { calls: string[] } {
  const calls: string[] = [];
  const files = new Map<string, string>();
  const exec: ExecImpl = async (_cmd, args) => {
    const line = args.join(' ');
    calls.push(line);
    if (over.failOn && line.includes(over.failOn))
      return { ok: false, stdout: '', message: 'boom' };
    if (line.includes('--command')) {
      const rows = line.includes('SELECT name FROM')
        ? [{ name: 'entries' }, { name: 'users' }]
        : line.includes('SELECT sql FROM')
          ? [{ sql: 'CREATE INDEX i ON entries(x)' }]
          : [{ name: 'entries', type: 'table', sql: 'CREATE TABLE entries(x)' }];
      return { ok: true, stdout: JSON.stringify([{ results: rows }]) };
    }
    const out = /--output=(\S+)/.exec(line)?.[1];
    if (out) files.set(out, out.endsWith('data.sql') ? (over.dataFile ?? 'INSERT 1;') : '-- x');
    return { ok: true, stdout: '' };
  };
  return {
    exec,
    dir: '/tmp/d',
    calls,
    readFile: async (p) => files.get(p) ?? '',
    writeFile: async (p, d) => void files.set(p, d),
  };
}

describe('copyD1', () => {
  const plan = planD1Copy({ ...safe, source: 'site' });

  it('imports the four files in order, after the wipe, indexes last', async () => {
    const io = fakeIO();
    const res = await copyD1(plan, io);
    expect(res.ok).toBe(true);
    const imports = io.calls.filter(
      (c) => c.includes('d1 execute site-dev') && c.includes('--file'),
    );
    expect(imports.map((c) => /([^/]+\.sql)$/.exec(c)?.[1])).toEqual(['wipe.sql', ...DUMP_FILES]);
    expect(DUMP_FILES.at(-1)).toBe('backup-indexes.sql');
  });
  it('excludes the search index and exports media_folders separately', async () => {
    const io = fakeIO();
    await copyD1(plan, io);
    const schema = io.calls.find((c) => c.includes('backup-schema.sql'))!;
    expect(schema).toContain('--no-data');
    expect(schema).toContain('--table=media_folders');
    expect(schema).toContain('--table=entries');
    expect(io.calls.some((c) => c.includes("NOT GLOB '_emdash_fts_*'"))).toBe(true);
  });
  it('stops, and writes nothing to the target, when a row is too big', async () => {
    const io = fakeIO({ dataFile: `INSERT ${'x'.repeat(D1_MAX_STATEMENT_BYTES)};` });
    const res = await copyD1(plan, io);
    expect(res).toMatchObject({ ok: false, step: 'size check' });
    expect(io.calls.some((c) => c.includes('d1 execute site-dev'))).toBe(false);
  });
  it('names the failing step', async () => {
    const res = await copyD1(plan, fakeIO({ failOn: 'backup-data.sql' }));
    expect(res).toMatchObject({ ok: false, step: 'export backup-data.sql' });
  });
  it('does not wipe a rehearse target', async () => {
    const io = fakeIO();
    const rehearse = planD1Copy({
      ...safe,
      targetName: 'site-rehearse-5',
      kind: 'rehearse',
      source: 'site',
    });
    await copyD1(rehearse, io);
    expect(io.calls.some((c) => c.includes('wipe.sql'))).toBe(false);
  });
});

describe('rewriteDbBinding', () => {
  it('re-points only the DB binding', () => {
    const out = rewriteDbBinding(
      {
        name: 'w',
        d1_databases: [
          { binding: 'DB', database_name: 'prod', database_id: 'p' },
          { binding: 'OTHER', database_name: 'x', database_id: 'x' },
        ],
      },
      'site-rehearse-1',
      'r-id',
    );
    expect(out.d1_databases).toEqual([
      { binding: 'DB', database_name: 'site-rehearse-1', database_id: 'r-id' },
      { binding: 'OTHER', database_name: 'x', database_id: 'x' },
    ]);
    expect(out.name).toBe('w');
  });
  it('throws rather than return a config that still points at production', () => {
    expect(() => rewriteDbBinding({ d1_databases: [] }, 'a', 'b')).toThrow(/binding "DB"/);
    expect(() => rewriteDbBinding({}, 'a', 'b')).toThrow();
  });
});
