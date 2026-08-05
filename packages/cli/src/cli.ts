#!/usr/bin/env node
/**
 * `vitops` — CLI for the Vitops design-system generator.
 *
 *   vitops generate  --input <json> --format <bricks|css|tailwind|design[,…]> --out <dir>
 *   vitops init      [--out design-system.json] [--force]
 *   vitops validate  <design-system.json|site.json>
 *   vitops favicon   --input <svg|png> --out <dir> [--low-res <svg|png>] [--background <hex>]
 *   vitops agents    [--input <json>] [--out AGENTS.md] [--docs-dir <dir>]
 *   vitops docs      [topic] [--input <json>] [--all]
 *   vitops lint      [--input <json>] [--format <fmt>] [--src <dir>]
 *   vitops legal     [--input <site.json>] [--doc <name>] [--format <md|html|portable-text>] [--out <dir>]
 *   vitops search    setup [--domain <name>] [--dry] [--check]  |  notify [--dry] [--all] [--check]
 *   vitops media     [--raw <dir>] [--out <dir>] [--force] [--dry]
 *
 * Thin wrapper over @getvitops/generator (generation) and @getvitops/utils (favicons).
 * Every client brings their own consumer-editable design-system.json.
 */
import { parseArgs } from 'node:util';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname, relative } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import {
  buildIconSprite,
  generate,
  validate,
  defaultConfig,
  generateDocs,
  generateLegal,
  enabledDocs,
  isConfig,
  resolveInput,
  resolveConfig,
  resolveTheme,
  roleColorUtilities,
  functionalRole,
  expandPalette,
  roleHue,
  roleKind,
  SCHEMA_URL,
  type Format,
  type StylesheetFormat,
  type DesignSystem,
  type LegalDoc,
  type LegalOutput,
  type ResolvedInput,
  type Config,
} from '@getvitops/generator';
import {
  collectIconRefs,
  generateFavicons,
  generateIconInclude,
  resolveIcon,
  scanFiles,
} from '@getvitops/utils';
// Its own subpath: `indexing` is the only network-touching module in utils, and the
// other commands should not pull it in.
import {
  SNAPSHOT_PATH,
  collectEntries,
  formatPlan,
  getAccessToken,
  inspectUrl,
  keyFileContents,
  newKey,
  parseServiceAccount,
  plan,
  readSnapshot,
  resolveKeyLocation,
  resolveSitemapUrl,
  submitBatch,
  submitSitemap,
  toSnapshot,
  verifyKeyFile,
  writeSnapshot,
  type IndexingConfig,
  type ServiceAccount,
} from '@getvitops/utils/indexing';
// Its own subpath for the same reason: `onboarding` is network-touching (Cloudflare
// DNS + Google). `formatPlan`/`plan` are aliased — indexing exports the same names.
import {
  addSite,
  backoffSchedule,
  createApexTxt,
  findZoneId,
  formatPlan as formatSetupPlan,
  formatSummary,
  getAccessToken as getGoogleToken,
  getSite,
  getVerificationToken,
  getWebResource,
  hasDrift,
  listApexTxt,
  ownerUnion,
  plan as planSetup,
  siteUrlFor,
  updateOwners,
  verifyWebResource,
  type DomainResult,
  type DomainSetup,
  type DomainState,
  type GoogleOAuth,
} from '@getvitops/utils/onboarding';
// Its own subpath for the same reason: `media` shells out to ffmpeg, and no other
// command should carry it. `formatPlan` is aliased — indexing exports one too.
import {
  MEDIA_MANIFEST_PATH,
  formatPlan as formatMediaPlan,
  processMedia,
  type MediaConfig,
  type OutputKind,
} from '@getvitops/utils/media';
import { findSkillTarget, linkSkill, SKILL_NAME, TOPICS } from './agents.ts';
import { lintCss } from './lint-css.ts';
import { lintSource, vocabulary } from './lint.ts';

const FORMATS = new Set<Format>(['bricks', 'css', 'tailwind', 'design']);
// `lint` judges class names against what a build emits, and the `design` format
// emits no CSS at all — so it is a valid target for `generate` and a category
// error for `lint`.
const LINT_FORMATS = new Set<StylesheetFormat>(['bricks', 'css', 'tailwind']);

// `legal` reads a *site* config, not a design-system.json, and has its own
// output set — it renders documents, not stylesheets.
const LEGAL_DOCS = new Set<LegalDoc>(['privacy', 'terms', 'cookies']);
const LEGAL_OUTPUTS = new Set<LegalOutput>(['md', 'html', 'portable-text']);

