/**
 * Notice a config file left under its pre-rename name.
 *
 * The default config was `site.json` before it became `vitops.json` (the document holds
 * the design system and the organization too, not only the site). That was a hard break
 * with no fallback, so the one thing a project on the old name needs is a message that
 * says exactly what to run. A person or an agent reading this error can act on it
 * literally, which is the whole job.
 *
 * Node-only (it touches the filesystem), so it is deliberately not in `config.ts`, whose
 * import graph must stay Worker-safe.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONFIG_FILENAME, isConfig } from './config.ts';

const LEGACY_FILENAME = 'site.json';

/**
 * A rename instruction when `cwd` holds a `site.json` that is a `Config` and no
 * `vitops.json`; otherwise `undefined`. A `site.json` that is not a `Config` is somebody
 * else's file and stays silent.
 */
export function legacyConfigHint(cwd: string = process.cwd()): string | undefined {
  if (existsSync(resolve(cwd, CONFIG_FILENAME))) return undefined;
  const legacy = resolve(cwd, LEGACY_FILENAME);
  if (!existsSync(legacy)) return undefined;
  try {
    if (!isConfig(JSON.parse(readFileSync(legacy, 'utf8')))) return undefined;
  } catch {
    return undefined;
  }
  return (
    `${LEGACY_FILENAME} was renamed to ${CONFIG_FILENAME}. ` +
    `Run: git mv ${LEGACY_FILENAME} ${CONFIG_FILENAME}, then update every import or ` +
    `\`input\` that names './${LEGACY_FILENAME}' (astro.config.mjs, vite.config.ts, package.json scripts).`
  );
}
