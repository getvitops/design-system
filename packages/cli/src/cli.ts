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
 *   vitops ads       setup [--provider <name>] [--dry] [--check]  |  tags  |  lint
 *   vitops media     [--raw <dir>] [--out <dir>] [--force] [--dry]
 *
 * Thin wrapper over @getvitops/generator (generation) and @getvitops/utils (favicons).
 * Every client brings their own consumer-editable design-system.json.
 */
import { parseArgs } from 'node:util';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname, relative, extname } from 'node:path';
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
  processorsMissingLocation,
  JURISDICTION_COUNTRIES,
  isConfig,
  resolveInput,
  resolveConfig,
  resolveTheme,
  roleColorUtilities,
  functionalRole,
  expandPalette,
  roleHue,
  roleKind,
  movedTokens,
  SCHEMA_LOCAL_PATH,
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
  SCOPES,
  googleAccessToken,
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
  type GoogleCredential,
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
  refreshTokenGrant,
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
// Its own subpath for the same reason: `ads` touches Cloudflare DNS. `plan`,
// `formatPlan`, `hasDrift` and `formatSummary` are aliased — indexing and
// onboarding export those names too.
import {
  AD_PLATFORMS,
  AD_PROVIDER_KEYS,
  formatPlan as formatPlanAds,
  formatSummary as formatAdsSummary,
  hasDrift as hasAdsDrift,
  isAdProvider,
  missingFields,
  plan as planAds,
  renderTag,
  tagId,
  type AdDomainState,
  type AdPropertyResult,
  type AdPropertySetup,
  type AdProvider,
  type MissingField,
} from '@getvitops/utils/ads';
import { PLATFORM_PARAMS } from '@getvitops/utils/tracking';
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
import { ADS_HELP, COMMANDS, HELP, SEARCH_HELP, helpFor, wantsHelp } from './help.ts';
import { ask, canPrompt, missingFieldMessage, questionFor, writeConfigPatch } from './prompt.ts';
import { lintCss } from './lint-css.ts';
import { lintMarkup } from './lint-markup.ts';
import { applyRenames, lintTokens } from './lint-tokens.ts';
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
  console.log(
    `  Editors read the "$schema" (${SCHEMA_LOCAL_PATH}) for autocomplete + validation — ` +
      `the installed copy, so it matches the toolchain you build with.`,
  );
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

  /**
   * A processor placed nowhere cannot appear in the cross-border disclosure — there
   * is nothing true to say about it — so it drops out of that section silently,
   * which is the failure that looks tidy. Reported here rather than in the document:
   * a policy must not editorialise about its own gaps.
   *
   * On **stderr** because stdout is the document and gets piped or redirected.
   */
  if (docs.includes('privacy'))
    for (const name of processorsMissingLocation(site))
      console.error(
        `  ! ${name}: no country, storage or operatorCountry declared — it will not appear in the cross-border transfer disclosure. Add one, or state storage: [{ country: "${JURISDICTION_COUNTRIES[site.site.legal?.jurisdiction ?? 'ca']}" }] to say it does not leave the country.`,
      );

  const REVIEW =
    '  These are generated from your config and are not legal advice — review them before publishing.';

  if (!values.out) {
    process.stdout.write(Object.values(files).join('\n'));
    // On stderr, so it survives a redirect of the document itself. It used to be
    // omitted entirely on this path — the one path where the output is most
    // likely being piped straight into a page.
    console.error(REVIEW);
    return;
  }
  const outDir = resolve(values.out as string);
  mkdirSync(outDir, { recursive: true });
  // Enabling a document is a config edit with consequences outside the config —
  // a new file needs a page, a route, a menu link, a policyUrl. Flipping
  // `cookieConsent.enabled` silently produced `cookie-notice.*` and said only
  // "3 files", so nothing pointed at the work that had just appeared.
  const isNew = (name: string) => !existsSync(join(outDir, name));
  const added = Object.keys(files).filter(isNew);
  for (const [name, content] of Object.entries(files)) writeFileSync(join(outDir, name), content);
  console.log(`✓ legal → ${outDir}`);
  for (const name of Object.keys(files))
    console.log(`    ${name}${added.includes(name) ? '  (new)' : ''}`);
  if (added.length)
    console.log(
      added.length === 1
        ? `\n  That document is new. It needs somewhere to live: a page or route that renders it, ` +
            `and a link to it${added[0]?.startsWith('cookie') ? ' — including the URL your consent banner points at' : ''}.`
        : `\n  Those ${added.length} documents are new. Each needs somewhere to live: a page or ` +
            `route that renders it, and a link to it — for a cookie notice, including the URL your ` +
            `consent banner points at.`,
    );
  console.log(REVIEW);
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

  const credential = loadSearchCredential();
  let failed = false;

  // ── --check: read-only, and nothing else runs ───────────────────────────────
  if (values.check) {
    if (!p.searchConsole.siteUrl)
      fail('--check needs seo.indexing.searchConsole.siteUrl (the Search Console property)');
    if (!credential) fail(`--check needs a Search Console credential — ${CREDENTIAL_HINT}`);
    if (p.check.length === 0)
      fail('--check needs seo.indexing.priorityUrls — the pages whose indexing matters');

    const token = await googleAccessToken(credential);
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
    if (!credential) {
      console.log(`· Search Console: skipped — no credential (${CREDENTIAL_HINT})`);
    } else {
      const token = await googleAccessToken(credential);
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

/**
 * The Google identity for `search notify`, preferring a service account.
 *
 * Search Console accepts either, and the preference is about *where this command
 * runs*: it fires on every deploy, in CI, and a service account has no expiry,
 * while a refresh token can be revoked — and for an OAuth client still in
 * *Testing* publishing status Google expires it after 7 days, which is a bad
 * property for a deploy step. So the robot wins when it is available.
 *
 * The fallback is the point, though. `search setup` needs user OAuth (verifying
 * a site makes the caller an owner, which should be a person), so a consumer who
 * ran setup already has a Google credential. Demanding a second, unrelated one
 * for the other half of the same command bought nothing.
 */
function loadSearchCredential(): GoogleCredential | undefined {
  const account = loadServiceAccount();
  if (account) return { kind: 'service-account', account, scope: SCOPES.webmasters };
  const oauth = loadGoogleOAuth();
  return oauth ? { kind: 'oauth', oauth } : undefined;
}

/** Both spellings, for an error that has to tell you what to actually set. */
const CREDENTIAL_HINT =
  'a service account in VITOPS_GSC_SERVICE_ACCOUNT / GOOGLE_APPLICATION_CREDENTIALS, or a user OAuth credential in VITOPS_GOOGLE_CLIENT_ID / VITOPS_GOOGLE_CLIENT_SECRET / VITOPS_GOOGLE_REFRESH_TOKEN';

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

  // A dry run that mutates nothing should not demand the credentials to mutate.
  // It cannot READ live state without them either, so it plans from "nothing is
  // done yet" and says so — which is still the complete account of what a first
  // run would do, and is what makes the plan showable before anyone has
  // provisioned anything. `--check` is different: reporting drift means
  // comparing against reality, so it keeps needing to see it.
  if (values.dry && (!cfToken || !oauth)) {
    const blank: DomainState = {
      zoneId: '',
      txtPresent: false,
      verified: false,
      currentOwners: [],
      propertyExists: false,
    };
    console.log(
      formatSetupPlan(planSetup({ domains }, new Map(domains.map((d) => [d.domain, blank])))),
    );
    const missing = [
      ...(cfToken ? [] : ['CLOUDFLARE_API_TOKEN (Zone:DNS:Edit + Zone:Read)']),
      ...(oauth
        ? []
        : ['VITOPS_GOOGLE_CLIENT_ID / VITOPS_GOOGLE_CLIENT_SECRET / VITOPS_GOOGLE_REFRESH_TOKEN']),
    ];
    console.log(
      `\n(--dry, and no credentials set: planned from scratch rather than from live state, ` +
        `so nothing here is reported as already done.\n A real run needs ${missing.join(' and ')}.)`,
    );
    return;
  }

  if (!cfToken)
    fail(
      'set CLOUDFLARE_API_TOKEN (a Zone:DNS:Edit token — the standard "Edit zone DNS" template, ' +
        'which also carries the Zone:Read that the zone-by-name lookup needs)',
    );
  if (!oauth)
    fail(
      'set VITOPS_GOOGLE_CLIENT_ID / VITOPS_GOOGLE_CLIENT_SECRET / VITOPS_GOOGLE_REFRESH_TOKEN — a user OAuth token scoped to siteverification + webmasters',
    );

  const token = await refreshTokenGrant(oauth);

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

/**
 * Adapt a `Config` to the ads module's own option shape.
 *
 * The same flat field map as `toSearchConsoleSetup` and `toIndexingConfig`, for the
 * same reason — utils cannot import the generator. The domain default is the one
 * derived value: a platform verifies the host the site is published at, so
 * `domains.canonical` answers it, and only an ad account verified against some
 * other host needs `site.ads.<provider>.domain` stated.
 */
function toAdProperties(cfg: Config, providerFilter: string | undefined): AdPropertySetup[] {
  const canonicalHost = (() => {
    const url = cfg.site.domains?.canonical;
    if (!url) return undefined;
    try {
      return new URL(url).hostname;
    } catch {
      return undefined;
    }
  })();

  const entries = cfg.site.ads ?? {};
  const properties: AdPropertySetup[] = AD_PROVIDER_KEYS.filter((p) => entries[p] != null).map(
    (provider) => {
      const e = entries[provider]!;
      const domain = e.domain ?? canonicalHost;
      return {
        provider,
        ...(e.accountId ? { accountId: e.accountId } : {}),
        ...(e.pixelId ? { pixelId: e.pixelId } : {}),
        ...(e.conversionLabel ? { conversionLabel: e.conversionLabel } : {}),
        ...(domain ? { domain } : {}),
        ...(e.domainVerification ? { domainVerification: e.domainVerification } : {}),
        ...(e.category ? { category: e.category } : {}),
        ...(e.enabled != null ? { enabled: e.enabled } : {}),
      };
    },
  );

  if (providerFilter) {
    if (!isAdProvider(providerFilter))
      fail(
        `--provider "${providerFilter}" is not a known ad platform (expected: ${AD_PROVIDER_KEYS.join(' | ')})`,
      );
    const one = properties.find((p) => p.provider === providerFilter);
    if (!one)
      fail(
        `--provider "${providerFilter}" is not in site.ads (have: ${properties.map((p) => p.provider).join(', ') || 'none'})`,
      );
    return [one];
  }
  return properties;
}

/**
 * `vitops ads` — everything that links this site to an ad platform.
 *
 * Three subcommands, split by what they touch: `setup` writes DNS, `tags` writes
 * nothing and prints markup, `lint` reads and reports.
 */
async function cmdAds(argv: string[]) {
  const [sub, ...rest] = argv;
  switch (sub) {
    case 'setup':
      return cmdAdsSetup(rest);
    case 'tags':
      return cmdAdsTags(rest);
    case 'lint':
      return cmdAdsLint(rest);
    case undefined:
    case '-h':
    case '--help':
      console.log(ADS_HELP);
      return;
    default:
      fail(`unknown "ads" subcommand "${sub}" (expected: setup | tags | lint). Try: vitops --help`);
  }
}

/**
 * Link each configured ad property: ensure the platform's domain-verification TXT,
 * report what only a human can finish.
 *
 * Idempotent by construction — the planner decides each step from live DNS, so a
 * re-run of a linked property is all skips. `--check` reports drift and exits
 * non-zero without mutating; `--dry` prints the plan and stops. Neither is offline:
 * the DNS observation runs before the planner either way.
 *
 * The one thing this does that `search setup` does not is **ask**. A first run has
 * no verification token, because the token doesn't exist until someone fetches it
 * from the platform UI — so a blocked step becomes a prompt, the answer is folded
 * into the setup, and the planner runs again on it. That re-plan matters: what gets
 * executed is always a plan the pure planner produced, never a special case built
 * out of an answer.
 */
async function cmdAdsSetup(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: 'string', short: 'i', default: 'site.json' },
      'site-env': { type: 'string', default: 'production' },
      provider: { type: 'string' },
      check: { type: 'boolean', default: false },
      dry: { type: 'boolean', default: false },
      'no-prompt': { type: 'boolean', default: false },
      'no-write': { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  const input = resolve(values.input as string);
  const cfg = await loadConfig(input, values['site-env'] as string);
  let properties = toAdProperties(cfg, values.provider as string | undefined);
  if (properties.length === 0)
    fail('no properties in site.ads — add the ad platforms this site is linked to');

  const dry = values.dry as boolean;
  const check = values.check as boolean;

  // Only the DNS-verifying platforms need a Cloudflare token; a config of
  // tag-only platforms (Google Ads, LinkedIn, Reddit, Microsoft) has no DNS work
  // at all, and demanding a credential for a run that writes nothing would be an
  // obstacle standing in front of an empty room.
  const needsDns = properties.some(
    (p) => AD_PLATFORMS[p.provider].verification.method === 'dns-txt',
  );
  const cfToken = loadCloudflareToken();
  // As in `search setup`: a dry run mutates nothing, so it must not demand the
  // credential to mutate. Without one it cannot read live DNS either, so
  // `observe()` returns an empty map and the plan is "from scratch" — still the
  // complete account of a first run, and showable before anything is provisioned.
  if (needsDns && !cfToken && values.dry !== true)
    fail(
      'set CLOUDFLARE_API_TOKEN (a Zone:DNS:Edit token — the standard "Edit zone DNS" template, ' +
        'which also carries the Zone:Read that the zone-by-name lookup needs)',
    );

  /** Observe live DNS per domain. Cached by domain: several platforms share one. */
  const observe = async (): Promise<Map<string, AdDomainState>> => {
    const states = new Map<string, AdDomainState>();
    if (!cfToken) return states;
    for (const p of properties) {
      const domain = p.domain;
      if (!domain || states.has(domain)) continue;
      if (AD_PLATFORMS[p.provider].verification.method !== 'dns-txt') continue;
      const zone = await findZoneId(cfToken, domain);
      if (!zone.ok || !zone.zoneId) fail(`${domain}: ${zone.message}`);
      const txt = await listApexTxt(cfToken, zone.zoneId, domain);
      if (!txt.ok) fail(`${domain}: ${txt.message}`);
      states.set(domain, { zoneId: zone.zoneId, txtContents: txt.contents });
    }
    return states;
  };

  let states = await observe();
  let adsPlan = planAds({ properties }, states);

  // ── Ask for what the config is missing, then re-plan on the answers ──────────
  const interactive = canPrompt({
    dry,
    check,
    noPrompt: values['no-prompt'] as boolean,
  });
  const gaps = missingFields(adsPlan);
  if (gaps.length && interactive) {
    const answers: { provider: AdProvider; needs: MissingField; value: string }[] = [];
    for (const gap of gaps) {
      const value = await ask(questionFor(gap.provider as AdProvider, gap.needs));
      if (value) answers.push({ provider: gap.provider as AdProvider, needs: gap.needs, value });
    }
    if (answers.length) {
      properties = properties.map((p) => {
        const mine = answers.filter((a) => a.provider === p.provider);
        return mine.reduce((acc, a) => ({ ...acc, [a.needs]: a.value }), p);
      });
      adsPlan = planAds({ properties }, states);
      if (!(values['no-write'] as boolean)) {
        for (const a of answers) {
          const res = writeConfigPatch(input, a.provider, a.needs, a.value);
          if (res.written) console.log(`✓ wrote site.ads.${a.provider}.${a.needs} to ${input}`);
          else console.error(`! ${res.reason}`);
        }
      }
    }
    // A token answered now may name a record we haven't looked for yet.
    states = await observe();
    adsPlan = planAds({ properties }, states);
  } else if (gaps.length && !dry && !check) {
    for (const gap of gaps)
      console.error(`! ${missingFieldMessage(gap.provider as AdProvider, gap.needs)}`);
  }

  if (dry || check) {
    console.log(formatPlanAds(adsPlan));
    if (check && hasAdsDrift(adsPlan)) {
      console.error('\n✖ ad properties are not fully linked');
      process.exit(1);
    }
    return;
  }

  // ── Apply ────────────────────────────────────────────────────────────────────
  const results: AdPropertyResult[] = [];
  let failed = false;
  for (const p of adsPlan.properties) {
    const result: AdPropertyResult = {
      provider: p.provider,
      domain: p.domain ?? '—',
      txt: 'n/a',
      tag: p.tag.action === 'skip' ? 'ready' : 'blocked',
      reminders: p.reminders,
    };
    // A property still missing a field after the prompt round is not linked, and
    // the exit code has to say so — a run that silently succeeds while a pixel has
    // no id is the failure this command exists to make visible.
    if (p.txt.action === 'blocked' || p.tag.action === 'blocked') failed = true;
    if (p.txt.action === 'blocked') result.txt = 'blocked';
    else if (p.txt.action === 'skip')
      result.txt = AD_PLATFORMS[p.provider].verification.method === 'dns-txt' ? 'present' : 'n/a';
    else {
      const zoneId = p.domain ? states.get(p.domain)?.zoneId : undefined;
      if (!cfToken || !zoneId || !p.domain || !p.txtContent) {
        console.error(`✖ ${p.provider}: no Cloudflare zone for ${p.domain ?? '(no domain)'}`);
        result.txt = 'failed';
        failed = true;
      } else {
        const r = await createApexTxt(cfToken, zoneId, p.domain, p.txtContent);
        if (!r.ok) {
          console.error(`✖ ${p.provider} TXT: ${r.message}`);
          result.txt = 'failed';
          failed = true;
        } else {
          console.log(`✓ ${p.provider}: created TXT on ${p.domain}`);
          result.txt = 'created';
        }
      }
    }
    results.push(result);
  }

  console.log(`\n${formatAdsSummary(results)}`);
  if (results.some((r) => r.txt === 'created'))
    console.log('\n  DNS takes minutes to propagate before a platform can see the record.');
  if (results.some((r) => r.reminders.length))
    console.log('  Finish the reminders above in the platform UI — no API covers those.');
  if (failed) process.exit(1);
}

/**
 * Print each configured pixel as an inert, consent-gated `<script>`.
 *
 * The universal delivery path, the same reasoning as `vitops legal`: every consumer
 * has this CLI whatever their stack, so Bricks, WordPress and a hand-built site all
 * get the correct gated markup without integration code.
 */
async function cmdAdsTags(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: 'string', short: 'i', default: 'site.json' },
      'site-env': { type: 'string', default: 'production' },
      provider: { type: 'string' },
      strategy: { type: 'string', default: 'idle' },
    },
    allowPositionals: false,
  });

  const strategy = values.strategy as string;
  if (!['idle', 'async', 'interaction'].includes(strategy))
    fail(`--strategy "${strategy}" is not one of: idle | async | interaction`);

  const cfg = await loadConfig(resolve(values.input as string), values['site-env'] as string);
  const properties = toAdProperties(cfg, values.provider as string | undefined);
  if (properties.length === 0) fail('no properties in site.ads — nothing to emit');

  const out: string[] = [];
  for (const p of properties) {
    if (p.enabled === false) continue;
    const tag = renderTag(p, strategy as 'idle' | 'async' | 'interaction');
    if (!tag) {
      console.error(
        `! ${p.provider}: no ${AD_PLATFORMS[p.provider].tag.needs} — skipped (run \`vitops ads setup\` to be prompted for it)`,
      );
      continue;
    }
    out.push(tag);
  }
  if (out.length === 0) fail('no ad property has a tag id yet');
  console.log(out.join('\n\n'));
}

