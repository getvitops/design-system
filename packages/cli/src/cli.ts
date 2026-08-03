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
  isSiteConfig,
  resolveInput,
  resolveSiteConfig,
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
  type SiteConfig,
} from '@getvitops/generator';
import {
  collectIconRefs,
  generateFavicons,
  generateIconInclude,
  resolveIcon,
  scanFiles,
} from '@getvitops/utils';
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

Common:
  -h, --help            Show this help
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

  if (isSiteConfig(raw)) {
    let site: SiteConfig;
    try {
      site = resolveSiteConfig(raw, values['site-env'] as string | undefined);
    } catch (err) {
      // Already formatted as one issue per line, with field paths.
      console.error(`✖ ${path} is invalid as a site config:`);
      console.error((err as Error).message.replace(/^Invalid site config:\n/, ''));
      process.exit(1);
    }
    // Each theme is validated in turn: `validateSite` checks the `extends` chain
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

/**
 * Read + parse + validate the design system at `path`, or exit with a message.
 *
 * `path` may be a `design-system.json` **or** the larger site config that embeds
 * one — every command that judges source against the design system (`docs`,
 * `lint`, `agents`) accepts either, so a consumer who keeps their tokens in
 * `company.json` doesn't have to maintain a second file for the tooling's sake.
 * `resolveInput` tells them apart by shape and resolves the theme.
 */
function loadConfig(path: string, theme?: string): DesignSystem {
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
    // resolveSiteConfig formats one issue per line; a bad --theme is one line.
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
 * which would mean a parser dependency for one command. `resolveSiteConfig` is
 * documented as taking an already-parsed object precisely so the loader is the
 * consumer's choice; anyone on YAML can convert it or export from a module.
 */
async function loadSiteConfig(path: string, siteEnv: string): Promise<SiteConfig> {
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
    return resolveSiteConfig(raw, siteEnv);
  } catch (err) {
    // resolveSiteConfig already formats one issue per line.
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
 * against a design-system.json, whereas icons are anchored to a SiteConfig.
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
    ? (((await loadSiteConfig(sitePath, values['site-env'] as string)).icons ?? {}) as Record<
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

  const site = await loadSiteConfig(resolve(values.input as string), values['site-env'] as string);
  const docs = requested.length ? (requested as LegalDoc[]) : enabledDocs(site);
  if (docs.length === 0)
    fail(
      'no legal documents are enabled — set legal.privacyPolicy.enabled (or termsOfService / cookieConsent) in your site config, or name one with --doc',
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
  const ds = loadConfig(resolve(values.input as string), values.theme as string | undefined);
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
  const ds = loadConfig(resolve(values.input as string), values.theme as string | undefined);
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
    ds = loadConfig(resolve(inputRel), values.theme as string | undefined);
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
    default:
      fail(
        `unknown command "${command}" (expected: generate | init | validate | favicon | agents | docs | lint | legal | icons). Try: vitops --help`,
      );
  }
}

main().catch((err) => fail((err as Error).message));
