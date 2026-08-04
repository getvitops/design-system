/**
 * The encoder. Executes a job and decides nothing.
 *
 * Every invocation goes through `execFile` with an argv array rather than a shell
 * string: a source path containing a space or a quote is ordinary, and the
 * shell-interpolated form these commands are usually written in breaks on both.
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ResolvedMediaConfig } from './plan.ts';

const exec = promisify(execFile);

/** `-loglevel error` keeps this small; the ceiling is for a pathological failure. */
const MAX_BUFFER = 16 * 1024 * 1024;

/**
 * x264 and VP9 use different CRF scales (0–51 against 0–63), so one `crf` knob has
 * to be mapped. 0.72 puts the default 32 at x264's own default of 23, which is the
 * pairing VP9's encoding guide uses for comparable quality.
 */
const X264_CRF_RATIO = 0.72;

let probe: Promise<void> | undefined;

/**
 * Fail early and clearly when ffmpeg isn't installed.
 *
 * Deliberately not the `optimizePng` shape in `favicon.ts`, which swallows a
 * missing `oxipng` and warns once. That is right for a best-effort lossless crush,
 * where skipping costs a few kilobytes. It is wrong here: skipping produces no
 * output at all, and a build that carries on would ship the page referencing a
 * video that was never encoded.
 */
export function requireFfmpeg(): Promise<void> {
  probe ??= exec('ffmpeg', ['-version'], { maxBuffer: MAX_BUFFER }).then(
    () => undefined,
    () => {
      probe = undefined; // so a later call re-probes rather than caching a stale failure
      throw new Error(
        'media: ffmpeg not found on PATH. It is an external tool, not an npm dependency — ' +
          'install it (macOS: `brew install ffmpeg`, Debian/Ubuntu: `apt install ffmpeg`, ' +
          'Windows: `winget install Gyan.FFmpeg`) and run this again.',
      );
    },
  );
  return probe;
}

async function run(args: string[]): Promise<void> {
  try {
    await exec('ffmpeg', args, { maxBuffer: MAX_BUFFER });
  } catch (err) {
    const stderr = String((err as { stderr?: string }).stderr ?? '').trim();
    const tail = stderr.split('\n').slice(-6).join('\n');
    throw new Error(`media: ffmpeg failed${tail ? `\n${tail}` : ''}`);
  }
}

/**
 * An encode that "succeeds" but writes nothing is the failure mode worth guarding:
 * seeking a poster past the end of a clip does exactly that, and ffmpeg exits 0.
 * Without this the manifest would record the job as done and never retry it.
 */
function assertWritten(file: string, what: string): void {
  if (!existsSync(file) || statSync(file).size === 0)
    throw new Error(
      `media: ${what} produced no output (${file}). Check --poster-time and the source.`,
    );
}

/** Scale filter, capping width and keeping the height even (yuv420p requires it). */
function scaleArgs(maxWidth: number): string[] {
  if (maxWidth <= 0) return [];
  // ffmpeg parses the quotes itself, so the commas inside min() aren't read as a
  // filter separator. There is no shell here to strip them.
  return ['-vf', `scale='min(${maxWidth},iw)':-2`];
}

/** `2M` → `4M`. A cap needs a buffer, and twice the rate is the usual choice. */
function bufsize(maxBitrate: string): string {
  const m = /^(\d+(?:\.\d+)?)([kKmM]?)$/.exec(maxBitrate.trim());
  if (!m)
    throw new Error(`media: maxBitrate "${maxBitrate}" is not a bitrate (try "2M" or "800k").`);
  return `${Number(m[1]) * 2}${m[2] ?? ''}`;
}

const rateArgs = (maxBitrate: string | undefined): string[] =>
  maxBitrate ? ['-maxrate', maxBitrate, '-bufsize', bufsize(maxBitrate)] : [];

const audioArgs = (config: ResolvedMediaConfig, codec: string): string[] =>
  config.audio ? ['-c:a', codec, '-b:a', '128k'] : ['-an'];

const BASE = ['-y', '-nostdin', '-loglevel', 'error'];

/**
 * VP9/WebM, two passes.
 *
 * The pass log goes into a fresh temp directory rather than the working directory.
 * ffmpeg's default (`ffmpeg2pass-0.log`, in cwd) makes cleanup cwd-dependent and
 * makes two concurrent encodes silently share one log — the second encode's rate
 * control then reads the first clip's statistics.
 */
export async function encodeWebm(
  input: string,
  output: string,
  config: ResolvedMediaConfig,
): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'vitops-media-'));
  const passlog = join(dir, 'pass');
  const video = [
    ...scaleArgs(config.maxWidth),
    '-c:v',
    'libvpx-vp9',
    // -b:v 0 with -crf is VP9's constant-quality mode; with -maxrate it becomes
    // constrained quality. A fixed bitrate would be right at one resolution only.
    '-b:v',
    '0',
    '-crf',
    String(config.crf),
    '-row-mt',
    '1',
    ...rateArgs(config.maxBitrate),
  ];
  try {
    // Pass 1 only gathers statistics, so it never encodes audio and writes no file.
    await run([
      ...BASE,
      '-i',
      input,
      ...video,
      '-an',
      '-pass',
      '1',
      '-passlogfile',
      passlog,
      '-f',
      'null',
      '-',
    ]);
    await run([
      ...BASE,
      '-i',
      input,
      ...video,
      ...audioArgs(config, 'libopus'),
      '-pass',
      '2',
      '-passlogfile',
      passlog,
      output,
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assertWritten(output, 'webm encode');
}

/**
 * H.264/MP4 — the fallback that makes `<video>` work on older iOS and in the
 * in-app webviews that still don't decode VP9.
 *
 * `+faststart` moves the moov atom to the front. Without it the browser has to
 * download the whole file before it can show frame one, which on a hero video
 * looks exactly like the optimisation didn't work.
 */
export async function encodeMp4(
  input: string,
  output: string,
  config: ResolvedMediaConfig,
): Promise<void> {
  await run([
    ...BASE,
    '-i',
    input,
    ...scaleArgs(config.maxWidth),
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    String(Math.round(config.crf * X264_CRF_RATIO)),
    // Required by Safari and by every hardware decoder worth naming.
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    ...rateArgs(config.maxBitrate),
    ...audioArgs(config, 'aac'),
    output,
  ]);
  assertWritten(output, 'mp4 encode');
}

/** The poster frame. `-ss` before `-i` so the seek is a fast one. */
export async function extractPoster(
  input: string,
  output: string,
  config: ResolvedMediaConfig,
): Promise<void> {
  await run([
    ...BASE,
    ...(config.posterTime > 0 ? ['-ss', String(config.posterTime)] : []),
    '-i',
    input,
    ...scaleArgs(config.maxWidth),
    '-frames:v',
    '1',
    '-q:v',
    '2',
    output,
  ]);
  assertWritten(output, 'poster extraction');
}