const HELP = `vitops — generate design-system outputs from a design-system.json

Anywhere a command takes --input, that file may be a design-system.json OR the
larger site config that embeds one (company.json / site.json). The two are told
apart by shape, and a site config also supplies the site-level facts generation
reads — its default colour scheme, its legal documents, its icon sprite.

Usage:
  vitops generate [options]     Generate platform output from a config
  vitops init [options]         Scaffold a starter design-system.json
  vitops validate <file>        Validate a config against the schema it says it is
  vitops favicon [options]      Generate a favicon set from a source image
  vitops agents [options]       Link the design-system agent skill + AGENTS.md pointer
  vitops docs [topic]           Print live design-system reference docs to stdout
  vitops lint [options]         Report framework classes in your source that resolve to nothing
  vitops legal [options]        Render legal documents from a site config
  vitops icons [options]        Report which icons your source uses, and build the sprite
  vitops search <sub> [opts]    Search Console: onboard domains (setup) + notify deploys (notify)
  vitops media [options]       Encode raw video into web-ready WebM + MP4 + poster

Generate options:
  -i, --input <path>    design-system.json or site config (default: ./design-system.json)
  -f, --format <list>   bricks | css | tailwind | design (comma-separated; default: bricks)
                        design emits DESIGN.md only (the agent-facing brief) — pair it
                        with --out . to write it beside AGENTS.md, or compose:
                        --format css,design
  -o, --out <dir>       Output directory (default: ./dist)
      --theme <name>    Which designSystem.themes entry to build, when --input is
                        a site config (default: its defaultTheme, else "default")
      --site <path>     Site config, when it is a different file from --input.
                        Emits legal/*.html into the output directory (see:
                        vitops legal). Omitted with a plain design-system.json:
                        no legal files.
      --site-env <env>  Environment whose A/B variant applies (default: production)

Init options:
  -o, --out <path>      Where to write (default: ./design-system.json)
      --force           Overwrite an existing file

Favicon options:
  -i, --input <path>    Source SVG or PNG (required)
  -o, --out <dir>       Output directory (default: ./public)
      --low-res <path>  Optional simplified source for the 16px icon
      --background <hex>  Background under the maskable icons, which must be
                        opaque (default: #ffffff)

Agents options:
  -i, --input <path>    design-system.json or site config (default: ./design-system.json;
                        validated if present)
      --theme <name>    Theme to read, when --input is a site config
  -o, --out <path>      Doc file to update, idempotently (default: ./AGENTS.md)
      --docs-dir <dir>  Legacy layout: write the docs bundle as files to this dir
                        instead of linking the packaged skill

Docs options:
  <topic>               classes | authoring | formats | color | scales | patterns | elements
                        (no topic: list topics with summaries)
  -i, --input <path>    design-system.json or site config (default: ./design-system.json)
      --theme <name>    Theme to render docs from, when --input is a site config
      --all             Print every topic, concatenated

Icons options:
      --site <path>     Site config carrying the "icons" block (default: ./site.json)
      --src <dir>       Source to scan for icon usage (default: ./src)
      --sprite          Also build the SVG sprite
  -o, --out <dir>       Where to write icons.svg with --sprite (default: ./dist)
      --json            Machine-readable report on stdout

Lint options:
  -i, --input <path>    design-system.json or site config (default: ./design-system.json)
      --theme <name>    Theme to judge classes against, when --input is a site config
  -f, --format <fmt>    Format you build (bricks | css | tailwind; default: bricks).
                        Responsive md-* classes are real in css/bricks, inert in tailwind.
  -s, --src <dir>       Directory to scan (default: ./src)
      --strict          Also fail on suggestions (reuse hints), not just on
                        classes that resolve to nothing

Legal options:
  -i, --input <path>    Site config: .json, or a .js/.ts module with a default
                        export (default: ./site.json)
  -d, --doc <name>      privacy | terms | cookies (repeatable; default: those
                        enabled in the config)
  -f, --format <fmt>    md | html | portable-text (default: md)
                        html suits WordPress/Bricks and plain sites;
                        portable-text suits EmDash
  -o, --out <dir>       Write files here (default: print to stdout)
      --site-env <env>  Environment whose A/B variant applies (default: production)

  Generated from your config — a starting point, not legal advice. Review before
  publishing, and make sure the config describes what your site actually does.

Search subcommands:
  vitops search setup [opts]    Onboard site.searchConsole domains into GSC
  vitops search notify [opts]   Tell search engines about a deploy (sitemap + IndexNow)

Search setup options:
  -i, --input <path>    Site config carrying site.searchConsole (default: ./site.json)
      --site-env <env>  Environment whose A/B variant applies (default: production)
      --domain <name>   Scope to a single site.searchConsole entry
      --dry             Print the plan and exit. Changes nothing.
      --check           Report drift and exit non-zero if any domain is not fully
                        onboarded. Mutates nothing.

  For each domain it ensures the apex verification TXT in Cloudflare, verifies
  ownership (DNS_TXT, retried with backoff while DNS propagates — a still-
  unverified domain is reported PENDING, not failed), adds the sc-domain: property,
  and adds any delegatedOwners to the web resource. DNS is only ever created,
  never edited or deleted. Credentials come from the environment:
  CLOUDFLARE_API_TOKEN (Zone:DNS:Edit), and VITOPS_GOOGLE_CLIENT_ID /
  VITOPS_GOOGLE_CLIENT_SECRET / VITOPS_GOOGLE_REFRESH_TOKEN (a user OAuth token
  scoped to siteverification + webmasters). Granting a Google Group Full-User
  access has no API and is surfaced as a reminder.

Search notify options:
  -i, --input <path>    Site config carrying seo.indexing (default: ./site.json)
      --site-env <env>  Environment to notify for (default: production). An
                        environment whose robots policy says noindex is refused.
      --sitemap <src>   Sitemap URL or local path (default: from the config)
      --urls <list>     Comma-separated URLs to submit, skipping the diff
      --all             Submit every URL in the sitemap, not just what changed
      --dry             Print the plan and exit. Makes no requests.
      --check           Read-only: ask Google whether seo.indexing.priorityUrls
                        are indexed. Exits non-zero if one is not.
      --new-key         Print a fresh IndexNow key and exit
      --write-key <dir> Write the IndexNow key file into <dir> (for stacks with
                        no Astro integration to do it — Bricks, WordPress)
      --snapshot <path> Changed-URL state file (default: .vitops/sitemap-snapshot.json).
                        Persist it between runs (a CI cache) or every run submits
                        everything.

  What notify can and cannot do: Google exposes no "request indexing" API, and its
  sitemap ping endpoint was removed in 2023 — so it resubmits your sitemap
  through the Search Console API and verifies the result with --check. IndexNow
  reaches Bing, Yandex, Naver, Seznam and Yep; Google does not participate.
  Search Console needs a service account in VITOPS_GSC_SERVICE_ACCOUNT (inline
  JSON) or GOOGLE_APPLICATION_CREDENTIALS (a path), added as an owner of the
  property.

Media options:
      --raw <dir>       Directory of unprocessed video, walked recursively
                        (default: ./raw)
  -o, --out <dir>       Where the encoded outputs go (default: ./src/assets/processed).
                        Subdirectories under --raw are preserved.
      --max-width <px>  Cap the output width, keeping aspect ratio (default: 1920;
                        0 disables scaling)
      --crf <n>         Quality on VP9's scale, 0-63, lower is better (default: 32).
                        The MP4 fallback uses the equivalent on H.264's scale.
      --max-bitrate <r> Optional ceiling, e.g. 2M or 800k (default: none, which is
                        constant quality rather than constrained)
      --audio           Keep the audio track (default: dropped — the common case is
                        a muted autoplay loop)
      --poster-time <s> Timestamp the poster frame is taken from (default: 0, which
                        is often black on a clip that fades in)
      --outputs <list>  Comma-separated: webm | mp4 | poster (default: all three)
      --manifest <path> Cache file (default: .vitops/media-manifest.json)
      --force           Re-encode everything, ignoring the cache
      --dry             Print the plan and exit. Encodes nothing.

  Needs ffmpeg on PATH — it is an external tool, not an npm dependency, and this
  command fails rather than quietly skipping. Commit the outputs and the manifest:
  ffmpeg output is not reproducible across versions, so re-encoding in CI churns
  the diff on every toolchain bump. Use --force when you mean to re-encode.

Common:
  -h, --help            Show this help
`;

const SEARCH_HELP = `vitops search — Google Search Console

  vitops search setup [opts]    Onboard site.searchConsole domains as GSC domain properties
  vitops search notify [opts]   Tell search engines a deploy happened (sitemap + IndexNow)

Run \`vitops --help\` for the full option list for each subcommand.
`;

function fail(msg: string): never {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

async function cmdGenerate(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: 'string', short: 'i', default: 'design-system.json' },
      format: { type: 'string', short: 'f', default: 'bricks' },
      out: { type: 'string', short: 'o', default: 'dist' },
      site: { type: 'string' },
      theme: { type: 'string' },
      'site-env': { type: 'string' },
    },
    allowPositionals: false,
  });
  const input = resolve(values.input as string);
  if (!existsSync(input)) fail(`config not found: ${input}`);
  const site = values.site ? resolve(values.site as string) : undefined;
  if (site && !existsSync(site)) fail(`site config not found: ${site}`);
  const formats = (values.format as string)
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
  for (const f of formats)
    if (!FORMATS.has(f as Format))
      fail(`unknown format "${f}" (expected: bricks | css | tailwind | design)`);

  for (const format of formats as Format[]) {
    try {
      const res = await generate({
        input,
        format,
        outDir: values.out as string,
        ...(site ? { site } : {}),
        ...(values.theme ? { theme: values.theme as string } : {}),
        ...(values['site-env'] ? { siteEnv: values['site-env'] as string } : {}),
      });
      console.log(`✓ ${format} → ${res.outDir} (${res.written.length} paths)`);
    } catch (err) {
      fail((err as Error).message);
    }
  }
}

function cmdInit(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      out: { type: 'string', short: 'o', default: 'design-system.json' },
      force: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });
  const out = resolve(values.out as string);
  if (existsSync(out) && !values.force) fail(`${out} already exists (use --force to overwrite)`);
  writeFileSync(out, JSON.stringify(defaultConfig(), null, 2) + '\n');
  console.log(`✓ wrote ${out}`);
  console.log(
    `  Edit it, then: vitops generate --input ${values.out} --format tailwind --out src/styles`,
  );
  console.log(`  Editors read the "$schema" (${SCHEMA_URL}) for autocomplete + validation.`);
}

