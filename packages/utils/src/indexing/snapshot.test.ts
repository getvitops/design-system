import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSnapshot, toSnapshot, writeSnapshot } from './snapshot.ts';

const tmp = () => mkdtempSync(join(tmpdir(), 'vitops-indexing-'));

describe('toSnapshot', () => {
  it('records an absent lastmod as an empty string, not a missing key', () => {
    // The diff compares `before !== (lastmod ?? '')`. If an absent lastmod were a
    // missing key, `before === undefined` would read as "new URL" and resubmit
    // every lastmod-less page on every run.
    const s = toSnapshot('https://a.ca/s.xml', [{ loc: 'https://a.ca/' }], '2026-08-01T00:00:00Z');
    expect(s.entries).toEqual({ 'https://a.ca/': '' });
    expect(Object.hasOwn(s.entries, 'https://a.ca/')).toBe(true);
  });
});

describe('readSnapshot', () => {
  it('round-trips through writeSnapshot, creating the directory', () => {
    const path = join(tmp(), 'nested', 'snapshot.json');
    const s = toSnapshot(
      'https://a.ca/s.xml',
      [{ loc: 'https://a.ca/', lastmod: 'x' }],
      '2026-08-01T00:00:00Z',
    );
    writeSnapshot(path, s);
    expect(readSnapshot(path)).toEqual(s);
  });

  it('returns undefined when the file is absent', () => {
    expect(readSnapshot(join(tmp(), 'nope.json'))).toBeUndefined();
  });

  /*
   * Corrupt reads as absent, deliberately. "Absent" submits everything; an empty
   * entry map would look like a site with no URLs and submit nothing — succeeding
   * silently while doing nothing, which is the failure this command exists to
   * remove.
   */
  it('returns undefined for malformed JSON', () => {
    const path = join(tmp(), 'bad.json');
    writeFileSync(path, '{ not json');
    expect(readSnapshot(path)).toBeUndefined();
  });

  it('returns undefined for a future/unknown version', () => {
    const path = join(tmp(), 'v2.json');
    writeFileSync(path, JSON.stringify({ version: 2, entries: {} }));
    expect(readSnapshot(path)).toBeUndefined();
  });

  it('returns undefined when entries is missing or not an object', () => {
    const dir = tmp();
    for (const [name, body] of [
      ['a.json', JSON.stringify({ version: 1 })],
      ['b.json', JSON.stringify({ version: 1, entries: null })],
      ['c.json', JSON.stringify({ version: 1, entries: 'nope' })],
    ] as const) {
      const path = join(dir, name);
      writeFileSync(path, body);
      expect(readSnapshot(path)).toBeUndefined();
    }
  });
});
