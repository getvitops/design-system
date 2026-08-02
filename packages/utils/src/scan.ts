/**
 * Consumer source discovery.
 *
 * Lifted verbatim out of `@getvitops/cli`, where it was a private helper behind
 * `vitops lint`. It lives here now because a second caller needs it: the Astro
 * integration scans for icon usage during `astro:config:setup`, and it cannot
 * import the CLI — `@getvitops/cli` exposes only a `bin`, and its entry calls
 * `main()` at module scope, so importing it would run the CLI.
 *
 * Deliberately hand-rolled rather than a glob dependency: the whole job is one
 * `readdirSync` recursion with two allow/deny sets, and it runs synchronously
 * inside a config hook where an async glob would have to be awaited anyway.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

/** A file the scanner found, with its contents already read. */
export interface SourceFile {
  path: string;
  text: string;
}

export interface ScanOptions {
  /** File extensions to read. Defaults to `SCAN_EXT`. */
  exts?: Iterable<string>;
  /** Directory names to skip entirely. Defaults to `SCAN_SKIP`. */
  skipDirs?: Iterable<string>;
}

/**
 * Extensions worth scanning: every template language the framework's classes
 * and icon names can appear in, plus the markdown that can embed them.
 */
export const SCAN_EXT: ReadonlySet<string> = new Set([
  '.astro',
  '.html',
  '.htm',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.vue',
  '.svelte',
  '.php',
  '.md',
  '.mdx',
]);

/** Directories that only ever hold dependencies or build output. */
export const SCAN_SKIP: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  '.git',
  '.astro',
  'build',
  'coverage',
]);

/**
 * Recursively read every scannable file under `dir`.
 *
 * Dotfiles and dot-directories are skipped wholesale — they hold tooling config,
 * not templates, and `.astro`/`.git` would otherwise be walked twice over.
 */
export function scanFiles(dir: string, opts?: ScanOptions): SourceFile[] {
  const exts = opts?.exts ? new Set(opts.exts) : SCAN_EXT;
  const skip = opts?.skipDirs ? new Set(opts.skipDirs) : SCAN_SKIP;
  const acc: SourceFile[] = [];
  walk(dir, exts, skip, acc);
  return acc;
}

function walk(
  dir: string,
  exts: ReadonlySet<string>,
  skip: ReadonlySet<string>,
  acc: SourceFile[],
): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!skip.has(e.name)) walk(p, exts, skip, acc);
    } else if (exts.has(extname(e.name))) {
      acc.push({ path: p, text: readFileSync(p, 'utf8') });
    }
  }
}