/**
 * Report the ad-property gaps that are invisible at runtime.
 *
 * Each finding is a silent failure, which is the bar for being here at all: an
 * uncaptured click ID looks exactly like organic traffic, and a pixel on a site
 * with tracking off produces conversions no campaign gets credit for.
 */
async function cmdAdsLint(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: 'string', short: 'i', default: 'site.json' },
      'site-env': { type: 'string', default: 'production' },
    },
    allowPositionals: false,
  });

  const cfg = await loadConfig(resolve(values.input as string), values['site-env'] as string);
  const properties = toAdProperties(cfg, undefined);
  if (properties.length === 0) {
    console.log('· no site.ads properties — nothing to check');
    return;
  }

  const findings: string[] = [];
  const trackingOn = cfg.site.tracking?.enabled === true;

  for (const p of properties) {
    const platform = AD_PLATFORMS[p.provider];
    if (p.enabled === false) continue;

    if (!tagId(p))
      findings.push(
        `${p.provider}: no ${platform.tag.needs} — the property is on record but no tag can be emitted`,
      );

    const uncaptured = platform.clickIdParams.filter((param) => !(param in PLATFORM_PARAMS));
    if (uncaptured.length)
      findings.push(
        `${p.provider}: click ID ${uncaptured.join(', ')} is not in the capture vocabulary — every conversion from this platform will arrive unattributed`,
      );

    if (!trackingOn)
      findings.push(
        `${p.provider}: site.tracking.enabled is not true, so ${platform.clickIdParams.join('/')} is never captured — conversions will be unattributed`,
      );
  }

  if (findings.length === 0) {
    console.log(
      `✓ ${properties.length} ad propert${properties.length === 1 ? 'y' : 'ies'} check out`,
    );
    return;
  }
  for (const f of findings) console.error(`✖ ${f}`);
  process.exit(1);
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
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      input: { type: 'string', short: 'i', default: 'design-system.json' },
      theme: { type: 'string' },
      format: { type: 'string', short: 'f', default: 'bricks' },
      src: { type: 'string', short: 's', default: 'src' },
      // Suggestions are advisory: a reuse rule that failed CI the day it shipped
      // would be a worse defect than the drift it reports.
      strict: { type: 'boolean', default: false },
      fix: { type: 'boolean', default: false },
    },
    // Positionals are explicit files to lint instead of scanning `--src`. This is
    // what makes the command usable as a pre-commit hook: `vp`'s `staged` key
    // appends the staged paths to whatever it runs, so a command that refused
    // positionals could not be wired into the one place the feedback actually
    // lands — at the moment the code is written, rather than whenever someone
    // remembers to run a linter.
    allowPositionals: true,
  });
  const format = values.format as StylesheetFormat;
  if (!LINT_FORMATS.has(format))
    fail(`unknown format "${format}" (expected: bricks | css | tailwind)`);
  const ds = loadDesignSystem(resolve(values.input as string), values.theme as string | undefined);
  const srcDir = resolve(values.src as string);
  if (!positionals.length && !existsSync(srcDir)) fail(`source directory not found: ${srcDir}`);

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

  // Explicit paths win over the scan. A pre-commit hook is handed whatever was
  // staged, which includes deletions and files of every kind, so unreadable and
  // uninteresting paths are skipped rather than fatal — a hook that fails because
  // someone staged a PNG is a hook that gets removed.
  const LINTABLE = new Set(['.astro', '.html', '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte']);
  const named = positionals
    .filter((p) => LINTABLE.has(extname(p)) || extname(p) === '.css')
    .flatMap((p) => {
      try {
        return [{ path: p, text: readFileSync(resolve(p), 'utf8') }];
      } catch {
        return [];
      }
    });
  // `.css` is not in the default extension set — the class linter reads markup,
  // not stylesheets — so the reuse rules get their own pass. Component files are
  // scanned twice on purpose: once for their class attributes, once for any
  // `<style>` block, which is where hand-rolled layout tends to accumulate.
  const files = positionals.length
    ? named.filter((f) => extname(f.path) !== '.css')
    : scanFiles(srcDir);
  const cssFiles = positionals.length
    ? named
    : [...files, ...scanFiles(srcDir, { exts: ['.css'] })];
  // Nothing staged that this command has an opinion about — say so and succeed,
  // rather than reporting a clean run over zero files as if it had checked them.
  if (positionals.length && !cssFiles.length) {
    console.log('✓ no lintable files among the paths given');
    return;
  }
  // The pre-1.0 colour grammar, built from this config's own role names. Read
  // from CSS and <style> blocks — the half of a codebase that references the
  // design system by token rather than by class, and the half nothing checked.
  const renames = movedTokens(ds.colors.roles);
  const tokenFindings = lintTokens(cssFiles, renames);
  const findings = [
    ...lintSource(files, vocabulary(ds, roleClasses), format),
    ...lintCss(cssFiles, format),
    // Markup shape, which is the only one of the three that can see a repeated
    // card set laid out with no bad class and no hand-written CSS — every class
    // real, the pattern simply unused. Reads `files`, not `cssFiles`: a stylesheet
    // has no markup, and passing the doubled list would report each component
    // twice.
    ...lintMarkup(files),
    ...tokenFindings,
  ];

  if (values.fix === true) {
    // Only the token renames are rewritten. Everything else this command
    // reports is a judgement call — `bg-navy-d`'s "suggestion" is the linter's
    // best guess at what you meant, and silently writing a guess into source is
    // worse than printing it.
    const byFile = new Map<string, Set<string>>();
    for (const f of tokenFindings)
      (byFile.get(f.file) ?? byFile.set(f.file, new Set()).get(f.file)!).add(f.fix.from);
    for (const [file, names] of byFile) {
      const subset = Object.fromEntries([...names].map((n) => [n, renames[n] as string]));
      writeFileSync(file, applyRenames(readFileSync(file, 'utf8'), subset));
    }
    const remaining = findings.length - tokenFindings.length;
    console.log(
      `✓ rewrote ${tokenFindings.length} token reference${tokenFindings.length === 1 ? '' : 's'} ` +
        `in ${byFile.size} file${byFile.size === 1 ? '' : 's'}` +
        (remaining
          ? `\n! ${remaining} other finding${remaining === 1 ? '' : 's'} need a decision — ` +
            `re-run without --fix to see ${remaining === 1 ? 'it' : 'them'}`
          : ''),
    );
    if (remaining) process.exitCode = 1;
    return;
  }

  // Name what was actually checked. With explicit paths `--src` was never read,
  // and reporting it would claim a scan that did not happen.
  const scope = positionals.length ? 'the files given' : (values.src as string);
  const scanned = positionals.length ? cssFiles.length : files.length;

  if (!findings.length) {
    console.log(
      `✓ no unresolvable framework classes or missed primitives in ${scope} ` +
        `(${scanned} file${scanned === 1 ? '' : 's'} checked)`,
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
      `${scanned} file${scanned === 1 ? '' : 's'}` +
      (suggestions.length && !values.strict ? ' (suggestions do not fail; use --strict)' : ''),
  );
  if (failing) process.exit(1);
}