/**
 * Validate a config against the schema its shape says it is.
 *
 * Routing on kind rather than asking the caller matters here: pointed at a site
 * config, the design-system schema used to report a single `unrecognized_keys`
 * for `designSystem` and nothing about the file's actual contents — a wrong
 * answer that reads like a right one. A site config is validated whole, which
 * also covers the cross-field integrity JSON Schema can't express.
 */
function cmdValidate(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { input: { type: 'string', short: 'i' }, 'site-env': { type: 'string' } },
    allowPositionals: true,
  });
  const path = resolve((positionals[0] ?? values.input ?? 'design-system.json') as string);
  if (!existsSync(path)) fail(`config not found: ${path}`);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    fail(`could not parse JSON: ${(err as Error).message}`);
  }

  if (isConfig(raw)) {
    let site: Config;
    try {
      site = resolveConfig(raw, values['site-env'] as string | undefined);
    } catch (err) {
      // Already formatted as one issue per line, with field paths.
      console.error(`✖ ${path} is invalid as a site config:`);
      console.error((err as Error).message.replace(/^Invalid site config:\n/, ''));
      process.exit(1);
    }
    // Each theme is validated in turn: `validateConfig` checks the `extends` chain
    // resolves, not that what it resolves to is a complete design system, so a
    // theme could pass there and still fail to build.
    const themes = (site.designSystem?.themes ?? {}) as Parameters<typeof resolveTheme>[0];
    let bad = false;
    for (const name of Object.keys(themes)) {
      const result = validate(resolveTheme(themes, name));
      for (const w of result.warnings) console.warn(`  ! designSystem.themes.${name}: ${w}`);
      if (result.ok) continue;
      bad = true;
      console.error(`✖ ${path} — designSystem.themes.${name} is not a complete design system:`);
      for (const e of result.errors)
        console.error(`  • ${e.path.join('.') || '(root)'}: ${e.message}`);
    }
    if (bad) process.exit(1);
    const n = Object.keys(themes).length;
    console.log(`✓ ${path} is a valid site config (${n} theme${n === 1 ? '' : 's'})`);
    return;
  }

  const result = validate(raw);
  for (const w of result.warnings) console.warn(`  ! ${w}`);
  if (result.ok) {
    console.log(`✓ ${path} is valid`);
    return;
  }
  console.error(`✖ ${path} is invalid:`);
  for (const e of result.errors) console.error(`  • ${e.path.join('.') || '(root)'}: ${e.message}`);
  process.exit(1);
}

async function cmdFavicon(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: 'string', short: 'i' },
      out: { type: 'string', short: 'o', default: 'public' },
      'low-res': { type: 'string' },
      // The maskable outputs must be opaque — the OS crops them to its own shape,
      // so transparency there becomes a black frame, not "no background".
      background: { type: 'string' },
    },
    allowPositionals: false,
  });
  if (!values.input) fail('favicon: --input <svg|png> is required');
  const source = resolve(values.input as string);
  if (!existsSync(source)) fail(`source not found: ${source}`);
  try {
    const written = await generateFavicons({
      source,
      outputDir: values.out as string,
      ...(values['low-res'] ? { lowResSource: resolve(values['low-res'] as string) } : {}),
      ...(values.background ? { backgroundColor: values.background as string } : {}),
    });
    console.log(`✓ favicons → ${values.out} (${written.length} files)`);
  } catch (err) {
    fail((err as Error).message);
  }
}

const OUTPUT_KINDS = new Set<OutputKind>(['webm', 'mp4', 'poster']);

/**
 * `vitops media` — encode a directory of raw video into web-ready outputs.
 *
 * Flags only, with no config file, following `favicon`: `site.favicon` exists in
 * the schema and `cmdFavicon` still doesn't read it. The same reasoning applies
 * more strongly here — `legal`, `icons` and `indexing` are anchored to a
 * `Config` because what they emit *describes the site*, and an encoder setting
 * describes a build step.
 */
async function cmdMedia(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      raw: { type: 'string', default: 'raw' },
      out: { type: 'string', short: 'o', default: 'src/assets/processed' },
      'max-width': { type: 'string' },
      crf: { type: 'string' },
      'max-bitrate': { type: 'string' },
      audio: { type: 'boolean', default: false },
      'poster-time': { type: 'string' },
      outputs: { type: 'string' },
      manifest: { type: 'string', default: MEDIA_MANIFEST_PATH },
      force: { type: 'boolean', default: false },
      dry: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  // Parsed here rather than passed through as strings, so a typo is caught before
  // ffmpeg spends minutes encoding at a quality nobody asked for.
  const num = (flag: string, raw: string | undefined): number | undefined => {
    if (raw === undefined) return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) fail(`media: --${flag} must be a non-negative number`);
    return n;
  };

  let outputs: OutputKind[] | undefined;
  if (values.outputs) {
    outputs = (values.outputs as string).split(',').map((s) => s.trim()) as OutputKind[];
    for (const kind of outputs)
      if (!OUTPUT_KINDS.has(kind))
        fail(`media: unknown output "${kind}" (expected: webm | mp4 | poster)`);
  }

  const maxWidth = num('max-width', values['max-width'] as string | undefined);
  const crf = num('crf', values.crf as string | undefined);
  const posterTime = num('poster-time', values['poster-time'] as string | undefined);

  const config: MediaConfig = {
    ...(maxWidth !== undefined ? { maxWidth } : {}),
    ...(crf !== undefined ? { crf } : {}),
    ...(values['max-bitrate'] ? { maxBitrate: values['max-bitrate'] as string } : {}),
    ...(values.audio ? { audio: true } : {}),
    ...(posterTime !== undefined ? { posterTime } : {}),
    ...(outputs ? { outputs } : {}),
  };

  try {
    const result = await processMedia({
      raw: values.raw as string,
      out: values.out as string,
      config,
      manifest: values.manifest as string,
      force: values.force as boolean,
      dry: values.dry as boolean,
      // An encode is minutes of silence otherwise, which reads as a hang.
      onProgress: (message) => console.error(`  … ${message}`),
    });

    if (values.dry) {
      console.log(formatMediaPlan(result.plan));
      return;
    }
    console.log(
      `✓ media → ${values.out} (${result.written.length} written, ${result.skipped} unchanged)`,
    );
    for (const note of result.plan.notes) console.error(`  ! ${note}`);
  } catch (err) {
    fail((err as Error).message);
  }
}

/**
 * Read + parse + validate the design system at `path`, or exit with a message.
 *
 * `path` may be a `design-system.json` **or** the larger site config that embeds
 * one — every command that judges source against the design system (`docs`,
 * `lint`, `agents`) accepts either, so a consumer who keeps their tokens in
 * `company.json` doesn't have to maintain a second file for the tooling's sake.
 * `resolveInput` tells them apart by shape and resolves the theme.
 */
function loadDesignSystem(path: string, theme?: string): DesignSystem {
  if (!existsSync(path)) fail(`config not found: ${path}`);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    fail(`could not parse JSON: ${(err as Error).message}`);
  }
  let resolved: ResolvedInput;
  try {
    resolved = resolveInput(raw, theme != null ? { theme } : {});
  } catch (err) {
    // resolveConfig formats one issue per line; a bad --theme is one line.
    fail(`${path}: ${(err as Error).message}`);
  }
  const result = validate(resolved.designSystem);
  if (!result.ok) {
    const where = resolved.theme != null ? ` (designSystem.themes.${resolved.theme})` : '';
    console.error(`✖ ${path}${where} is invalid:`);
    for (const e of result.errors)
      console.error(`  • ${e.path.join('.') || '(root)'}: ${e.message}`);
    process.exit(1);
  }
  // Warnings go to stderr, not stdout: `vitops docs <topic>` is designed to be
  // piped, so anything here must not land in the piped document. They used to
  // be dropped entirely on this path, which meant `docs` and `agents` stayed
  // silent about collisions that `generate` and `validate` both reported.
  for (const w of result.warnings) console.warn(`  ! ${w}`);
  return result.data;
}

