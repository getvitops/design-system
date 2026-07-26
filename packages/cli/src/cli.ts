#!/usr/bin/env node
/**
 * `vitops` — CLI for the Vitops design-system generator.
 *
 *   vitops generate  --input <json> --format <bricks|css|tailwind[,…]> --out <dir>
 *   vitops init      [--out design-system.json] [--force]
 *   vitops validate  <design-system.json>
 *   vitops favicon   --input <svg|png> --out <dir> [--low-res <svg|png>]
 *   vitops agents    [--input <json>] [--out AGENTS.md] [--skill-dir <dir>] [--docs-dir <dir>]
 *
 * Thin wrapper over @getvitops/generator (generation) and @getvitops/utils (favicons).
 * Every client brings their own consumer-editable design-system.json.
 */
import { parseArgs } from 'node:util';
import {
  writeFileSync,
  existsSync,
  readFileSync,
  mkdirSync,
  lstatSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { resolve, join, dirname, relative } from 'node:path';
import { createRequire } from 'node:module';
import {
  generate,
  validate,
  defaultConfig,
  generateDocs,
  renderSkill,
  SCHEMA_URL,
  type Format,
  type DesignSystem,
} from '@getvitops/generator';
import { generateFavicons } from '@getvitops/utils';

const FORMATS = new Set<Format>(['bricks', 'css', 'tailwind']);

const HELP = `vitops — generate design-system outputs from a design-system.json

Usage:
  vitops generate [options]     Generate platform output from a config
  vitops init [options]         Scaffold a starter design-system.json
  vitops validate <file>        Validate a config against the schema
  vitops favicon [options]      Generate a favicon set from a source image
  vitops agents [options]       Emit the design-system agent skill + AGENTS.md pointer

Generate options:
  -i, --input <path>    Config file (default: ./design-system.json)
  -f, --format <list>   bricks | css | tailwind (comma-separated; default: bricks)
  -o, --out <dir>       Output directory (default: ./dist)

Init options:
  -o, --out <path>      Where to write (default: ./design-system.json)
      --force           Overwrite an existing file

Favicon options:
  -i, --input <path>    Source SVG or PNG (required)
  -o, --out <dir>       Output directory (default: ./public)
      --low-res <path>  Optional simplified source for the 16px icon

Agents options:
  -i, --input <path>    Config file (default: ./design-system.json)
  -o, --out <path>      Doc file to update, idempotently (default: ./AGENTS.md)
      --skill-dir <dir> Where the generated skill lands (default:
                        ./.agents/skills/vitops-design-system; also symlinked from
                        ./.claude/skills/vitops-design-system)
      --docs-dir <dir>  Legacy layout: write only the docs bundle to this dir (no skill)

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
    },
    allowPositionals: false,
  });
  const input = resolve(values.input as string);
  if (!existsSync(input)) fail(`config not found: ${input}`);
  const formats = (values.format as string)
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
  for (const f of formats)
    if (!FORMATS.has(f as Format))
      fail(`unknown format "${f}" (expected: bricks | css | tailwind)`);

  for (const format of formats as Format[]) {
    try {
      const res = await generate({ input, format, outDir: values.out as string });
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
  return result.data;
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
const SKILL_NAME = 'vitops-design-system';

/**
 * Idempotently symlink `.claude/skills/vitops-design-system` → the skill dir so
 * Claude Code discovers the agent-agnostic `.agents/` skill. Replaces a stale
 * symlink; refuses to clobber a real file/dir. Returns a warning, or null on
 * success / nothing-to-do.
 */
function linkClaudeSkill(skillDir: string): string | null {
  const linkPath = resolve('.claude', 'skills', SKILL_NAME);
  const target = relative(dirname(linkPath), resolve(skillDir));
  if (target === '') return null; // skill dir IS the .claude path
  try {
    const st = lstatSync(linkPath, { throwIfNoEntry: false });
    if (st && !st.isSymbolicLink())
      return `left ${linkPath} alone (exists and is not a symlink) — link it to ${skillDir} yourself if wanted`;
    if (st) {
      if (readlinkSync(linkPath) === target) return null;
      rmSync(linkPath);
    } else {
      mkdirSync(dirname(linkPath), { recursive: true });
    }
    symlinkSync(target, linkPath);
    return null;
  } catch (err) {
    return `could not symlink ${linkPath}: ${(err as Error).message}`;
  }
}

function cmdAgents(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: 'string', short: 'i', default: 'design-system.json' },
      out: { type: 'string', short: 'o', default: 'AGENTS.md' },
      'skill-dir': { type: 'string', default: join('.agents', 'skills', SKILL_NAME) },
      'docs-dir': { type: 'string' },
    },
    allowPositionals: false,
  });
  const inputRel = values.input as string;
  const ds = loadConfig(resolve(inputRel));
  const skillDir = values['skill-dir'] as string;
  // Explicit --docs-dir = legacy layout: just the docs bundle, no skill.
  const legacyDocsDir = values['docs-dir'] as string | undefined;
  const docsDir = legacyDocsDir ?? join(skillDir, 'references');

  // Emit the OKF docs bundle so the AGENTS.md pointer resolves for every consumer
  // (only the `bricks` generate format writes docs/ otherwise).
  let docs: Record<string, string> = {};
  try {
    docs = generateDocs(ds, generatorAssetsDir());
  } catch (err) {
    fail(`could not generate docs: ${(err as Error).message}`);
  }
  for (const [rel, content] of Object.entries(docs)) {
    const p = resolve(docsDir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }

  let skillNote = '';
  if (!legacyDocsDir) {
    writeFileSync(resolve(skillDir, 'SKILL.md'), renderSkill(ds));
    const warn = linkClaudeSkill(skillDir);
    if (warn) console.warn(`  ⚠ ${warn}`);
    skillNote = ` + skill at ${skillDir}/`;
  }

  const pointer = legacyDocsDir
    ? [
        'Prefer the framework’s utility + component classes over hand-written CSS.',
        `Reference docs (regenerate with \`vitops agents\`): \`${docsDir}/css/classes.md\`,`,
        `\`${docsDir}/authoring.md\`, \`${docsDir}/formats.md\`, \`${docsDir}/bricks/elements.md\`.`,
      ]
    : [
        'Prefer the framework’s utility + component classes over hand-written CSS.',
        `Full design-system context lives in the \`${SKILL_NAME}\` skill at \`${skillDir}/\`:`,
        'class vocabulary, `design-system.json` field reference, per-format output',
        'differences (Tailwind vs Bricks vs CSS), colour/scale/pattern concepts, and the',
        'Bricks element reference (under its `references/`). Regenerate with `vitops agents`.',
      ];

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
  console.log(
    `✓ ${action} ${values.out} + wrote ${Object.keys(docs).length} docs to ${docsDir}/${skillNote}`,
  );
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
    default:
      fail(
        `unknown command "${command}" (expected: generate | init | validate | favicon | agents). Try: vitops --help`,
      );
  }
}

main().catch((err) => fail((err as Error).message));
