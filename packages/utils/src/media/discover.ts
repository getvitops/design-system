/**
 * Finding the source videos and fingerprinting them.
 *
 * Deliberately not `scanFiles` from `../scan.ts`, which reads every match into
 * memory as a string. That is right for templates and catastrophic for a video —
 * the files this walks are routinely tens or hundreds of megabytes, which is also
 * why the hash is streamed rather than taken over a `readFileSync`.
 */
import { createHash } from 'node:crypto';
import { createReadStream, readdirSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import type { MediaSource } from './types.ts';

/** Container formats worth accepting as input. */
export const VIDEO_EXT: ReadonlySet<string> = new Set([
  '.mp4',
  '.mov',
  '.m4v',
  '.mkv',
  '.avi',
  '.webm',
  '.mpg',
  '.mpeg',
]);

/** Directories that never hold hand-managed source assets. */
export const DISCOVER_SKIP: ReadonlySet<string> = new Set(['node_modules', 'dist', '.git']);

/** sha256 of the file contents, streamed. Truncated — 16 hex chars is 64 bits. */
export function hashFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex').slice(0, 16)));
  });
}

function walk(dir: string, acc: string[]): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!DISCOVER_SKIP.has(e.name)) walk(p, acc);
    } else if (VIDEO_EXT.has(extname(e.name).toLowerCase())) {
      acc.push(p);
    }
  }
}

/**
 * Every video under `dir`, with its content hash.
 *
 * Sorted by `id` so a plan — and therefore the manifest and the log — comes out in
 * the same order on every machine, regardless of what the filesystem hands back.
 */
export async function discoverVideos(dir: string): Promise<MediaSource[]> {
  const paths: string[] = [];
  walk(dir, paths);
  const sources = await Promise.all(
    paths.map(async (path) => ({
      path,
      id: relative(dir, path).split(sep).join('/'),
      hash: await hashFile(path),
    })),
  );
  return sources.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
