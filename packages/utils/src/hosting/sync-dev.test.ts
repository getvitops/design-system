import { describe, expect, it } from 'vite-plus/test';
import { changedContentSql, evaluateGuard, MARKER_WRITE_SQL } from './sync-dev.ts';

describe('changedContentSql', () => {
  it('unions one count per collection table, with the table name quoted', () => {
    const sql = changedContentSql(['ec_posts', 'ec_pages'], '2026-11-01T00:00:00.000Z');
    expect(sql).toContain(`'posts' AS collection`);
    expect(sql).toContain('FROM "ec_pages" WHERE updated_at > \'2026-11-01T00:00:00.000Z\'');
    expect(sql.split('UNION ALL')).toHaveLength(2);
  });
  it('never lets a hostile marker reach the SQL', () => {
    expect(() => changedContentSql(['ec_posts'], "x' OR 1=1 --")).toThrow(/marker/);
  });
  it('escapes a quote in a table name', () => {
    expect(changedContentSql(['ec_a"b'], '2026-01-01T00:00:00Z')).toContain('"ec_a""b"');
  });
});

describe('evaluateGuard', () => {
  const m = '2026-11-01T00:00:00.000Z';
  it('allows when nothing changed since the marker', () => {
    expect(
      evaluateGuard({ marker: m, changed: [{ collection: 'posts', n: 0 }], force: false }),
    ).toEqual({
      allow: true,
    });
  });
  it('refuses and names each edited collection', () => {
    const d = evaluateGuard({
      marker: m,
      changed: [
        { collection: 'posts', n: 3 },
        { collection: 'pages', n: 0 },
        { collection: 'faq', n: 1 },
      ],
      force: false,
    });
    expect(d.allow).toBe(false);
    expect(d.allow === false && d.reason).toContain('posts (3), faq (1)');
    expect(d.allow === false && d.reason).not.toContain('pages');
  });
  it('refuses a dev with no marker, because it cannot tell work in progress from a copy', () => {
    const d = evaluateGuard({ marker: null, changed: [], force: false });
    expect(d.allow).toBe(false);
    expect(d.allow === false && d.reason).toContain('--force');
  });
  it('force overrides both refusals', () => {
    expect(evaluateGuard({ marker: null, changed: [], force: true }).allow).toBe(true);
    expect(
      evaluateGuard({ marker: m, changed: [{ collection: 'posts', n: 9 }], force: true }).allow,
    ).toBe(true);
  });
});

describe('marker write', () => {
  it('creates the table if needed, replaces the row, stamps ISO time', () => {
    expect(MARKER_WRITE_SQL).toContain('CREATE TABLE IF NOT EXISTS _vitops_sync');
    expect(MARKER_WRITE_SQL).toContain('DELETE FROM _vitops_sync');
    expect(MARKER_WRITE_SQL).toContain("'%Y-%m-%dT%H:%M:%fZ'");
  });
});
