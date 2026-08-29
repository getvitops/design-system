/**
 * The cache — what makes a second run free.
 *
 * A committed artifact, unlike `indexing/`'s snapshot: the recommended layout
 * checks in both the processed outputs and this file, so CI never needs ffmpeg
 * and the outputs only change when someone deliberately re-encodes. That is why
 * `writeManifest` sorts and carries no timestamp — an unchanged run has to produce
 * a byte-identical file, or every build shows up as a diff.
 */
import type { MediaManifest, MediaManifestEntry } from './types.ts';
import { readVersioned, writeVersioned } from '../json-store.ts';

/** Default location, relative to the consumer's project root. */
export const MEDIA_MANIFEST_PATH = '.vitops/media-manifest.json';

/**
 * Read the manifest, or `undefined` when there isn't a usable one.
 *
 * A corrupt or wrong-version file reads as absent, which re-encodes everything.
 * The opposite reading — treating it as an empty but valid manifest — is the same
 * shape of bug `readSnapshot` avoids, except here it would be silent: nothing
 * would encode, and the build would reference outputs that were never written.
 */
export function readManifest(path: string): MediaManifest | undefined {
  return readVersioned<MediaManifest, 'entries'>(path, 'entries');
}

/** Build a manifest with its keys and output lists in a stable order. */
export function toManifest(entries: Record<string, MediaManifestEntry>): MediaManifest {
  const sorted: Record<string, MediaManifestEntry> = {};
  for (const key of Object.keys(entries).sort()) {
    const entry = entries[key] as MediaManifestEntry;
    sorted[key] = { ...entry, outputs: [...entry.outputs].sort() };
  }
  return { version: 1, entries: sorted };
}

/**
 * Write the manifest, creating its directory.
 *
 * Record a job only once its outputs are on disk. Writing eagerly would mark a
 * source as encoded that isn't, and because the next run trusts this file, the
 * result is a missing video that no rebuild ever fixes.
 */
export function writeManifest(path: string, manifest: MediaManifest): void {
  writeVersioned(path, manifest);
}
