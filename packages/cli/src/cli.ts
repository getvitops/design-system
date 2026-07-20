#!/usr/bin/env node
/**
 * `vitops` — CLI for the Vitops design-system generator.
 *
 *   vitops generate  --input <json> --format <bricks|css|tailwind[,…]> --out <dir>
 *   vitops init      [--out design-system.json] [--force]
 *   vitops validate  <design-system.json>
 *
 * Thin wrapper over @getvitops/core. Every client brings their own
 * consumer-editable design-system.json; this turns it into platform output.
 */
import { parseArgs } from 'node:util';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generate, validate, defaultConfig, SCHEMA_URL, type Format } from '@getvitops/core';

const FORMATS = new Set<Format>(['bricks', 'css', 'tailwind']);

const HELP = `vitops — generate design-system outputs from a design-system.json

Usage:
  vitops generate [options]     Generate platform output from a config
  vitops init [options]         Scaffold a starter design-system.json
  vitops validate <file>        Validate a config against the schema

Generate options:
  -i, --input <path>    Config file (default: ./design-system.json)
  -f, --format <list>   bricks | css | tailwind (comma-separated; default: bricks)
  -o, --out <dir>       Output directory (default: ./dist)

Init options:
  -o, --out <path>      Where to write (default: ./design-system.json)
      --force           Overwrite an existing file

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
    default:
      fail(
        `unknown command "${command}" (expected: generate | init | validate). Try: vitops --help`,
      );
  }
}

main().catch((err) => fail((err as Error).message));