/**
 * Read + resolve a site config, or exit with a message.
 *
 * Accepts JSON, or a JS/TS module with a default export — deliberately not YAML,
 * which would mean a parser dependency for one command. `resolveConfig` is
 * documented as taking an already-parsed object precisely so the loader is the
 * consumer's choice; anyone on YAML can convert it or export from a module.
 */
async function loadConfig(path: string, siteEnv: string): Promise<Config> {
  if (!existsSync(path)) fail(`site config not found: ${path}`);
  let raw: unknown;
  if (/\.(json)$/.test(path)) {
    try {
      raw = JSON.parse(readFileSync(path, 'utf8'));
    } catch (err) {
      fail(`could not parse JSON: ${(err as Error).message}`);
    }
  } else {
    try {
      raw = (await import(pathToFileURL(path).href)).default;
    } catch (err) {
      fail(`could not import ${path}: ${(err as Error).message}`);
    }
    if (raw == null) fail(`${path} has no default export`);
  }
  try {
    return resolveConfig(raw, siteEnv);
  } catch (err) {
    // resolveConfig already formats one issue per line.
    fail((err as Error).message);
  }
}

/**
 * Render the site's legal documents.
 *
 * The universal delivery path: every consumer has this CLI regardless of stack,
 * so a WordPress theme, an Eleventy build or a hand-written HTML site all get
 * the same documents without any integration code. Prints to stdout like
 * `vitops docs`, or writes files when given `--out`.
 */
/**
 * Report the icon vocabulary a project actually uses, and optionally build the
 * sprite from it.
 *
 * A sibling of `legal` rather than a widening of `lint`: `lint` judges classes
 * against a design-system.json, whereas icons are anchored to a Config.
 *
 * Exit codes carry the same distinction the Astro integration makes. A name the
 * config DECLARES but that doesn't resolve is a config error and fails the
 * command; a name only the SCAN found is reported and tolerated, because a bare
 * unmapped name is more often a local src/icons/*.svg than a mistake. Runtime-
 * computed names are listed with file and line so they can be declared, never
 * guessed at.
 */
async function cmdIcons(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      site: { type: 'string', default: 'site.json' },
      src: { type: 'string', default: 'src' },
      sprite: { type: 'boolean', default: false },
      out: { type: 'string', short: 'o', default: 'dist' },
      json: { type: 'boolean', default: false },
      'site-env': { type: 'string', default: 'production' },
    },
    allowPositionals: false,
  });

  const sitePath = resolve(values.site as string);
  const icons = existsSync(sitePath)
    ? (((await loadConfig(sitePath, values['site-env'] as string)).site.icons ?? {}) as Record<
        string,
        unknown
      >)
    : {};
  const ui = (icons.ui as string) ?? 'fa7-solid';
  const brand = (icons.brand as string) ?? 'simple-icons';
  const weight = icons.weight as string | undefined;
  const weightOpt = weight ? { weight } : {};

  // Declared first — this throws on an unresolvable name, by design.
  let include: Record<string, string[]> = {};
  try {
    include = generateIconInclude({ ...(icons as object) } as Parameters<
      typeof generateIconInclude
    >[0]);
  } catch (e) {
    fail((e as Error).message);
  }
  const add = (prefix: string, name: string) => {
    const list = (include[prefix] ??= []);
    if (!list.includes(name)) list.push(name);
  };

  const srcDir = resolve(values.src as string);
  const scanned = existsSync(srcDir) ? collectIconRefs(scanFiles(srcDir)) : null;
  const unmapped: string[] = [];
  for (const name of scanned?.names ?? []) {
    const colon = name.indexOf(':');
    if (colon > 0) {
      add(name.slice(0, colon), name.slice(colon + 1));
      continue;
    }
    try {
      const q = resolveIcon(name, ui, weightOpt);
      add(q.slice(0, q.indexOf(':')), q.slice(q.indexOf(':') + 1));
    } catch {
      unmapped.push(name);
    }
  }

  const dynamic = (scanned?.dynamic ?? []).map((d) => ({
    file: relative(process.cwd(), d.file),
    line: d.line,
    expr: d.expr,
  }));
  const total = Object.values(include).flat().length;

  let sprite: { ids: string[]; missing: string[] } | null = null;
  if (values.sprite) {
    const aliases: Record<string, string> = {};
    for (const name of (icons.semantic as string[]) ?? []) {
      try {
        aliases[`icon-${name}`] = resolveIcon(name, ui, weightOpt);
      } catch {
        /* already reported by generateIconInclude above */
      }
    }
    const built = await buildIconSprite({ include, aliases });
    const outDir = resolve(values.out as string);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'icons.svg'), built.svg);
    sprite = { ids: built.ids, missing: built.missing };
  }

  if (values.json) {
    process.stdout.write(
      `${JSON.stringify({ ui, brand, weight: weight ?? null, include, unmapped, dynamic, sprite }, null, 2)}\n`,
    );
  } else {
    console.log(`icon sets: ui=${ui} brand=${brand}${weight ? ` weight=${weight}` : ''}`);
    for (const [prefix, names] of Object.entries(include))
      console.log(`  ${prefix}: ${names.length} — ${names.join(', ')}`);
    console.log(`✓ ${total} icon(s) across ${Object.keys(include).length} set(s)`);
    if (sprite)
      console.log(
        `✓ sprite → ${resolve(values.out as string)}/icons.svg (${sprite.ids.length} symbols)`,
      );
    for (const d of dynamic)
      console.log(`  ! ${d.file}:${d.line}  ${d.expr} — computed at runtime, declare it in icons`);
    if (unmapped.length)
      console.log(
        `  ! not in the '${ui}' map: ${unmapped.join(', ')} (fine for a local svg or sprite id)`,
      );
    if (sprite?.missing.length)
      console.log(`  ! absent from the sprite: ${sprite.missing.join(', ')}`);
  }

  // Dynamic holes and unmapped bare names are warnings, not failures — same
  // tolerance `lint` shows template holes, but visible rather than silent.
  if (sprite?.missing.length) process.exitCode = 1;
}

async function cmdLegal(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: 'string', short: 'i', default: 'site.json' },
      doc: { type: 'string', short: 'd', multiple: true },
      format: { type: 'string', short: 'f', default: 'md' },
      out: { type: 'string', short: 'o' },
      'site-env': { type: 'string', default: 'production' },
    },
    allowPositionals: false,
  });

  const output = values.format as LegalOutput;
  if (!LEGAL_OUTPUTS.has(output))
    fail(`unknown format "${output}" (expected: ${[...LEGAL_OUTPUTS].join(' | ')})`);

  const requested = (values.doc ?? []) as string[];
  for (const d of requested)
    if (!LEGAL_DOCS.has(d as LegalDoc))
      fail(`unknown doc "${d}" (expected: ${[...LEGAL_DOCS].join(' | ')})`);

  const site = await loadConfig(resolve(values.input as string), values['site-env'] as string);
  const docs = requested.length ? (requested as LegalDoc[]) : enabledDocs(site);
  if (docs.length === 0)
    fail(
      'no legal documents are enabled — set site.legal.privacyPolicy.enabled (or termsOfService / cookieConsent) in your config, or name one with --doc',
    );

  const files = generateLegal(site, { docs, output });

  if (!values.out) {
    process.stdout.write(Object.values(files).join('\n'));
    return;
  }
  const outDir = resolve(values.out as string);
  mkdirSync(outDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) writeFileSync(join(outDir, name), content);
  console.log(`✓ legal → ${outDir} (${Object.keys(files).length} files)`);
  console.log(
    '  These are generated from your config and are not legal advice — review them before publishing.',
  );
}

