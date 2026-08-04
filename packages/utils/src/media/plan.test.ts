import { describe, expect, it } from 'vitest';
import { formatPlan, pendingJobs, planMedia, resolveConfig, settingsHash } from './plan.ts';
import type { MediaManifest, MediaSource } from './types.ts';

const source = (id: string, hash = 'aaaa'): MediaSource => ({ path: `/raw/${id}`, id, hash });

/** A manifest recording `id` as encoded, under the settings `planMedia` will derive. */
const manifest = (
  id: string,
  hash: string,
  settings: string,
  outputs = [
    `${id.replace(/\.\w+$/, '')}.webm`,
    `${id.replace(/\.\w+$/, '')}.mp4`,
    `${id.replace(/\.\w+$/, '')}.jpg`,
  ],
): MediaManifest => ({ version: 1, entries: { [id]: { source: hash, settings, outputs } } });

const defaultSettings = settingsHash(resolveConfig());
const allPresent = () => true;

describe('output naming', () => {
  it('derives one output per kind from the source stem', () => {
    const plan = planMedia({ sources: [source('hero.mp4')] });
    expect(plan.jobs[0]?.outputs.map((o) => o.file)).toEqual(['hero.webm', 'hero.mp4', 'hero.jpg']);
  });

  it('preserves subdirectories', () => {
    const plan = planMedia({ sources: [source('services/intro.mov')] });
    expect(plan.jobs[0]?.outputs.map((o) => o.file)).toEqual([
      'services/intro.webm',
      'services/intro.mp4',
      'services/intro.jpg',
    ]);
  });

  it('honours a narrowed output set', () => {
    const plan = planMedia({ sources: [source('hero.mp4')], config: { outputs: ['webm'] } });
    expect(plan.jobs[0]?.outputs.map((o) => o.file)).toEqual(['hero.webm']);
  });

  // Two sources with the same stem silently overwrite each other's outputs every
  // run, each invalidating the other's cache entry — so the build never settles
  // and nothing about it looks wrong from the outside.
  it('throws when two sources claim one output', () => {
    expect(() => planMedia({ sources: [source('hero.mp4'), source('hero.mov')] })).toThrow(
      /both produce "hero.webm"/,
    );
  });
});

describe('the cache', () => {
  it('skips a source whose hash, settings and outputs all still match', () => {
    const plan = planMedia({
      sources: [source('hero.mp4', 'h1')],
      previous: manifest('hero.mp4', 'h1', defaultSettings),
      probe: allPresent,
    });
    expect(plan.jobs[0]?.skip).toBe('unchanged');
    expect(pendingJobs(plan)).toHaveLength(0);
  });

  it('re-encodes when the source contents changed', () => {
    const plan = planMedia({
      sources: [source('hero.mp4', 'h2')],
      previous: manifest('hero.mp4', 'h1', defaultSettings),
      probe: allPresent,
    });
    expect(plan.jobs[0]?.skip).toBeUndefined();
  });

  it('re-encodes when a setting changed', () => {
    const plan = planMedia({
      sources: [source('hero.mp4', 'h1')],
      config: { crf: 40 },
      previous: manifest('hero.mp4', 'h1', defaultSettings),
      probe: allPresent,
    });
    expect(plan.jobs[0]?.skip).toBeUndefined();
  });

  // The manifest can outlive the outputs — a cleaned dist, a partial checkout, a
  // deleted file. Trusting it alone would leave the page referencing a video that
  // no rebuild ever writes.
  it('re-encodes when an output is missing, even on a full cache hit', () => {
    const plan = planMedia({
      sources: [source('hero.mp4', 'h1')],
      previous: manifest('hero.mp4', 'h1', defaultSettings),
      probe: (file) => file !== 'hero.jpg',
    });
    expect(plan.jobs[0]?.skip).toBeUndefined();
  });

  it('encodes everything with no manifest, and says so', () => {
    const plan = planMedia({ sources: [source('hero.mp4')], probe: allPresent });
    expect(plan.jobs[0]?.skip).toBeUndefined();
    expect(plan.notes.join(' ')).toMatch(/no manifest/);
  });

  it('re-encodes a cache hit under --force', () => {
    const plan = planMedia({
      sources: [source('hero.mp4', 'h1')],
      previous: manifest('hero.mp4', 'h1', defaultSettings),
      probe: allPresent,
      force: true,
    });
    expect(plan.jobs[0]?.skip).toBeUndefined();
    expect(plan.notes.join(' ')).toMatch(/--force/);
  });

  it('ignores a manifest entry for a different source', () => {
    const plan = planMedia({
      sources: [source('hero.mp4', 'h1')],
      previous: manifest('other.mp4', 'h1', defaultSettings),
      probe: allPresent,
    });
    expect(plan.jobs[0]?.skip).toBeUndefined();
  });
});

describe('settings hash', () => {
  it('is stable across a re-ordered output list', () => {
    expect(settingsHash(resolveConfig({ outputs: ['mp4', 'webm'] }))).toBe(
      settingsHash(resolveConfig({ outputs: ['webm', 'mp4'] })),
    );
  });

  it('changes with every setting that changes the bytes', () => {
    const base = settingsHash(resolveConfig());
    for (const config of [
      { crf: 40 },
      { maxWidth: 1280 },
      { maxBitrate: '2M' },
      { audio: true },
      { posterTime: 3 },
      { outputs: ['webm' as const] },
    ])
      expect(settingsHash(resolveConfig(config))).not.toBe(base);
  });

  it('treats an explicit default as the default', () => {
    expect(settingsHash(resolveConfig({ crf: 32, maxWidth: 1920 }))).toBe(
      settingsHash(resolveConfig()),
    );
  });
});

describe('reporting', () => {
  it('reports an empty raw directory rather than silently doing nothing', () => {
    const plan = planMedia({ sources: [] });
    expect(plan.jobs).toHaveLength(0);
    expect(plan.notes.join(' ')).toMatch(/no video files found/);
  });

  it('names each source it will encode', () => {
    const out = formatPlan(
      planMedia({
        sources: [source('hero.mp4', 'h1'), source('intro.mov', 'h2')],
        previous: manifest('hero.mp4', 'h1', defaultSettings),
        probe: allPresent,
      }),
    );
    expect(out).toMatch(/encode: {2}1/);
    expect(out).toMatch(/skipped: 1/);
    expect(out).toMatch(/intro\.mov → intro\.webm, intro\.mp4, intro\.jpg/);
    expect(out).not.toMatch(/• hero\.mp4/);
  });
});
