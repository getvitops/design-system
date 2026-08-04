/**
 * The one test that runs the real encoder.
 *
 * Everything decidable — what re-encodes, what the manifest means, what the
 * outputs are called — is asserted in `plan.test.ts` and `manifest.test.ts` with
 * no ffmpeg involved. This covers only what those cannot: that the arguments we
 * build are ones ffmpeg accepts, and that a second run over untouched sources
 * does nothing.
 *
 * Skipped rather than failed when ffmpeg is absent — it is an external tool, and
 * a contributor without it should still get a green suite.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { processMedia } from './index.ts';

const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const fixture = mkdtempSync(join(tmpdir(), `vitops-media-${process.pid}-`));
const raw = join(fixture, 'raw');
const out = join(fixture, 'processed');
const manifest = join(fixture, '.vitops/media-manifest.json');

afterAll(() => rmSync(fixture, { recursive: true, force: true }));

/** A one-second synthetic clip — no fixture binary to check in. */
function makeClip(path: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=1:size=320x240:rate=10',
      '-pix_fmt',
      'yuv420p',
      path,
    ],
    { stdio: 'ignore' },
  );
}

describe.skipIf(!hasFfmpeg)('processMedia', () => {
  it('encodes each source once, then skips it', async () => {
    makeClip(join(raw, 'hero.mp4'));
    makeClip(join(raw, 'clips/intro.mp4'));

    const first = await processMedia({
      raw,
      out,
      manifest,
      config: { maxWidth: 160, crf: 50 },
    });

    expect(first.skipped).toBe(0);
    expect(first.written.sort()).toEqual([
      'clips/intro.jpg',
      'clips/intro.mp4',
      'clips/intro.webm',
      'hero.jpg',
      'hero.mp4',
      'hero.webm',
    ]);
    for (const file of first.written) expect(statSync(join(out, file)).size).toBeGreaterThan(0);

    const second = await processMedia({ raw, out, manifest, config: { maxWidth: 160, crf: 50 } });
    expect(second.skipped).toBe(2);
    expect(second.written).toEqual([]);
  }, 120_000);

  it('re-encodes when a setting changes', async () => {
    const changed = await processMedia({ raw, out, manifest, config: { maxWidth: 160, crf: 55 } });
    expect(changed.skipped).toBe(0);
    expect(changed.written).toHaveLength(6);
  }, 120_000);

  it('re-encodes when an output is deleted, and leaves untouched outputs alone', async () => {
    const config = { maxWidth: 160, crf: 55 };
    const survivor = join(out, 'hero.webm');
    const before = statSync(survivor).mtimeMs;
    // Backdate it: an up-to-date output must not be rewritten, or a repository
    // that commits these files goes dirty on every build.
    utimesSync(survivor, new Date(0), new Date(0));

    rmSync(join(out, 'clips/intro.jpg'));
    const result = await processMedia({ raw, out, manifest, config });

    expect(result.skipped).toBe(1);
    expect(result.written.sort()).toEqual([
      'clips/intro.jpg',
      'clips/intro.mp4',
      'clips/intro.webm',
    ]);
    expect(statSync(survivor).mtimeMs).toBeLessThan(before);
  }, 120_000);

  it('prunes a deleted source from the manifest', async () => {
    rmSync(join(raw, 'clips'), { recursive: true });
    await processMedia({ raw, out, manifest, config: { maxWidth: 160, crf: 55 } });
    const { readManifest } = await import('./manifest.ts');
    expect(Object.keys(readManifest(manifest)?.entries ?? {})).toEqual(['hero.mp4']);
  }, 120_000);
});

describe('guards', () => {
  it('refuses a raw directory that does not exist', async () => {
    await expect(processMedia({ raw: join(fixture, 'nope'), out })).rejects.toThrow(
      /raw directory not found/,
    );
  });

  // One directory would make each run's outputs the next run's inputs.
  it('refuses --raw and --out being the same directory', async () => {
    const dir = join(fixture, 'same');
    mkdirSync(dir, { recursive: true });
    await expect(processMedia({ raw: dir, out: dir })).rejects.toThrow(/same directory/);
  });

  it('writes no manifest for an empty raw directory', async () => {
    const dir = join(fixture, 'empty');
    const path = join(fixture, 'empty-manifest.json');
    mkdirSync(dir, { recursive: true });
    const result = await processMedia({
      raw: dir,
      out: join(fixture, 'empty-out'),
      manifest: path,
    });
    expect(result.plan.jobs).toHaveLength(0);
    expect(existsSync(path)).toBe(false);
  });
});
