/**
 * Every decision `vitops media` makes, as one pure function.
 *
 * Pure in the load-bearing sense: no `fs`, no clock, no subprocess. Whether a
 * source needs re-encoding — the only thing here that can be wrong in a way that
 * costs minutes or ships a stale video — is decided from data passed in, and
 * asserted in `plan.test.ts` on a machine with no ffmpeg installed.
 *
 * That split is the same one `indexing/plan.ts` makes against its I/O modules, and
 * for the same reason: `--dry` should be a complete account of a run rather than
 * an approximation of one.
 */
import { createHash } from 'node:crypto';
import {
  DEFAULT_OUTPUTS,
  ENCODER_VERSION,
  type MediaConfig,
  type MediaJob,
  type MediaManifest,
  type MediaOutput,
  type MediaPlan,
  type MediaSource,
  OUTPUT_EXT,
  type OutputKind,
} from './types.ts';

/** Defaults, resolved once so the settings hash is computed over real values. */
export interface ResolvedMediaConfig {
  maxWidth: number;
  crf: number;
  maxBitrate: string | undefined;
  audio: boolean;
  posterTime: number;
  outputs: OutputKind[];
}

/**
 * Injected existence probe — `plan.ts` touches no filesystem itself.
 *
 * Takes a path relative to the output directory. The same injection shape as
 * `collectEntries(source, read)` in `indexing/sitemap.ts`.
 */
export type OutputProbe = (relativePath: string) => boolean;

export interface MediaPlanInput {
  sources: MediaSource[];
  config?: MediaConfig | undefined;
  /** The previous run's manifest, if there is a usable one. */
  previous?: MediaManifest | undefined;
  /** Whether an output file is already on disk. Defaults to "nothing exists". */
  probe?: OutputProbe | undefined;
  /** `--force`: re-encode regardless of the cache. */
  force?: boolean | undefined;
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

/** Fill in defaults. Exported because the encoder and the hash must agree on them. */
export function resolveConfig(config: MediaConfig = {}): ResolvedMediaConfig {
  return {
    maxWidth: config.maxWidth ?? 1920,
    crf: config.crf ?? 32,
    maxBitrate: config.maxBitrate,
    audio: config.audio ?? false,
    posterTime: config.posterTime ?? 0,
    outputs: config.outputs ?? DEFAULT_OUTPUTS,
  };
}

/**
 * Hash the settings that decide the output bytes.
 *
 * Order-independent in the one place it could bite (`outputs` is sorted), so
 * re-ordering the list in a config doesn't re-encode a whole library.
 */
export function settingsHash(config: ResolvedMediaConfig): string {
  return sha(
    JSON.stringify({
      v: ENCODER_VERSION,
      maxWidth: config.maxWidth,
      crf: config.crf,
      maxBitrate: config.maxBitrate ?? null,
      audio: config.audio,
      posterTime: config.posterTime,
      outputs: [...config.outputs].sort(),
    }),
  );
}

/** `a/b/clip.mp4` → `a/b/clip` */
function stem(id: string): string {
  const dot = id.lastIndexOf('.');
  const slash = id.lastIndexOf('/');
  return dot > slash ? id.slice(0, dot) : id;
}

function outputsFor(source: MediaSource, config: ResolvedMediaConfig): MediaOutput[] {
  const base = stem(source.id);
  return config.outputs.map((kind) => ({ kind, file: `${base}${OUTPUT_EXT[kind]}` }));
}

/**
 * Decide what to encode.
 *
 * A job is skipped only when all three hold: the source contents hash the same as
 * last time, the settings hash the same, and every declared output is still on
 * disk. Anything else re-encodes — including an absent or unreadable manifest,
 * which reads as "encode everything" and never as "everything is done".
 *
 * Throws on an output collision (`hero.mp4` and `hero.mov` in one directory both
 * want `hero.webm`). That is a layout mistake rather than a runtime condition, and
 * the failure it would otherwise cause — two sources overwriting each other every
 * run, each invalidating the other's cache entry — is invisible from the outside.
 */
export function planMedia(input: MediaPlanInput): MediaPlan {
  const config = resolveConfig(input.config);
  const settings = settingsHash(config);
  const probe = input.probe ?? (() => false);
  const notes: string[] = [];

  const jobs: MediaJob[] = [];
  const claimed = new Map<string, string>();

  for (const source of input.sources) {
    const outputs = outputsFor(source, config);
    for (const out of outputs) {
      const owner = claimed.get(out.file);
      if (owner !== undefined && owner !== source.id)
        throw new Error(
          `media: "${source.id}" and "${owner}" both produce "${out.file}". ` +
            'Two sources with the same name in one directory overwrite each other — rename one.',
        );
      claimed.set(out.file, source.id);
    }

    const prev = input.previous?.entries[source.id];
    const cached =
      !input.force &&
      prev !== undefined &&
      prev.source === source.hash &&
      prev.settings === settings &&
      outputs.every((o) => probe(o.file));

    jobs.push({ source, outputs, settings, ...(cached ? { skip: 'unchanged' } : {}) });
  }

  const pending = jobs.filter((j) => !j.skip).length;
  if (input.sources.length === 0) notes.push('no video files found');
  else if (input.force && pending > 0) notes.push(`--force: re-encoding all ${pending}`);
  else if (!input.previous && pending > 0)
    notes.push('no manifest — encoding everything (a first run, or a cache that was not restored)');

  return { jobs, notes };
}

/** The jobs that will actually run. */
export const pendingJobs = (plan: MediaPlan): MediaJob[] => plan.jobs.filter((j) => !j.skip);

/** Human-readable account of a plan, for `--dry` and for the run summary. */
export function formatPlan(plan: MediaPlan): string {
  const lines: string[] = [];
  const pending = pendingJobs(plan);
  const skipped = plan.jobs.length - pending.length;

  lines.push(`${plan.jobs.length} source${plan.jobs.length === 1 ? '' : 's'}`);
  lines.push(`  encode:  ${pending.length}`);
  lines.push(`  skipped: ${skipped} (unchanged)`);

  for (const job of pending)
    lines.push(`  • ${job.source.id} → ${job.outputs.map((o) => o.file).join(', ')}`);

  for (const note of plan.notes) lines.push(`  ! ${note}`);
  return lines.join('\n');
}
