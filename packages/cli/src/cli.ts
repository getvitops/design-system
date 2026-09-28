#!/usr/bin/env node
/**
 * `vitops` — CLI for the Vitops design-system generator.
 *
 *   vitops generate  --input <json> --format <bricks|css|tailwind|design[,…]> --out <dir>
 *   vitops init      [--out design-system.json] [--force] [--site [--name <n>] [--url <u>]]
 *   vitops validate  <design-system.json|site.json>
 *   vitops favicon   --input <svg|png> --out <dir> [--low-res <svg|png>] [--background <hex>]
 *   vitops agents    [--input <json>] [--out AGENTS.md] [--docs-dir <dir>]
 *   vitops docs      [topic] [--input <json>] [--all]
 *   vitops lint      [--input <json>] [--format <fmt>] [--src <dir>]
 *   vitops legal     [--input <site.json>] [--doc <name>] [--format <md|html|portable-text>] [--out <dir>]
 *   vitops robots    [--input <site.json>] [--site-env <name>] [--out <dir>]
 *   vitops reviews   [--input <site.json>] [--location <key>] [--dry] [--check] [--out <dir>]
 *   vitops search    setup [--domain <name>] [--dry] [--check]  |  notify [--dry] [--all] [--check]
 *   vitops ads       setup [--provider <name>] [--dry] [--check]  |  tags  |  lint
 *   vitops setup     repo | hosting | domain | search | ads | all [--dry] [--check]
 *   vitops email     setup [domain] [--dry] [--check]  |  check [--strict] [--skip]
 *   vitops media     [--raw <dir>] [--out <dir>] [--force] [--dry]
 *
 * Thin wrapper over @getvitops/generator (generation) and @getvitops/utils (favicons).
 * Every client brings their own consumer-editable design-system.json.
 *
 * `search`/`ads` live in commands/search.ts + commands/ads.ts — the only two
 * command groups big enough, and self-contained enough, to earn their own file.
 * Everything else stays here.
 */
import { parseArgs } from 'node:util';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname, relative, extname } from 'node:path';
import { createRequire } from 'node:module';
import {
  buildIconSprite,
  generate,
  validate,
  defaultConfig,
  defaultSiteConfig,
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
  renderRobotsTxt,
  SCHEMA_LOCAL_PATH,
  CONFIG_SCHEMA_LOCAL_PATH,
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
// other commands should not pull it in. Only `googleAccessToken`/`GoogleAuthLike`
// are needed here — everything else that used to be imported for `search notify`
// now lives in commands/search.ts.
import { googleAccessToken, type GoogleAuthLike } from '@getvitops/utils/indexing';
// Its own subpath for the same reason: `reviews` is network-touching (Google
// Business Profile). `formatPlan` is aliased against `@getvitops/utils/media`'s
// own `formatPlan`, imported below.
import {
  REVIEWS_CACHE_PATH,
  fetchReviews,
  formatPlan as formatReviewsPlan,
  mergeCache,
  plan as planReviews,
  readCache as readReviewsCache,
  selectReviews,
  toCache,
  writeCache as writeReviewsCache,
  type LocationReviews,
  type ReviewsConfig,
} from '@getvitops/utils/reviews';
// Its own subpath for the same reason: `media` shells out to ffmpeg, and no other
// command should carry it.
import {
  MEDIA_MANIFEST_PATH,
  formatPlan as formatMediaPlan,
  processMedia,
  type MediaConfig,
  type OutputKind,
} from '@getvitops/utils/media';
import { msg, parse } from './args.ts';
import { loadGoogleOAuth, requireAdcProject } from './credentials.ts';
import {
  fail,
  loadConfig,
  readJsonOrFail,
  siteConfig,
  SITE_OPTS,
  writeOut,
} from './commands/shared.ts';
import { cmdSearch } from './commands/search.ts';
import { cmdAds } from './commands/ads.ts';
import { cmdCrm } from './commands/crm.ts';
import { cmdEmail } from './commands/email.ts';
import { cmdSetup } from './commands/setup.ts';
import { findSkillTarget, linkSkill, SKILL_NAME, TOPICS } from './agents.ts';
import { COMMANDS, HELP, helpFor, wantsHelp } from './help.ts';
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
      fail(msg(err));
    }
  }
}

