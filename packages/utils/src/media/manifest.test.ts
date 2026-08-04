import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readManifest, toManifest, writeManifest } from './manifest.ts';

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'vitops-media-manifest-'));
  path = join(dir, '.vitops/media-manifest.json');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const entry = (outputs: string[]) => ({ source: 'aaaa', settings: 'bbbb', outputs });

describe('readManifest', () => {
  // Every one of these reads as absent, which re-encodes. The opposite reading —
  // "valid but empty" — would encode nothing and leave the build referencing
  // outputs that were never written.
  it('returns undefined when the file is missing', () => {
    expect(readManifest(path)).toBeUndefined();
  });

  it('returns undefined for unparseable JSON', () => {
    writeManifest(path, toManifest({}));
    writeFileSync(path, '{ not json');
    expect(readManifest(path)).toBeUndefined();
  });

  it('returns undefined for a future version', () => {
    writeManifest(path, toManifest({}));
    writeFileSync(path, JSON.stringify({ version: 2, entries: {} }));
    expect(readManifest(path)).toBeUndefined();
  });

  it('round-trips a manifest it wrote', () => {
    writeManifest(path, toManifest({ 'hero.mp4': entry(['hero.webm']) }));
    expect(readManifest(path)?.entries['hero.mp4']?.outputs).toEqual(['hero.webm']);
  });
});

describe('determinism', () => {
  // The manifest is committed alongside the outputs, so an unchanged run must
  // produce identical bytes — otherwise every build is a diff.
  it('sorts keys and outputs, so insertion order cannot leak into the file', () => {
    writeManifest(
      path,
      toManifest({ 'b.mp4': entry(['b.mp4', 'b.webm']), 'a.mp4': entry(['a.webm']) }),
    );
    const first = readFileSync(path, 'utf8');
    writeManifest(
      path,
      toManifest({ 'a.mp4': entry(['a.webm']), 'b.mp4': entry(['b.webm', 'b.mp4']) }),
    );
    expect(readFileSync(path, 'utf8')).toBe(first);
    expect(Object.keys(readManifest(path)?.entries ?? {})).toEqual(['a.mp4', 'b.mp4']);
  });

  it('carries no timestamp', () => {
    writeManifest(path, toManifest({ 'hero.mp4': entry(['hero.webm']) }));
    expect(readFileSync(path, 'utf8')).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