/**
 * Adapt a `Config` to the indexing module's own option shape.
 *
 * A flat field map, as intended: `@getvitops/utils` cannot import from the
 * generator (the generator already depends on it), so `IndexingConfig` mirrors the
 * `seo.indexing` block rather than being it. The one piece of judgment here is the
 * origin — see below.
 */
function toIndexingConfig(cfg: Config, siteEnv: string): IndexingConfig {
  const site = cfg.site;
  const indexing = site.seo?.indexing ?? {};
  const env = site.environments?.[siteEnv];
  /*
   * The environment's own URL wins over `domains.canonical`.
   *
   * `domains.canonical` is the production origin — it is what absolute URLs and
   * SEO tags resolve against. Notifying a non-production environment while
   * deriving URLs from the canonical origin would submit *production* URLs under
   * the belief they were staging's, which the noindex gate below would then not
   * catch, because the gate reads the environment and the URLs would not.
   */
  const canonical = env?.url ?? site.domains?.canonical;
  return {
    ...(canonical ? { canonical } : {}),
    ...(indexing.sitemapUrl ? { sitemapUrl: indexing.sitemapUrl } : {}),
    ...(indexing.indexNow ? { indexNow: indexing.indexNow } : {}),
    ...(indexing.searchConsole ? { searchConsole: indexing.searchConsole } : {}),
    ...(indexing.priorityUrls ? { priorityUrls: indexing.priorityUrls } : {}),
    // Fall back to the site-wide policy so a site that states `noindex` once,
    // globally, is still protected.
    ...((env?.robots ?? site.seo?.robots) ? { robots: env?.robots ?? site.seo?.robots } : {}),
  };
}

/**
 * The Search Console credential, from either supported source.
 *
 * Never from the config file: it is the one genuine secret in this command, and a
 * `site.json` is committed. Returns `undefined` rather than failing, so a site
 * running IndexNow alone doesn't need a GCP project at all.
 */
function loadServiceAccount(): ServiceAccount | undefined {
  const inline = process.env.VITOPS_GSC_SERVICE_ACCOUNT;
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const raw = inline ?? (path && existsSync(path) ? readFileSync(path, 'utf8') : undefined);
  if (!raw) return undefined;
  try {
    return parseServiceAccount(raw);
  } catch (err) {
    fail(
      `${inline ? 'VITOPS_GSC_SERVICE_ACCOUNT' : `GOOGLE_APPLICATION_CREDENTIALS (${path})`}: ${(err as Error).message}`,
    );
  }
}

/** Read a sitemap from a URL or a local path. */
const readSitemap = async (source: string): Promise<string> => {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source);
    if (!res.ok) fail(`could not fetch ${source}: ${res.status}`);
    return res.text();
  }
  if (!existsSync(source)) fail(`sitemap not found: ${source}`);
  return readFileSync(source, 'utf8');
};

/**
 * Tell search engines a deploy happened.
 *
 * Worth being precise about what this is, because the obvious expectation is
 * wrong: **Google has no API that requests indexing.** The Search Console button
 * is not exposed anywhere, URL Inspection is read-only, and the sitemap ping
 * endpoint was removed in 2023. So the Google half of this command resubmits the
 * sitemap and then *verifies* the outcome with `--check`; the immediate-push half
 * is IndexNow, which Google does not participate in.
 *
 * The Indexing API is deliberately absent — see `@getvitops/utils/indexing`'s
 * `gsc.ts`.
 */
async function cmdSearchNotify(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: 'string', short: 'i', default: 'site.json' },
      'site-env': { type: 'string', default: 'production' },
      sitemap: { type: 'string' },
      urls: { type: 'string' },
      all: { type: 'boolean', default: false },
      dry: { type: 'boolean', default: false },
      check: { type: 'boolean', default: false },
      'new-key': { type: 'boolean', default: false },
      'write-key': { type: 'string' },
      snapshot: { type: 'string', default: SNAPSHOT_PATH },
    },
    allowPositionals: false,
  });

  // Stands alone: generating a key is what you do *before* there is a config to
  // put it in.
  if (values['new-key']) {
    const key = newKey();
    console.log(key);
    console.log(
      `\n  Add to your site config:\n    "seo": { "indexing": { "indexNow": { "key": "${key}" } } }`,
    );
    console.log(`  Then serve it at /${key}.txt — \`vitops search notify --write-key public\`.`);
    return;
  }

  const site = await loadConfig(resolve(values.input as string), values['site-env'] as string);
  const config = toIndexingConfig(site, values['site-env'] as string);

  if (values['write-key'] !== undefined) {
    const key = config.indexNow?.key;
    if (!key) fail('no site.seo.indexing.indexNow.key in the config — generate one with --new-key');
    const dir = resolve(values['write-key']);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${key}.txt`);
    writeFileSync(file, keyFileContents(key));
    console.log(`✓ IndexNow key file → ${file}`);
    console.log(`  It must be served at ${resolveKeyLocation(config) ?? `/${key}.txt`}`);
    return;
  }

  const sitemapUrl = (values.sitemap as string | undefined) ?? resolveSitemapUrl(config);
  if (!sitemapUrl)
    fail(
      'no sitemap to read — set seo.indexing.sitemapUrl or domains.canonical, or pass --sitemap',
    );

  const explicitUrls = values.urls
    ? (values.urls as string)
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean)
    : undefined;

  // The sitemap is only needed when the URL set comes from it.
  const current =
    explicitUrls?.length && !values.check
      ? []
      : (await collectEntries(sitemapUrl, readSitemap)).entries;

  const snapshotPath = resolve(values.snapshot as string);
  const p = plan({
    config: { ...config, sitemapUrl },
    current,
    previous: readSnapshot(snapshotPath),
    explicitUrls,
    all: values.all as boolean,
  });

  console.log(formatPlan(p));

  if (p.blocked) {
    // Not a failure. Running this against a `noindex` environment is a coherent
    // thing for a deploy script to do — the config said not to index it, and the
    // command honoured that. Failing the build would punish the correct setup.
    return;
  }
  if (values.dry) {
    console.log('\n(--dry: nothing was submitted)');
    return;
  }

  const account = loadServiceAccount();
  let failed = false;

  // ── --check: read-only, and nothing else runs ───────────────────────────────
  if (values.check) {
    if (!p.searchConsole.siteUrl)
      fail('--check needs seo.indexing.searchConsole.siteUrl (the Search Console property)');
    if (!account)
      fail(
        '--check needs a Search Console service account in VITOPS_GSC_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS',
      );
    if (p.check.length === 0)
      fail('--check needs seo.indexing.priorityUrls — the pages whose indexing matters');

    const token = await getAccessToken(account);
    console.log(`\nInspecting ${p.check.length} priority URL(s):`);
    for (const url of p.check) {
      const r = await inspectUrl(token, p.searchConsole.siteUrl, url);
      if (r.error) {
        console.log(`  ? ${url} — ${r.error}`);
        failed = true;
      } else {
        console.log(
          `  ${r.indexed ? '✓' : '✗'} ${url} — ${r.coverageState ?? r.verdict ?? 'unknown'}`,
        );
        if (!r.indexed) failed = true;
      }
    }
    if (failed) {
      console.error('\n✖ one or more priority URLs are not indexed');
      process.exit(1);
    }
    console.log('\n✓ every priority URL is indexed');
    return;
  }

  // ── IndexNow ────────────────────────────────────────────────────────────────
  if (p.indexNow.enabled) {
    const { key, keyLocation } = p.indexNow;
    const check = await verifyKeyFile(keyLocation!, key!);
    if (!check.ok) {
      // Hard stop rather than "submit and hope": IndexNow answers 202 and then
      // discards the batch when the key doesn't verify, so submitting anyway
      // would print a success it did not earn.
      console.error(`✖ IndexNow key file check failed — ${check.reason}`);
      console.error(`  Write it with: vitops search notify --write-key <public dir>`);
      failed = true;
    } else {
      let sent = 0;
      for (const batch of p.indexNow.batches) {
        const r = await submitBatch(p.indexNow, batch);
        if (!r.ok) {
          console.error(`✖ IndexNow: ${r.message ?? r.status}`);
          failed = true;
          break;
        }
        sent += r.urls;
      }
      if (!failed) console.log(`✓ IndexNow: ${sent} URL(s) submitted`);
    }
  }

  // ── Search Console ──────────────────────────────────────────────────────────
  if (p.searchConsole.enabled) {
    if (!account) {
      console.log(
        '· Search Console: skipped — no VITOPS_GSC_SERVICE_ACCOUNT / GOOGLE_APPLICATION_CREDENTIALS',
      );
    } else {
      const token = await getAccessToken(account);
      const r = await submitSitemap(token, p.searchConsole.siteUrl!, sitemapUrl);
      if (r.ok) console.log(`✓ Search Console: sitemap resubmitted`);
      else {
        console.error(`✖ Search Console: ${r.message}`);
        failed = true;
      }
    }
  }

  if (failed) process.exit(1);

  /*
   * The snapshot is written last, and only on success.
   *
   * Writing it eagerly would record URLs as notified that never were — and since
   * the next run diffs against it, a single transient 503 would drop those pages
   * from every future run, silently and permanently.
   */
  if (current.length > 0) {
    writeSnapshot(snapshotPath, toSnapshot(sitemapUrl, current, new Date().toISOString()));
    console.log(`  state → ${relative(process.cwd(), snapshotPath)}`);
  }
  if (p.check.length > 0)
    console.log(
      `\n  Indexing is not instant. Run \`vitops search notify --check\` in a day or two to see what Google actually did.`,
    );
}

