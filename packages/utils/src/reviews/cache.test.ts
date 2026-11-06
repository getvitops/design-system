import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { readCache, toCache, writeCache } from './cache.ts';
import type { LocationReviews } from './types.ts';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'vitops-reviews-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const loc = (id: string): LocationReviews => ({
  locationId: id,
  accountId: 'accounts/1',
  fetchedAt: '2026-08-26T00:00:00Z',
  reviews: [
    { id: 'b', location: 'ottawa', rating: 5, author: 'B', publishedAt: '', updatedAt: '' },
    { id: 'a', location: 'ottawa', rating: 4, author: 'A', publishedAt: '', updatedAt: '' },
  ],
});

describe('readCache', () => {
  it('reads an absent file as undefined', () => {
    expect(readCache(join(dir, 'nope.json'))).toBeUndefined();
  });

  it('reads corrupt JSON as absent, not empty', () => {
    const path = join(dir, 'reviews.json');
    writeFileSync(path, '{not json');
    expect(readCache(path)).toBeUndefined();
  });

  it('reads a wrong-version file as absent', () => {
    const path = join(dir, 'reviews.json');
    writeFileSync(path, JSON.stringify({ version: 2, locations: {} }));
    expect(readCache(path)).toBeUndefined();
  });

  it('round-trips a written cache', () => {
    const path = join(dir, 'reviews.json');
    writeCache(path, toCache({ ottawa: loc('locations/2') }));
    expect(readCache(path)?.locations.ottawa?.locationId).toBe('locations/2');
  });
});

describe('toCache', () => {
  it('sorts location keys and review ids for a stable diff', () => {
    const cache = toCache({ toronto: loc('t'), ottawa: loc('o') });
    expect(Object.keys(cache.locations)).toEqual(['ottawa', 'toronto']);
    expect(cache.locations.ottawa?.reviews.map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('writeCache', () => {
  it('creates the parent directory', () => {
    const path = join(dir, 'nested', 'reviews.json');
    writeCache(path, toCache({ ottawa: loc('o') }));
    expect(existsSync(path)).toBe(true);
  });

  it('ends the file with a trailing newline', () => {
    const path = join(dir, 'reviews.json');
    writeCache(path, toCache({ ottawa: loc('o') }));
    expect(readFileSync(path, 'utf8').endsWith('\n')).toBe(true);
  });
});