/**
 * `vitops init` writes a starter `design-system.json`; `--site` writes a starter
 * `site.json` instead — the umbrella `Config` that embeds the design system under
 * `designSystem.themes.default`, since there is no file-level `extends` and a
 * scaffolded config can't merely reference a sibling file (see `defaultSiteConfig`'s
 * docblock in `@getvitops/generator`). `--name`/`--url` fill the two facts a
 * consumer almost certainly has on hand; everything else stays the documented
 * placeholder, edited by hand or via `vitops setup` (see AGENTS.md's "Client
 * onboarding" section).
 */
function cmdInit(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      out: { type: 'string', short: 'o' },
      force: { type: 'boolean', default: false },
      site: { type: 'boolean', default: false },
      name: { type: 'string' },
      url: { type: 'string' },
    },
    allowPositionals: false,
  });
  const out = resolve((values.out as string) ?? (values.site ? 'site.json' : 'design-system.json'));
  if (existsSync(out) && !values.force) fail(`${out} already exists (use --force to overwrite)`);
  if (values.site) {
    const config = defaultSiteConfig({
      name: values.name as string | undefined,
      url: values.url as string | undefined,
    });
    writeFileSync(out, JSON.stringify(config, null, 2) + '\n');
    console.log(`✓ wrote ${out}`);
    console.log(`  Edit it, then: vitops validate ${relative('.', out)}`);
    console.log(
      `  Editors read the "$schema" (${CONFIG_SCHEMA_LOCAL_PATH}) for autocomplete + validation — ` +
        `the installed copy, so it matches the toolchain you build with.`,
    );
    return;
  }
  writeFileSync(out, JSON.stringify(defaultConfig(), null, 2) + '\n');
  console.log(`✓ wrote ${out}`);
  console.log(
    `  Edit it, then: vitops generate --input ${relative('.', out)} --format tailwind --out src/styles`,
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
  const raw = readJsonOrFail(path, 'config');

  if (isConfig(raw)) {
    let site: Config;
    try {
      site = resolveConfig(raw, values['site-env'] as string | undefined);
    } catch (err) {
      // Already formatted as one issue per line, with field paths.
      console.error(`✖ ${path} is invalid as a site config:`);
      console.error(msg(err).replace(/^Invalid site config:\n/, ''));
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
    fail(msg(err));
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
    fail(msg(err));
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
  const raw = readJsonOrFail(path, 'config');
  let resolved: ResolvedInput;
  try {
    resolved = resolveInput(raw, theme != null ? { theme } : {});
  } catch (err) {
    // resolveConfig formats one issue per line; a bad --theme is one line.
    fail(`${path}: ${msg(err)}`);
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
  const a = parse(argv, {
    ...SITE_OPTS,
    src: { type: 'string', default: 'src' },
    sprite: { type: 'boolean', default: false },
    out: { type: 'string', short: 'o', default: 'dist' },
    json: { type: 'boolean', default: false },
  });

  const sitePath = a.path('input');
  const icons = existsSync(sitePath)
    ? (((await loadConfig(sitePath, a.str('site-env'))).site.icons ?? {}) as Record<
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
    fail(msg(e));
  }
  const add = (prefix: string, name: string) => {
    const list = (include[prefix] ??= []);
    if (!list.includes(name)) list.push(name);
  };

  const srcDir = a.path('src');
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
  if (a.flag('sprite')) {
    const aliases: Record<string, string> = {};
    for (const name of (icons.semantic as string[]) ?? []) {
      try {
        aliases[`icon-${name}`] = resolveIcon(name, ui, weightOpt);
      } catch {
        /* already reported by generateIconInclude above */
      }
    }
    const built = await buildIconSprite({ include, aliases });
    writeOut(join(a.path('out'), 'icons.svg'), built.svg);
    sprite = { ids: built.ids, missing: built.missing };
  }

  if (a.flag('json')) {
    process.stdout.write(
      `${JSON.stringify({ ui, brand, weight: weight ?? null, include, unmapped, dynamic, sprite }, null, 2)}\n`,
    );
  } else {
    console.log(`icon sets: ui=${ui} brand=${brand}${weight ? ` weight=${weight}` : ''}`);
    for (const [prefix, names] of Object.entries(include))
      console.log(`  ${prefix}: ${names.length} — ${names.join(', ')}`);
    console.log(`✓ ${total} icon(s) across ${Object.keys(include).length} set(s)`);
    if (sprite) console.log(`✓ sprite → ${a.path('out')}/icons.svg (${sprite.ids.length} symbols)`);
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
  const a = parse(argv, {
    ...SITE_OPTS,
    doc: { type: 'string', short: 'd', multiple: true },
    format: { type: 'string', short: 'f', default: 'md' },
    out: { type: 'string', short: 'o' },
  });

  const output = a.str('format') as LegalOutput;
  if (!LEGAL_OUTPUTS.has(output))
    fail(`unknown format "${output}" (expected: ${[...LEGAL_OUTPUTS].join(' | ')})`);

  const requested = a.list('doc');
  for (const d of requested)
    if (!LEGAL_DOCS.has(d as LegalDoc))
      fail(`unknown doc "${d}" (expected: ${[...LEGAL_DOCS].join(' | ')})`);

  const site = await siteConfig(a);
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

  if (!a.opt('out')) {
    process.stdout.write(Object.values(files).join('\n'));
    // On stderr, so it survives a redirect of the document itself. It used to be
    // omitted entirely on this path — the one path where the output is most
    // likely being piped straight into a page.
    console.error(REVIEW);
    return;
  }
  const outDir = a.path('out');
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
 * `robots.txt` — anchored to a `Config` like `legal`/`icons`/`search`, because
 * what it emits describes a site (which environment, which sitemap) rather
 * than a token set.
 */
async function cmdRobots(argv: string[]) {
  const a = parse(argv, {
    ...SITE_OPTS,
    out: { type: 'string', short: 'o' },
  });

  const siteEnv = a.str('site-env');
  const site = await loadConfig(a.path('input'), siteEnv);
  const content = renderRobotsTxt(site, { env: siteEnv });

  if (!a.opt('out')) {
    process.stdout.write(content);
    return;
  }
  const file = join(a.path('out'), 'robots.txt');
  writeOut(file, content);
  console.log(`✓ robots.txt → ${file}`);
}

/**
 * Fetch and cache a client's Google Business Profile reviews.
 *
 * Reviews live only on the legacy v4 Business Profile API, and the calling GCP
 * project must be allowlisted by Google before any call succeeds — see
 * `@getvitops/utils/reviews`'s `gbp.ts`. Auth is always user OAuth (the same
 * VITOPS_GOOGLE_* / ADC credential `search setup` uses): reading a client's own
 * reviews is a person acting with owner/manager rights, not a deploy robot.
 *
 * The cache (`.vitops/reviews.json` by default) is meant to be committed — a
 * build should not need a live Google credential to render reviews that change
 * slowly. `--check` fetches and diffs against it without writing, for CI to flag
 * a stale commit; a real run merges only the locations it fetched, so one
 * location's failure leaves every other location's cached reviews untouched.
 */
async function cmdReviews(argv: string[]) {
  const a = parse(argv, {
    ...SITE_OPTS,
    location: { type: 'string' },
    cache: { type: 'string', default: REVIEWS_CACHE_PATH },
    out: { type: 'string', short: 'o' },
    dry: { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
  });

  const site = await siteConfig(a);
  const reviewsConfig = site.site.reviews as ReviewsConfig | undefined;
  const knownLocations = new Set(
    Object.entries(site.organization?.locations ?? {})
      .filter(([, loc]) => loc.listings?.google)
      .map(([key]) => key),
  );

  // Env-only, no network — safe to resolve before the --dry check, the same way
  // `search setup`'s credential presence shapes its own plan.
  const oauth = loadGoogleOAuth();

  const p = planReviews({
    config: reviewsConfig,
    knownLocations,
    hasCredential: !!oauth,
    ...(a.opt('location') ? { onlyLocation: a.str('location') } : {}),
  });

  console.log(formatReviewsPlan(p));
  if (p.blocked) return;

  const active = p.locations.filter((l) => !l.skip);
  if (a.flag('dry')) {
    console.log('\n(--dry: nothing was fetched)');
    return;
  }

  const cachePath = a.path('cache');
  const existing = readReviewsCache(cachePath);

  const project = site.site?.google?.project;
  requireAdcProject(project, a.str('input'));
  const auth: GoogleAuthLike = {
    token: await googleAccessToken({ kind: 'oauth', oauth: oauth! }),
    ...(project ? { quotaProject: project } : {}),
  };

  const fetched: Record<string, LocationReviews> = {};
  let failed = false;
  for (const loc of active) {
    const r = await fetchReviews(auth, loc.accountId!, loc.locationId!);
    if (!r.ok) {
      console.error(`✖ ${loc.key}: ${r.message}`);
      failed = true;
      continue;
    }
    console.log(`✓ ${loc.key}: ${r.reviews.length} review(s)`);
    fetched[loc.key] = {
      locationId: loc.locationId!,
      accountId: loc.accountId!,
      fetchedAt: new Date().toISOString(),
      ...(r.averageRating !== undefined ? { averageRating: r.averageRating } : {}),
      ...(r.totalReviewCount !== undefined ? { totalReviewCount: r.totalReviewCount } : {}),
      reviews: r.reviews,
    };
  }

  // ── --check: read-only, and nothing is written ──────────────────────────────
  if (a.flag('check')) {
    let drift = false;
    for (const [key, loc] of Object.entries(fetched)) {
      const before = existing?.locations[key];
      const beforeIds = new Set((before?.reviews ?? []).map((rv) => rv.id));
      const afterIds = loc.reviews.map((rv) => rv.id);
      const changed =
        beforeIds.size !== afterIds.length || afterIds.some((id) => !beforeIds.has(id));
      if (changed) {
        drift = true;
        console.log(
          `  ~ ${key}: cache is stale (${before?.reviews.length ?? 0} → ${loc.reviews.length})`,
        );
      }
    }
    if (drift || failed) process.exit(1);
    console.log('\n✓ cache matches live reviews');
    return;
  }

  if (Object.keys(fetched).length) {
    const merged = toCache(mergeCache(existing, fetched).locations);
    writeReviewsCache(cachePath, merged);
    console.log(`  cache → ${relative(process.cwd(), cachePath)}`);

    if (a.opt('out')) {
      const outDir = a.path('out');
      mkdirSync(outDir, { recursive: true });
      for (const [key, loc] of Object.entries(merged.locations)) {
        const locConfig = reviewsConfig?.locations[key];
        const selected = locConfig ? selectReviews(loc.reviews, locConfig) : loc.reviews;
        writeFileSync(join(outDir, `${key}.json`), `${JSON.stringify(selected, null, 2)}\n`);
      }
      console.log(`  selected reviews → ${outDir}`);
    }
  }

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
      fail(`could not generate docs: ${msg(err)}`);
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
    case 'robots':
      return cmdRobots(rest);
    case 'reviews':
      return cmdReviews(rest);
    case 'icons':
      return cmdIcons(rest);
    case 'search':
      return cmdSearch(rest);
    case 'ads':
      return cmdAds(rest);
    case 'crm':
      return cmdCrm(rest);
    case 'email':
      return cmdEmail(rest);
    case 'setup':
      return cmdSetup(rest);
    case 'media':
      return cmdMedia(rest);
    default:
      fail(`unknown command "${command}" (expected: ${COMMANDS.join(' | ')}). Try: vitops --help`);
  }
}

main().catch((err) => fail(msg(err)));