/**
 * Adapt a `Config` to the onboarding module's own option shape.
 *
 * The same flat field map as `toIndexingConfig`, and for the same reason — utils
 * cannot import the generator. `--domain` scopes to a single `site.searchConsole`
 * entry, and a name that isn't there is an error, not an empty run.
 */
function toSearchConsoleSetup(cfg: Config, domainFilter: string | undefined): DomainSetup[] {
  const entries = cfg.site.searchConsole ?? {};
  const setups: DomainSetup[] = Object.entries(entries).map(([domain, e]) => ({
    domain,
    ...(e.delegatedOwners ? { delegatedOwners: e.delegatedOwners } : {}),
    ...(e.fullUserGroup ? { fullUserGroup: e.fullUserGroup } : {}),
  }));
  if (domainFilter) {
    const one = setups.find((s) => s.domain === domainFilter);
    if (!one)
      fail(
        `--domain "${domainFilter}" is not in site.searchConsole (have: ${setups.map((s) => s.domain).join(', ') || 'none'})`,
      );
    return [one];
  }
  return setups;
}

/**
 * The Cloudflare DNS credential. From the environment only — a `site.json` is
 * committed, and this is a real secret. A `Zone:DNS:Edit` token (the standard
 * "Edit zone DNS" template, which also carries `Zone:Read`).
 */
function loadCloudflareToken(): string | undefined {
  return process.env.CLOUDFLARE_API_TOKEN || undefined;
}

/**
 * The Google user-OAuth credential (refresh-token flow), from the environment.
 *
 * A user token, not a service account: onboarding acts *as a person* who can own
 * the sites. All-or-nothing — a partial set is a misconfiguration worth naming
 * rather than a reason to run degraded.
 */
