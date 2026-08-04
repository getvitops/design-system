/**
 * The media module's own option surface.
 *
 * Everything here describes *how to encode*, never *what the site is* — which is
 * why there is no `SiteConfig` block behind it. `legal`, `icons` and `indexing`
 * are anchored to a site config because what they emit describes the site; an
 * encoder setting describes a build step.
 */

/** What a source video is turned into. */
export type OutputKind = 'webm' | 'mp4' | 'poster';

/** The default set: a modern codec, a universal fallback, and a poster frame. */
export const DEFAULT_OUTPUTS: OutputKind[] = ['webm', 'mp4', 'poster'];

/** File extension per output kind. */
export const OUTPUT_EXT: Record<OutputKind, string> = {
  webm: '.webm',
  mp4: '.mp4',
  poster: '.jpg',
};

/**
 * Bumped when the ffmpeg arguments in `ffmpeg.ts` change in a way that alters the
 * output bytes. It is part of the settings hash, so bumping it re-encodes every
 * source on the next run.
 *
 * Bump it deliberately and rarely. Consumers commit their processed outputs (see
 * the README), so every bump is a large binary diff in someone's repository —
 * that cost is worth paying for a real encoder fix and not for a tidy-up.
 */
export const ENCODER_VERSION = 1;

/** How to encode. Every field here feeds the settings hash. */
export interface MediaConfig {
  /**
   * Cap the output width in pixels, preserving aspect ratio. Default 1920.
   *
   * A source larger than its display size is the usual reason a hero video is
   * enormous, so this is on by default rather than opt-in. `0` disables scaling.
   */
  maxWidth?: number | undefined;
  /**
   * Constant-quality level, on **VP9's CRF scale (0–63, lower is better)**.
   * Default 32, which is the range VP9's own guidance recommends for 1080p.
   *
   * H.264 uses a different scale (0–51), so the MP4 fallback is encoded at
   * `round(crf * 0.72)` — 23 at the default, x264's own default. One knob, because
   * two would drift apart and nobody would know which one mattered.
   */
  crf?: number | undefined;
  /**
   * Optional ceiling, e.g. `'2M'`. Absent by default: a bitrate cap makes the
   * encode constrained-quality rather than constant-quality, which is right when
   * you are protecting a data budget and wrong as a default, because the correct
   * cap depends on the resolution you are capping.
   */
  maxBitrate?: string | undefined;
  /**
   * Keep the audio track. Default false — the common case is a muted autoplay
   * loop, where the audio stream is bytes nobody will ever hear.
   */
  audio?: boolean | undefined;
  /**
   * Timestamp (seconds) the poster frame is taken from. Default 0.
   *
   * Frame 0 is often black on a clip that fades in, which is worth knowing before
   * concluding the poster is broken.
   */
  posterTime?: number | undefined;
  /** Which outputs to produce. Default `DEFAULT_OUTPUTS`. */
  outputs?: OutputKind[] | undefined;
}

/** A discovered source video. */
export interface MediaSource {
  /** Absolute path on disk. */
  path: string;
  /**
   * Path relative to the raw directory, POSIX-separated — the manifest key.
   * Relative so a manifest stays valid when the project moves or is cloned
   * somewhere else, which is the whole point of committing it.
   */
  id: string;
  /** sha256 of the file contents, truncated. */
  hash: string;
}

/** One file an encode will write. */
export interface MediaOutput {
  kind: OutputKind;
  /** Path relative to the output directory, POSIX-separated. */
  file: string;
}

/** One source and everything decided about it. */
export interface MediaJob {
  source: MediaSource;
  outputs: MediaOutput[];
  /** Hash of the settings these outputs were produced under. */
  settings: string;
  /** Why this job needs no work. Present iff it is being skipped. */
  skip?: string | undefined;
}

/** The complete account of a run, decided before any of it happens. */
export interface MediaPlan {
  jobs: MediaJob[];
  /** Things the operator needs to read. Printed by `--dry` and by a real run. */
  notes: string[];
}

/** One manifest record: what these outputs were made from, and under what settings. */
export interface MediaManifestEntry {
  /** `MediaSource.hash` at the time of encoding. */
  source: string;
  /** Settings hash at the time of encoding. */
  settings: string;
  /** Output paths relative to the output directory. */
  outputs: string[];
}

/**
 * The cache. A committed artifact, so it carries no timestamp and its keys are
 * sorted — a rebuild of unchanged sources must produce a byte-identical file, or
 * it shows up as noise in every diff.
 */
export interface MediaManifest {
  version: 1;
  entries: Record<string, MediaManifestEntry>;
}