/**
 * Find the config when `design-system.json` isn't there.
 *
 * Keyed to SHAPE, not just to the filename — `resolveInput` already tells a
 * design system from the config that embeds one, and consumers name that file
 * whatever they like (`company.json`, `site.json`). The candidate list is
 * ordered, and a tie is resolved by taking the first: this only ever supplies a
 * default that the run then prints, so a wrong guess is visible rather than
 * silent, and `-i` overrides it.
 */
function discoverConfig(cwd: string): string | undefined {
  const candidates = [
    'design-system.json',
    'vitops.json',
    'site.json',
    'company.json',
    'organization.json',
  ];
  for (const name of candidates) {
    const p = resolve(cwd, name);
    if (!existsSync(p)) continue;
    try {
      const raw = JSON.parse(readFileSync(p, 'utf8'));
      // Either kind counts: a bare design system, or a config that embeds one.
      if (isConfig(raw) || (raw && typeof raw === 'object' && 'colors' in raw)) return name;
    } catch {
      // Unparseable: not a candidate, and the real error surfaces if -i names it.
    }
  }
  return undefined;
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
  // This command WRITES documentation, so getting the input path wrong is not a
  // missing feature, it is a false statement committed to the repo: it used to
  // warn and then write "tokens live in design-system.json" into a project whose
  // tokens are in company.json, with the emitted commands broken to match. So
  // when the default path is absent, look for the config rather than assuming
  // it — and fail if there is nothing to name.
  const explicitInput = argv.includes('-i') || argv.includes('--input');
  let inputRel = values.input as string;
  if (!explicitInput && !existsSync(resolve(inputRel))) {
    const found = discoverConfig(process.cwd());
    if (found) {
      inputRel = found;
      console.warn(`  ⚠ no design-system.json here — using ${found} (pass -i to choose another)`);
    } else {
      fail(
        `config not found: ${resolve(inputRel)}\n` +
          `  This command writes the path into ${values.out}, so it will not guess one. ` +
          `Pass -i <path> if your tokens live elsewhere (a site config works), or run \`vitops init\`.`,
      );
    }
  }
  // Validate the config (fail on an invalid one). Docs themselves are rendered
  // live by `vitops docs`, so nothing is generated into the repo from it here.
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

  // Only spelled out when it isn't the default the commands already assume.
  const inputFlag = inputRel === 'design-system.json' ? '' : ` --input ${inputRel}`;
  const block = [
    AGENTS_START,
    '## Vitops design system',
    '',
    `Styled with the Vitops design system (\`@getvitops/*\`); tokens live in \`${inputRel}\`.`,
    'Generate output with the CLI:',
    '',
    // Interpolated, not hard-coded: `generate` defaults --input to
    // design-system.json and hard-fails when it is absent, so an emitted command
    // without the flag is copy-paste-broken in exactly the projects that most
    // need the block to be right.
    `- \`vitops generate${inputFlag} --format tailwind --out src/styles\` — Tailwind v4 / Astro`,
    `- \`vitops generate${inputFlag} --format css --out dist\` — standalone CSS`,
    `- \`vitops generate${inputFlag} --format bricks --out <theme>/dist\` — WordPress / Bricks`,
    `- \`vitops generate${inputFlag} --format design --out .\` — \`DESIGN.md\`, the agent-facing brief`,
    `- \`vitops init\` · \`vitops validate${inputFlag}\` · \`vitops favicon\``,
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
  // Answered before dispatch, because `parseArgs` is strict and every
  // subcommand would otherwise reject `--help` as an unknown option.
  if (wantsHelp(rest)) {
    console.log(helpFor(command, rest));
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
    case 'ads':
      return cmdAds(rest);
    case 'media':
      return cmdMedia(rest);
    default:
      fail(`unknown command "${command}" (expected: ${COMMANDS.join(' | ')}). Try: vitops --help`);
  }
}

main().catch((err) => fail((err as Error).message));
