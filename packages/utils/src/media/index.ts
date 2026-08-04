/**
 * `vitops media` — turning a directory of raw video into web-ready assets.
 *
 * A separate subpath (`@getvitops/utils/media`) rather than part of the package
 * index, matching `./favicon` and `./indexing`: this module shells out to an
 * external encoder, and a consumer importing the content helpers shouldn't carry
 * it.
 *
 * The layering is the point, and it is the same one `indexing/` makes. `plan.ts`
 * decides everything and touches nothing; `ffmpeg.ts` executes and decides
 * nothing; `discover.ts` and `manifest.ts` are the filesystem either side. That is
 * what lets `--dry` be a complete account of a run, and what lets the cache — the
 * part with real consequences, since getting it wrong means either minutes of
 * needless encoding or a stale video shipped — be tested with no ffmpeg installed.
 */
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { discoverVideos } from './discover.ts';
import { encodeMp4, encodeWebm, extractPoster, requireFfmpeg } from './ffmpeg.ts';
import { MEDIA_MANIFEST_PATH, readManifest, toManifest, writeManifest } from './manifest.ts';
import { pendingJobs, planMedia, resolveConfig } from './plan.ts';
import type { MediaConfig, MediaManifestEntry, MediaPlan } from './types.ts';

export interface ProcessMediaOptions {
  /** Directory of unprocessed sources. Walked recursively. */
  raw: string;
  /** Where the encoded outputs go. Structure under `raw` is preserved. */
  out: string;
  config?: MediaConfig | undefined;
  /** Cache location. Default `.vitops/media-manifest.json`. */
  manifest?: string | undefined;
  /** Re-encode regardless of the cache. */
  force?: boolean | undefined;
  /** Decide everything, run nothing. */
  dry?: boolean | undefined;
  /** Called before each source is encoded — these take minutes, so say so. */
  onProgress?: ((message: string) => void) | undefined;
}

export interface ProcessMediaResult {
  plan: MediaPlan;
  /** Outputs written this run, relative to `out`. */
  written: string[];
  /** Sources that needed no work. */
  skipped: number;
}

/**
 * Encode everything under `raw` that has changed since the last run.
 *
 * Callers get the cache for free because it lives here rather than in either of
 * them: `vitops media` and the Astro integration are equally incremental, since
 * they call this same function.
 */
export async function processMedia(options: ProcessMediaOptions): Promise<ProcessMediaResult> {
  const rawDir = resolve(options.raw);
  const outDir = resolve(options.out);
  const manifestPath = resolve(options.manifest ?? MEDIA_MANIFEST_PATH);

  if (!existsSync(rawDir) || !statSync(rawDir).isDirectory())
    throw new Error(`media: raw directory not found: ${rawDir}`);
  // Sharing one directory would make each run's outputs the next run's inputs —
  // re-encoding a re-encode, forever, losing quality every time.
  if (rawDir === outDir)
    throw new Error(`media: --raw and --out are the same directory (${rawDir}). They must differ.`);

  const config = resolveConfig(options.config);
  const sources = await discoverVideos(rawDir);
  const previous = readManifest(manifestPath);
  const plan = planMedia({
    sources,
    ...(options.config ? { config: options.config } : {}),
    ...(previous ? { previous } : {}),
    ...(options.force ? { force: options.force } : {}),
    probe: (file) => existsSync(join(outDir, file)),
  });

  const pending = pendingJobs(plan);
  const skipped = plan.jobs.length - pending.length;
  if (options.dry) return { plan, written: [], skipped };

  // Carry forward what is still valid, so the manifest on disk is a truthful
  // account at every moment — including after a crash halfway through.
  const entries: Record<string, MediaManifestEntry> = {};
  for (const job of plan.jobs) {
    const prev = previous?.entries[job.source.id];
    if (job.skip && prev) entries[job.source.id] = prev;
  }

  if (pending.length > 0) await requireFfmpeg();

  const written: string[] = [];
  for (const job of pending) {
    options.onProgress?.(`encoding ${job.source.id}`);
    for (const out of job.outputs) {
      const target = join(outDir, out.file);
      mkdirSync(dirname(target), { recursive: true });
      if (out.kind === 'webm') await encodeWebm(job.source.path, target, config);
      else if (out.kind === 'mp4') await encodeMp4(job.source.path, target, config);
      else await extractPoster(job.source.path, target, config);
      written.push(out.file);
    }
    entries[job.source.id] = {
      source: job.source.hash,
      settings: job.settings,
      outputs: job.outputs.map((o) => o.file),
    };
    writeManifest(manifestPath, toManifest(entries));
  }

  // Also write when nothing encoded, which is what prunes entries for sources
  // that have since been deleted. Skipped when there is nothing to record either
  // way, so an empty raw directory doesn't create a manifest.
  if (pending.length === 0 && (previous || Object.keys(entries).length > 0))
    writeManifest(manifestPath, toManifest(entries));

  return { plan, written, skipped };
}

export { DISCOVER_SKIP, VIDEO_EXT, discoverVideos, hashFile } from './discover.ts';
export { encodeMp4, encodeWebm, extractPoster, requireFfmpeg } from './ffmpeg.ts';
export { MEDIA_MANIFEST_PATH, readManifest, toManifest, writeManifest } from './manifest.ts';
export { formatPlan, pendingJobs, planMedia, resolveConfig, settingsHash } from './plan.ts';
export type { MediaPlanInput, OutputProbe, ResolvedMediaConfig } from './plan.ts';
export { DEFAULT_OUTPUTS, ENCODER_VERSION, OUTPUT_EXT } from './types.ts';
export type {
  MediaConfig,
  MediaJob,
  MediaManifest,
  MediaManifestEntry,
  MediaOutput,
  MediaPlan,
  MediaSource,
  OutputKind,
} from './types.ts';
