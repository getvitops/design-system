/**
 * `vitops audit --record` — write what an automated pass can honestly say into the
 * accessibility statement, and nothing more.
 *
 * An automated run proves one thing: axe and Lighthouse found nothing on the pages they
 * visited, on that date. So it records `testedOn` and the `automated` testing method, and it
 * NEVER touches `conformance`: those tools detect only a minority of WCAG failures, the
 * audit report says so, and the generated statement makes no conformance sentence without
 * `conformance` + `testedOn`. A person sets `conformance`, and adds `keyboard` /
 * `screen-reader`, after the manual checks the report lists.
 *
 * The patch is a pure function over the RAW config object (not the resolved one — resolving
 * merges A/B variant overrides, and writing that back would bake them into the file).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ACCESSIBILITY_TESTING, validateConfig } from '@getvitops/generator';
import { detectIndent } from './prompt.ts';

export type RecordResult =
  | { ok: true; next: Record<string, unknown>; changed: boolean }
  | { ok: false; reason: string };

/** `YYYY-MM-DD` in the local calendar — the date the site owner sees on their own clock. */
export function isoDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function recordAccessibilityTest(raw: unknown, date: string): RecordResult {
  const root = (raw ?? {}) as Record<string, unknown>;
  const site = (root['site'] ?? {}) as Record<string, unknown>;
  const legal = (site['legal'] ?? {}) as Record<string, unknown>;
  const statement = legal['accessibilityStatement'] as Record<string, unknown> | undefined;
  if (!statement || typeof statement !== 'object')
    return {
      ok: false,
      reason:
        'site.legal.accessibilityStatement is not set, so there is nothing to record into ' +
        '(add it with `enabled: true` first)',
    };

  const prior = Array.isArray(statement['testing']) ? (statement['testing'] as string[]) : [];
  const methods = new Set([...prior, 'automated']);
  // Known methods in their declared order, then anything else the file already had, untouched.
  const testing = [
    ...ACCESSIBILITY_TESTING.filter((m) => methods.has(m)),
    ...prior.filter((m) => !(ACCESSIBILITY_TESTING as readonly string[]).includes(m)),
  ];

  const nextStatement = { ...statement, testedOn: date, testing };
  const changed =
    statement['testedOn'] !== date || JSON.stringify(prior) !== JSON.stringify(testing);
  return {
    ok: true,
    changed,
    next: {
      ...root,
      site: { ...site, legal: { ...legal, accessibilityStatement: nextStatement } },
    },
  };
}

/** Patch the config file on disk. JSON only: a module config is code, not data. */
export function writeAuditRecord(
  path: string,
  date: string,
): { written: boolean; reason?: string } {
  if (!path.endsWith('.json'))
    return {
      written: false,
      reason: `${path} is a module, not JSON — set site.legal.accessibilityStatement.testedOn to "${date}" and add "automated" to testing yourself`,
    };
  if (!existsSync(path)) return { written: false, reason: `${path} does not exist` };
  const source = readFileSync(path, 'utf8');
  const result = recordAccessibilityTest(JSON.parse(source), date);
  if (!result.ok) return { written: false, reason: result.reason };
  if (!result.changed) return { written: false, reason: 'already records this date and method' };
  const check = validateConfig(result.next);
  if (!check.ok)
    return {
      written: false,
      reason:
        `recording would make ${path} invalid:\n` +
        check.errors.map((i) => `  ${(i.path ?? []).join('.')}: ${i.message}`).join('\n'),
    };
  writeFileSync(
    path,
    JSON.stringify(result.next, null, detectIndent(source)) + (source.endsWith('\n') ? '\n' : ''),
  );
  return { written: true };
}
