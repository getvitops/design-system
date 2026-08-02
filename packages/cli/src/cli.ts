#!/usr/bin/env node
/**
 * `vitops` — CLI for the Vitops design-system generator.
 *
 *   vitops generate  --input <json> --format <bricks|css|tailwind|design[,…]> --out <dir>
 *   vitops init      [--out design-system.json] [--force]
 *   vitops validate  <design-system.json>
 *   vitops favicon   --input <svg|png> --out <dir> [--low-res <svg|png>]
 *   vitops agents    [--input <json>] [--out AGENTS.md] [--docs-dir <dir>]
 *   vitops docs      [topic] [--input <json>] [--all]
 *   vitops lint      [--input <json>] [--format <fmt>] [--src <dir>]
 *   vitops legal     [--input <site.json>] [--doc <name>] [--format <md|html|portable-text>] [--out <dir>]
 *
 * Thin wrapper over @getvitops/generator (generation) and @getvitops/utils (favicons).
 * Every client brings their own consumer-editable design-system.json.
 */
import { parseArgs } from 'node:util';
import { writeFileSync, existsSync, readFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join, dirname, extname } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import {
  generate,
  validate,
  defaultConfig,
  generateDocs,
  generateLegal,
  enabledDocs,
  resolveSiteConfig,
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
  type SiteConfig,
} from '@getvitops/generator';
import { generateFavicons } from '@getvitops/utils';
import { findSkillTarget, linkSkill, SKILL_NAME, TOPICS } from './agents.ts';
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

Usage:
  vitops generate [options]     Generate platform output from a config
  vitops init [options]         Scaffold a starter design-system.json
  vitops validate <file>        Validate a config against the schema
  vitops favicon [options]      Generate a favicon set from a source image
  vitops agents [options]       Link the design-system agent skill + AGENTS.md pointer
  vitops docs [topic]           Print live design-system reference docs to stdout
  vitops lint [options]         Report framework classes in your source that resolve to nothing
  vitops legal [options]        Render legal documents from a site config

Generate options:
  -i, --input <path>    Config file (default: ./design-system.json)
  -f, --format <list>   bricks | css | tailwind | design (comma-separated; default: bricks)
                        design emits DESIGN.md only (the agent-facing brief) — pair it
                        with --out . to write it beside AGENTS.md, or compose:
                        --format css,design
  -o, --out <dir>       Output directory (default: ./dist)
      --site <path>     Site config; also emits legal/*.html into the output
                        directory (see: vitops legal). Omitted: no legal files.

Init options:
  -o, --out <path>      Where to write (default: ./design-system.json)
      --force           Overwrite an existing file

Favicon options:
  -i, --input <path>    Source SVG or PNG (required)
  -o, --out <dir>       Output directory (default: ./public)
      --low-res <path>  Optional simplified source for the 16px icon

Agents options:
  -i, --input <path>    Config file (default: ./design-system.json; validated if present)
  -o, --out <path>      Doc file to update, idempotently (default: ./AGENTS.md)
      --docs-dir <dir>  Legacy layout: write the docs bundle as files to this dir
                        instead of linking the packaged skill

Docs options:
  <topic>               classes | authoring | formats | color | scales | patterns | elements
                        (no topic: list topics with summaries)
  -i, --input <path>    Config file (default: ./design-system.json)
      --all             Print every topic, concatenated

Lint options:
  -i, --input <path>    Config file (default: ./design-system.json)
  -f, --format <fmt>    Format you build (bricks | css | tailwind; default: bricks).
                        Responsive md-* classes are real in css/bricks, inert in tailwind.
  -s, --src <dir>       Directory to scan (default: ./src)

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

function cmdValidate(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { input: { type: 'string', short: 'i' } },
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
    });
    console.log(`✓ favicons → ${values.out} (${written.length} files)`);
  } catch (err) {
    fail((err as Error).message);
  }
}

// Read + parse + validate a design-system.json, or exit with a message.
function loadConfig(path: string): DesignSystem {
  if (!existsSync(path)) fail(`config not found: ${path}`);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    fail(`could not parse JSON: ${(err as Error).message}`);
  }
  const result = validate(raw);
  if (!result.ok) {
    console.error(`✖ ${path} is invalid:`);
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
  const ds = loadConfig(resolve(values.input as string));
  const docs = generateDocs(ds, generatorAssetsDir());
  const paths = values.all
    ? Object.values(TOPICS).map((t) => t.path)
    : [TOPICS[topic as string]!.path];
  process.stdout.write(paths.map((p) => docs[p]).join('\n'));
}

const SCAN_EXT = new Set([
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
const SCAN_SKIP = new Set(['node_modules', 'dist', '.git', '.astro', 'build', 'coverage']);

function scanFiles(dir: string, acc: { path: string; text: string }[] = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SCAN_SKIP.has(e.name)) scanFiles(p, acc);
    } else if (SCAN_EXT.has(extname(e.name))) {
      acc.push({ path: p, text: readFileSync(p, 'utf8') });
    }
  }
  return acc;
}

function cmdLint(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: 'string', short: 'i', default: 'design-system.json' },
      format: { type: 'string', short: 'f', default: 'bricks' },
      src: { type: 'string', short: 's', default: 'src' },
    },
    allowPositionals: false,
  });
  const format = values.format as StylesheetFormat;
  if (!LINT_FORMATS.has(format))
    fail(`unknown format "${format}" (expected: bricks | css | tailwind)`);
  const ds = loadConfig(resolve(values.input as string));
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
  const findings = lintSource(files, vocabulary(ds, roleClasses), format);

  if (!findings.length) {
    console.log(
      `✓ no unresolvable framework classes in ${values.src} ` +
        `(${files.length} file${files.length === 1 ? '' : 's'} scanned)`,
    );
    return;
  }
  for (const f of findings) {
    console.error(`${f.file}:${f.line}  ${f.cls}`);
    console.error(`    ${f.reason}`);
    if (f.suggestion) console.error(`    try: ${f.suggestion}`);
  }
  const n = findings.length;
  console.error(
    `\n✖ ${n} unresolvable class${n === 1 ? '' : 'es'} in ` +
      `${files.length} file${files.length === 1 ? '' : 's'}`,
  );
  process.exit(1);
}

function cmdAgents(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: 'string', short: 'i', default: 'design-system.json' },
      out: { type: 'string', short: 'o', default: 'AGENTS.md' },
      'docs-dir': { type: 'string' },
    },
    allowPositionals: false,
  });
  const inputRel = values.input as string;
  // The command is pure wiring: validate the config when present (fail on an
  // invalid one), but don't require it — docs are rendered live by `vitops docs`.
  let ds: DesignSystem | null = null;
  if (existsSync(resolve(inputRel))) ds = loadConfig(resolve(inputRel));
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
    default:
      fail(
        `unknown command "${command}" (expected: generate | init | validate | favicon | agents | docs | lint | legal). Try: vitops --help`,
      );
  }
}

main().catch((err) => fail((err as Error).message));