function loadGoogleOAuth(): GoogleOAuth | undefined {
  const clientId = process.env.VITOPS_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.VITOPS_GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.VITOPS_GOOGLE_REFRESH_TOKEN;
  if (!clientId && !clientSecret && !refreshToken) return undefined;
  const missing = [
    ['VITOPS_GOOGLE_CLIENT_ID', clientId],
    ['VITOPS_GOOGLE_CLIENT_SECRET', clientSecret],
    ['VITOPS_GOOGLE_REFRESH_TOKEN', refreshToken],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) fail(`incomplete Google OAuth credential — missing ${missing.join(', ')}`);
  return { clientId: clientId!, clientSecret: clientSecret!, refreshToken: refreshToken! };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * `vitops search` — everything that talks to search engines.
 *
 * Two subcommands, split by what they touch: `setup` onboards a domain into
 * Search Console (DNS + verification + property), `notify` tells the engines a
 * deploy happened (sitemap + IndexNow). `notify` is the former top-level
 * `vitops indexing`.
 */
async function cmdSearch(argv: string[]) {
  const [sub, ...rest] = argv;
  switch (sub) {
    case 'setup':
      return cmdSearchSetup(rest);
    case 'notify':
      return cmdSearchNotify(rest);
    case undefined:
    case '-h':
    case '--help':
      console.log(SEARCH_HELP);
      return;
    default:
      fail(`unknown "search" subcommand "${sub}" (expected: setup | notify). Try: vitops --help`);
  }
}

/**
 * Onboard domains into Google Search Console as domain properties.
 *
 * Idempotent by construction: the planner decides each step from the domain's live
 * state, so a re-run of a fully-onboarded domain is all skips. `--check` reports
 * drift and exits non-zero without mutating; `--dry` prints the plan and stops.
 * DNS is only ever *created* — the verification TXT — never edited or removed.
 *
 * Search Console has no user/permission API, so granting a Google Group Full-User
 * access stays manual and is surfaced as a reminder, not attempted.
 */
async function cmdSearchSetup(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: 'string', short: 'i', default: 'site.json' },
      'site-env': { type: 'string', default: 'production' },
      domain: { type: 'string' },
      check: { type: 'boolean', default: false },
      dry: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  const cfg = await loadConfig(resolve(values.input as string), values['site-env'] as string);
  const domains = toSearchConsoleSetup(cfg, values.domain as string | undefined);
  if (domains.length === 0)
    fail('no domains in site.searchConsole — add domains to onboard (keyed by bare hostname)');

  const cfToken = loadCloudflareToken();
  const oauth = loadGoogleOAuth();
  if (!cfToken)
    fail('set CLOUDFLARE_API_TOKEN (a Zone:DNS:Edit token) — reading and writing DNS needs it');
  if (!oauth)
    fail(
      'set VITOPS_GOOGLE_CLIENT_ID / VITOPS_GOOGLE_CLIENT_SECRET / VITOPS_GOOGLE_REFRESH_TOKEN — a user OAuth token scoped to siteverification + webmasters',
    );

  const token = await getGoogleToken(oauth);

  // ── Observe live state per domain (the executors gather; the planner decides) ──
  const states = new Map<string, DomainState>();
  const verifyTokens = new Map<string, string>();
  const webIds = new Map<string, string>();
  for (const d of domains) {
    const zone = await findZoneId(cfToken, d.domain);
    if (!zone.ok || !zone.zoneId) fail(`${d.domain}: ${zone.message}`);

    const vt = await getVerificationToken(token, d.domain);
    if (!vt.ok || !vt.token)
      fail(`${d.domain}: could not obtain a verification token — ${vt.message}`);
    verifyTokens.set(d.domain, vt.token);

    const txt = await listApexTxt(cfToken, zone.zoneId, d.domain);
    if (!txt.ok) fail(`${d.domain}: ${txt.message}`);

    const wr = await getWebResource(token, d.domain);
    if (!wr.ok) fail(`${d.domain}: ${wr.message}`);
    if (wr.id) webIds.set(d.domain, wr.id);

    const site = await getSite(token, siteUrlFor(d.domain));
    if (!site.ok) fail(`${d.domain}: ${site.message}`);

    states.set(d.domain, {
      zoneId: zone.zoneId,
      txtPresent: txt.contents.includes(vt.token),
      verified: wr.exists,
      currentOwners: wr.owners,
      propertyExists: site.exists,
    });
  }

  const p = planSetup({ domains }, states);
  console.log(formatSetupPlan(p));

  if (values.check) {
    if (hasDrift(p)) {
      console.error('\n✖ drift — one or more domains are not fully onboarded');
      process.exit(1);
    }
    console.log('\n✓ every domain is onboarded');
    return;
  }
  if (values.dry) {
    console.log('\n(--dry: nothing was changed)');
    return;
  }

  // ── Execute ─────────────────────────────────────────────────────────────────
  const results: DomainResult[] = [];
  let failed = false;
  const delays = backoffSchedule();

  for (const d of domains) {
    const dp = p.domains.find((x) => x.domain === d.domain)!;
    const state = states.get(d.domain)!;
    const result: DomainResult = {
      domain: d.domain,
      txt: '—',
      verified: '—',
      property: '—',
      reminders: dp.reminders,
    };

    // 1. Ensure the apex TXT record (create only).
    if (dp.txt.action === 'skip') result.txt = 'present';
    else {
      const r = await createApexTxt(cfToken, state.zoneId!, d.domain, verifyTokens.get(d.domain)!);
      if (!r.ok) {
        console.error(`✖ ${d.domain} TXT: ${r.message}`);
        result.txt = 'failed';
        failed = true;
        results.push(result);
        continue;
      }
      result.txt = 'created';
    }

    // 2. Verify ownership, retrying with backoff while DNS propagates.
    let verified = state.verified;
    if (verified) result.verified = 'yes';
    else {
      for (let attempt = 0; attempt < delays.length; attempt++) {
        const v = await verifyWebResource(token, d.domain);
        if (v.ok) {
          verified = true;
          if (v.id) webIds.set(d.domain, v.id);
          // Verification is what CREATES the web resource, so this response is the
          // first sight of its owner list — and it contains the verifying account.
          // The pre-verification observation could only report `[]`. Dropping this
          // makes the union below a bare `ownersToAdd`, and the PUT then removes
          // the very account that just proved ownership.
          state.currentOwners = v.owners;
          break;
        }
        if (attempt < delays.length - 1) {
          const wait = delays[attempt]!;
          console.log(
            `  … ${d.domain}: not verified yet (attempt ${attempt + 1}/${delays.length}); retrying in ${wait / 1000}s`,
          );
          await sleep(wait);
        }
      }
      // PENDING, not failed: propagation is slow, not broken. Re-run later.
      result.verified = verified ? 'yes' : 'pending';
    }
    if (!verified) {
      results.push(result);
      continue;
    }

    // 3. Add the Search Console property.
    if (dp.property.action === 'skip') result.property = 'present';
    else {
      const r = await addSite(token, dp.siteUrl);
      if (!r.ok) {
        console.error(`✖ ${d.domain} property: ${r.message}`);
        result.property = 'failed';
        failed = true;
      } else result.property = 'added';
    }

    // 4. Add delegated owners to the verified web resource (additive union).
    if (dp.owners.action === 'update' && dp.ownersToAdd.length) {
      const id = webIds.get(d.domain);
      if (!id) {
        console.error(`✖ ${d.domain} owners: no web-resource id (verify may be too fresh)`);
        failed = true;
      } else {
        const r = await updateOwners(
          token,
          id,
          d.domain,
          ownerUnion(state.currentOwners, dp.ownersToAdd),
        );
        if (!r.ok) {
          console.error(`✖ ${d.domain} owners: ${r.message}`);
          failed = true;
        } else console.log(`✓ ${d.domain}: added ${dp.ownersToAdd.length} owner(s)`);
      }
    }

    results.push(result);
  }

  console.log(`\n${formatSummary(results)}`);
  if (failed) process.exit(1);
}

// This CLI's own version (dist/cli.mjs → package-root package.json).
function cliVersion(): string {
  try {
    return (
      JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version ??
      '0.0.0'
    );
  } catch {
    return '0.0.0';
  }
}

// The framework asset root shipped inside @getvitops/generator (holds the Bricks
// PHP that generateDocs reads for the element reference).
function generatorAssetsDir(): string {
  const pkg = createRequire(import.meta.url).resolve('@getvitops/generator/package.json');
  return join(dirname(pkg), 'assets');
}

const AGENTS_START = '<!-- vitops:start -->';
const AGENTS_END = '<!-- vitops:end -->';

/** Print a live reference doc (rendered from the project's config) to stdout. */
function cmdDocs(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      input: { type: 'string', short: 'i', default: 'design-system.json' },
      theme: { type: 'string' },
      all: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });
  const topic = positionals[0];
  const topicList = () =>
    Object.entries(TOPICS)
      .map(([name, t]) => `  ${name.padEnd(10)} ${t.summary}`)
      .join('\n');
  if (!topic && !values.all) {
    console.log(
      `vitops docs <topic> — print a live design-system reference to stdout\n\nTopics:\n${topicList()}\n\nAlso: vitops docs --all (every topic, concatenated)`,
    );
    return;
  }
  if (topic && !TOPICS[topic]) fail(`unknown topic "${topic}". Valid topics:\n${topicList()}`);
  const ds = loadDesignSystem(resolve(values.input as string), values.theme as string | undefined);
  const docs = generateDocs(ds, generatorAssetsDir());
  const paths = values.all
    ? Object.values(TOPICS).map((t) => t.path)
    : [TOPICS[topic as string]!.path];
  process.stdout.write(paths.map((p) => docs[p]).join('\n'));
}

