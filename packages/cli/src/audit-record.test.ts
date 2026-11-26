import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vite-plus/test';
import { defaultConfig } from '@getvitops/generator';
import { isoDate, recordAccessibilityTest, writeAuditRecord } from './audit-record.ts';

const cfg = (statement?: Record<string, unknown>) => ({
  site: { legal: statement ? { accessibilityStatement: statement } : {} },
});
const stmt = (r: ReturnType<typeof recordAccessibilityTest>) => {
  if (!r.ok) throw new Error(r.reason);
  return (r.next as any).site.legal.accessibilityStatement;
};

describe('recordAccessibilityTest', () => {
  test('sets testedOn and automated, and never touches conformance', () => {
    const r = recordAccessibilityTest(cfg({ enabled: true, conformance: 'partial' }), '2026-11-26');
    expect(stmt(r)).toEqual({
      enabled: true,
      conformance: 'partial',
      testedOn: '2026-11-26',
      testing: ['automated'],
    });
  });

  test('does not invent a conformance claim when none was made', () => {
    const r = recordAccessibilityTest(cfg({ enabled: true }), '2026-11-26');
    expect('conformance' in stmt(r)).toBe(false);
  });

  test('keeps existing methods, in declared order, plus unknown ones untouched', () => {
    const r = recordAccessibilityTest(
      cfg({ enabled: true, testing: ['screen-reader', 'keyboard', 'legacy'] }),
      '2026-11-26',
    );
    expect(stmt(r).testing).toEqual(['automated', 'keyboard', 'screen-reader', 'legacy']);
  });

  test('is a no-op when the date and method are already recorded', () => {
    const r = recordAccessibilityTest(
      cfg({ enabled: true, testedOn: '2026-11-26', testing: ['automated'] }),
      '2026-11-26',
    );
    expect(r.ok && r.changed).toBe(false);
  });

  test('refuses when there is no statement to record into', () => {
    const r = recordAccessibilityTest(cfg(), '2026-11-26');
    expect(r.ok).toBe(false);
  });

  test('does not mutate its input', () => {
    const input = cfg({ enabled: true });
    recordAccessibilityTest(input, '2026-11-26');
    expect(input).toEqual(cfg({ enabled: true }));
  });
});

describe('isoDate', () => {
  test('formats the local calendar date as YYYY-MM-DD', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('writeAuditRecord', () => {
  test('refuses a module config', () => {
    const r = writeAuditRecord('/x/vitops.config.ts', '2026-11-26');
    expect(r.written).toBe(false);
    expect(r.reason).toContain('module');
  });

  test('skips, writing nothing, when there is no statement', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vitops-rec-'));
    const file = join(dir, 'vitops.json');
    const before = JSON.stringify({ site: {} }, null, 2) + '\n';
    writeFileSync(file, before);
    expect(writeAuditRecord(file, '2026-11-26').written).toBe(false);
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  test("writes in place, keeping the file's indentation and leaving conformance alone", () => {
    const dir = mkdtempSync(join(tmpdir(), 'vitops-rec-'));
    const file = join(dir, 'vitops.json');
    const config = {
      designSystem: { themes: { default: defaultConfig() } },
      organization: { name: 'Acme', email: 'a11y@acme.example' },
      site: {
        defaultLocale: 'en',
        locales: { en: { name: 'English' } },
        environments: { production: { url: 'https://acme.example' } },
        domains: { canonical: 'https://acme.example' },
        legal: { accessibilityStatement: { enabled: true } },
      },
    };
    writeFileSync(file, JSON.stringify(config, null, '\t') + '\n');
    const r = writeAuditRecord(file, '2026-11-26');
    expect(r).toEqual({ written: true });
    const text = readFileSync(file, 'utf8');
    expect(text.startsWith('{\n\t"')).toBe(true);
    expect(text.endsWith('\n')).toBe(true);
    const written = JSON.parse(text).site.legal.accessibilityStatement;
    expect(written).toEqual({ enabled: true, testedOn: '2026-11-26', testing: ['automated'] });
    // Second run is a no-op rather than a rewrite.
    expect(writeAuditRecord(file, '2026-11-26').written).toBe(false);
  });
});
