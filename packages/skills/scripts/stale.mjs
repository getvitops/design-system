#!/usr/bin/env node
/**
 * Lists law-skill topic files whose `verified` date is older than a threshold (default 180 days).
 *
 * A release-runbook step, deliberately NOT a CI test: a test that starts failing because the
 * calendar moved would break unrelated builds. This reports; a person re-verifies against the
 * primary sources and bumps `verified`.
 *
 *   node packages/skills/scripts/stale.mjs [--days 180]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');
const flag = process.argv.indexOf('--days');
const days = flag > -1 ? Number(process.argv[flag + 1]) : 180;
const now = Date.now();
let stale = 0;

for (const skill of readdirSync(root)) {
  for (const file of readdirSync(join(root, skill))) {
    if (file === 'SKILL.md' || !file.endsWith('.md')) continue;
    const text = readFileSync(join(root, skill, file), 'utf8');
    const verified = /^verified:\s*(\d{4}-\d{2}-\d{2})\s*$/m.exec(text)?.[1];
    if (!verified) continue; // not a law topic file
    const age = Math.floor((now - Date.parse(verified)) / 86_400_000);
    if (age > days) {
      stale++;
      console.log(`${age}d  ${skill}/${file}  (verified ${verified})`);
    }
  }
}
console.log(
  stale
    ? `\n${stale} file(s) older than ${days} days — re-verify against sources.`
    : `All law topic files verified within ${days} days.`,
);
process.exitCode = stale ? 1 : 0;