function cmdLint(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: 'string', short: 'i', default: 'design-system.json' },
      theme: { type: 'string' },
      format: { type: 'string', short: 'f', default: 'bricks' },
      src: { type: 'string', short: 's', default: 'src' },
      // Suggestions are advisory: a reuse rule that failed CI the day it shipped
      // would be a worse defect than the drift it reports.
      strict: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });
  const format = values.format as StylesheetFormat;
  if (!LINT_FORMATS.has(format))
    fail(`unknown format "${format}" (expected: bricks | css | tailwind)`);
  const ds = loadDesignSystem(resolve(values.input as string), values.theme as string | undefined);
  const srcDir = resolve(values.src as string);
  if (!existsSync(srcDir)) fail(`source directory not found: ${srcDir}`);

  // Ask the generator what it actually emits rather than re-deriving the rules
  // here — a linter that models the vocabulary separately just drifts into
  // reporting classes that do exist.
  const palette = expandPalette(ds.colors.palette);
  const roleClasses = roleColorUtilities(
    Object.entries(ds.colors.roles).map(([role, spec]) =>
      functionalRole(role, roleHue(spec), palette[roleHue(spec)]!, roleKind(spec)),
    ),
    ds.colors.utilities ?? ['bg', 'text', 'icon', 'border'],
  ).map((u) => u.cls);

  const files = scanFiles(srcDir);
  // `.css` is not in the default extension set — the class linter reads markup,
  // not stylesheets — so the reuse rules get their own pass. Component files are
  // scanned twice on purpose: once for their class attributes, once for any
  // `<style>` block, which is where hand-rolled layout tends to accumulate.
  const cssFiles = [...files, ...scanFiles(srcDir, { exts: ['.css'] })];
  const findings = [
    ...lintSource(files, vocabulary(ds, roleClasses), format),
    ...lintCss(cssFiles, format),
  ];

  if (!findings.length) {
    console.log(
      `✓ no unresolvable framework classes in ${values.src} ` +
        `(${files.length} file${files.length === 1 ? '' : 's'} scanned)`,
    );
    return;
  }

  const errors = findings.filter((f) => f.severity === 'error');
  const suggestions = findings.filter((f) => f.severity === 'suggestion');
  // Errors first: a class that resolves to nothing is a defect, a reuse
  // suggestion is a judgement call, and mixing them buries the former.
  for (const f of [...errors, ...suggestions]) {
    console.error(`${f.file}:${f.line}  ${f.severity === 'error' ? f.cls : `(${f.cls})`}`);
    console.error(`    ${f.reason}`);
    if (f.suggestion) console.error(`    try: ${f.suggestion}`);
  }

  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const parts: string[] = [];
  if (errors.length) parts.push(count(errors.length, 'unresolvable class', 'unresolvable classes'));
  if (suggestions.length) parts.push(count(suggestions.length, 'suggestion', 'suggestions'));
  const failing = errors.length > 0 || (values.strict === true && suggestions.length > 0);
  console.error(
    `\n${failing ? '✖' : '!'} ${parts.join(', ')} in ` +
      `${files.length} file${files.length === 1 ? '' : 's'}` +
      (suggestions.length && !values.strict ? ' (suggestions do not fail; use --strict)' : ''),
  );
  if (failing) process.exit(1);
}

function cmdAgents(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: 'string', short: 'i', default: 'design-system.json' },
      theme: { type: 'string' },
      out: { type: 'string', short: 'o', default: 'AGENTS.md' },
      'docs-dir': { type: 'string' },
    },
    allowPositionals: false,
  });
  const inputRel = values.input as string;
  // The command is pure wiring: validate the config when present (fail on an
  // invalid one), but don't require it — docs are rendered live by `vitops docs`.
  let ds: DesignSystem | null = null;
  if (existsSync(resolve(inputRel)))
    ds = loadDesignSystem(resolve(inputRel), values.theme as string | undefined);
  else console.warn(`  ⚠ ${inputRel} not found — run \`vitops init\` to scaffold one`);

  // Explicit --docs-dir = legacy layout: write the docs bundle as files, no skill.
  const legacyDocsDir = values['docs-dir'] as string | undefined;
  let summary: string;
  let pointer: string[];

  if (legacyDocsDir) {
    if (!ds) fail(`--docs-dir needs a config to render docs from (${inputRel} not found)`);
    let docs: Record<string, string> = {};
    try {
      docs = generateDocs(ds, generatorAssetsDir());
    } catch (err) {
      fail(`could not generate docs: ${(err as Error).message}`);
    }
    for (const [rel, content] of Object.entries(docs)) {
      const p = resolve(legacyDocsDir, rel);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, content);
    }
    summary = `wrote ${Object.keys(docs).length} docs to ${legacyDocsDir}/`;
    pointer = [
      'Prefer the framework’s utility + component classes over hand-written CSS.',
      `Reference docs (regenerate with \`vitops agents --docs-dir ${legacyDocsDir}\`): \`${legacyDocsDir}/css/classes.md\`,`,
      `\`${legacyDocsDir}/authoring.md\`, \`${legacyDocsDir}/formats.md\`, \`${legacyDocsDir}/bricks/elements.md\`.`,
    ];
  } else {
    // Link the packaged skill (ships inside @getvitops/cli) into the agent
    // discovery locations; nothing is generated into the repo.
    const target = findSkillTarget(process.cwd());
    if (target) {
      for (const dir of ['.agents', '.claude']) {
        const warn = linkSkill(resolve(dir, 'skills', SKILL_NAME), target);
        if (warn) console.warn(`  ⚠ ${warn}`);
      }
      summary = `linked {.agents,.claude}/skills/${SKILL_NAME} → ${target}`;
    } else {
      console.warn(
        `  ⚠ could not find node_modules/@getvitops/cli/skill — install @getvitops/cli as a devDependency, then re-run \`vitops agents\``,
      );
      summary = 'no skill linked';
    }
    pointer = [
      'Prefer the framework’s utility + component classes over hand-written CSS.',
      `Full design-system context lives in the \`${SKILL_NAME}\` skill (linked from`,
      '`.agents/skills/` and `.claude/skills/` into the installed `@getvitops/cli`;',
      're-link with `vitops agents` if the links are deleted — they survive version',
      'bumps). Reference docs print live, from this project’s config, via:',
      '',
      ...Object.entries(TOPICS).map(([name, t]) => `- \`vitops docs ${name}\` — ${t.summary}`),
    ];
  }

  const block = [
    AGENTS_START,
    '## Vitops design system',
    '',
    `Styled with the Vitops design system (\`@getvitops/*\`); tokens live in \`${inputRel}\`.`,
    'Generate output with the CLI:',
    '',
    '- `vitops generate --format tailwind --out src/styles` — Tailwind v4 / Astro',
    '- `vitops generate --format css --out dist` — standalone CSS',
    '- `vitops generate --format bricks --out <theme>/dist` — WordPress / Bricks',
    '- `vitops generate --format design --out .` — `DESIGN.md`, the agent-facing brief',
    '- `vitops init` · `vitops validate` · `vitops favicon`',
    '',
    ...pointer,
    '',
    `<!-- regenerate: vitops agents · @getvitops/cli@${cliVersion()} -->`,
    AGENTS_END,
  ].join('\n');

  const outPath = resolve(values.out as string);
  let next: string;
  let action: string;
  if (existsSync(outPath)) {
    const cur = readFileSync(outPath, 'utf8');
    const s = cur.indexOf(AGENTS_START);
    const e = cur.indexOf(AGENTS_END);
    if (s !== -1 && e !== -1 && e > s) {
      next = cur.slice(0, s) + block + cur.slice(e + AGENTS_END.length);
      action = 'updated block in';
    } else {
      next = cur.replace(/\s*$/, '') + '\n\n' + block + '\n';
      action = 'appended block to';
    }
  } else {
    mkdirSync(dirname(outPath), { recursive: true });
    next = block + '\n';
    action = 'created';
  }
  writeFileSync(outPath, next);
  console.log(`✓ ${action} ${values.out} + ${summary}`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === '-h' || command === '--help' || command === 'help') {
    console.log(HELP);
    return;
  }
  switch (command) {
    case 'generate':
      return cmdGenerate(rest);
    case 'init':
      return cmdInit(rest);
    case 'validate':
      return cmdValidate(rest);
    case 'favicon':
      return cmdFavicon(rest);
    case 'agents':
      return cmdAgents(rest);
    case 'docs':
      return cmdDocs(rest);
    case 'lint':
      return cmdLint(rest);
    case 'legal':
      return cmdLegal(rest);
    case 'icons':
      return cmdIcons(rest);
    case 'search':
      return cmdSearch(rest);
    case 'media':
      return cmdMedia(rest);
    default:
      fail(
        `unknown command "${command}" (expected: generate | init | validate | favicon | agents | docs | lint | legal | icons | search | media). Try: vitops --help`,
      );
  }
}

main().catch((err) => fail((err as Error).message));
