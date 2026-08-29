/**
 * Helpers shared by the `vitops` subcommands that read a `Config` (site.json) —
 * `legal`, `robots`, `reviews`, `icons`, and the `search`/`ads` subcommand groups
 * (in `commands/search.ts` / `commands/ads.ts`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveConfig, type Config } from '@getvitops/generator';
import { msg } from '../args.ts';

export function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

/** The `--input`/`--site-env` pair every `Config`-anchored command accepts. */
export const SITE_OPTS = {
  input: { type: 'string', short: 'i', default: 'site.json' },
  'site-env': { type: 'string', default: 'production' },
} as const;

/** Read a JSON file, or exit — the shape shared by every config loader below. */
export function readJsonOrFail(path: string, notFoundLabel: string): unknown {
  if (!existsSync(path)) fail(`${notFoundLabel} not found: ${path}`);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    fail(`could not parse JSON: ${msg(err)}`);
  }
}

/**
 * Read + resolve a site config, or exit with a message.
 *
 * Accepts JSON, or a JS/TS module with a default export — deliberately not YAML,
 * which would mean a parser dependency for one command. `resolveConfig` is
 * documented as taking an already-parsed object precisely so the loader is the
 * consumer's choice; anyone on YAML can convert it or export from a module.
 */
export async function loadConfig(path: string, siteEnv: string): Promise<Config> {
  if (!existsSync(path)) fail(`site config not found: ${path}`);
  let raw: unknown;
  if (/\.(json)$/.test(path)) {
    raw = readJsonOrFail(path, 'site config');
  } else {
    try {
      raw = (await import(pathToFileURL(path).href)).default;
    } catch (err) {
      fail(`could not import ${path}: ${msg(err)}`);
    }
    if (raw == null) fail(`${path} has no default export`);
  }
  try {
    return resolveConfig(raw, siteEnv);
  } catch (err) {
    // resolveConfig already formats one issue per line.
    fail(msg(err));
  }
}

/** `loadConfig`, from an args object built by `SITE_OPTS` — the repeated preamble. */
export async function siteConfig(a: {
  path: (k: 'input') => string;
  str: (k: 'site-env') => string;
}): Promise<Config> {
  return loadConfig(a.path('input'), a.str('site-env'));
}

/**
 * Print a plan, then decide whether to keep going.
 *
 * Covers the shape shared by `reviews` and `search notify`: print the plan,
 * stop silently if it's `blocked`, stop with a message under `--dry`. `search
 * setup` and `ads setup` each combine `--check`/`--dry` differently enough
 * (a distinct check-success message, or one branch covering both flags with no
 * per-branch message) that forcing them through this same shape would either
 * lose behavior or need a configuration object bigger than the duplication it
 * removes — they stay bespoke.
 */
export function printPlanAndDryGate(opts: {
  planText: string;
  /** Truthy blocks — `indexing`'s plan carries the reason as a string here. */
  blocked: unknown;
  dry: boolean;
  dryMessage: string;
}): boolean {
  console.log(opts.planText);
  if (opts.blocked) return false;
  if (opts.dry) {
    console.log(`\n(--dry: ${opts.dryMessage})`);
    return false;
  }
  return true;
}

/**
 * Filter a list to the one item matching `filterValue` (a `--domain`/`--provider`
 * flag), or fail naming what's actually configured. The `--domain`/`--provider`
 * "found none matching" shape shared by `toSearchConsoleSetup` and `toAdProperties`.
 */
export function pickOne<T>(
  items: T[],
  filterValue: string | undefined,
  keyOf: (item: T) => string,
  label: { flag: string; source: string },
): T[] {
  if (!filterValue) return items;
  const one = items.find((i) => keyOf(i) === filterValue);
  if (!one)
    fail(
      `--${label.flag} "${filterValue}" is not in ${label.source} (have: ${items.map(keyOf).join(', ') || 'none'})`,
    );
  return [one];
}

/** `mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, contents)`. */
export function writeOut(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}
