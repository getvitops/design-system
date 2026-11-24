import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import {
  FORM_FIELDS,
  MAX_URL_BODY,
  REPORT_PACKAGES,
  REPORT_TYPES,
  detectPlatform,
  issueLabels,
  prefilledIssueUrl,
  redact,
  renderIssueBody,
  sensitiveTerms,
  type ReportFacts,
} from './report.ts';

const facts: ReportFacts = {
  versions: { cli: '9.0.0', astro: '9.0.0' },
  node: '24.1.0',
  os: 'linux x64',
  dependencies: ['astro', 'emdash'],
};

const FORMS = join(import.meta.dirname, '../../../.github/ISSUE_TEMPLATE');
const FORM_FILE = {
  bug: 'bug.yml',
  deprecation: 'deprecation.yml',
  improvement: 'improvement.yml',
};

describe('issue forms and the CLI agree', () => {
  it.each(REPORT_TYPES)('%s: form labels are exactly FORM_FIELDS, in order', (type) => {
    const yml = readFileSync(join(FORMS, FORM_FILE[type]), 'utf8');
    const labels = [...yml.matchAll(/^\s+label: (.+)$/gm)].map((m) => m[1]!.trim());
    expect(labels).toEqual([...FORM_FIELDS[type]]);
  });

  it('every type has a form, and no stray form exists', () => {
    const files = readdirSync(FORMS).filter((f) => f !== 'config.yml');
    expect(files.sort()).toEqual(Object.values(FORM_FILE).sort());
  });

  it.each(REPORT_TYPES)('%s: the package dropdown lists every package', (type) => {
    const yml = readFileSync(join(FORMS, FORM_FILE[type]), 'utf8');
    for (const p of REPORT_PACKAGES) expect(yml).toMatch(new RegExp(`\\b${p}\\b`));
  });
});

describe('renderIssueBody', () => {
  it('uses the form headings, in order', () => {
    const body = renderIssueBody({ type: 'bug', text: 'It broke.', facts });
    const headings = [...body.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
    expect(headings.filter((h) => h !== 'Environment')).toEqual([...FORM_FIELDS.bug]);
  });

  it('puts bare text in the primary field and marks the rest "No response"', () => {
    const body = renderIssueBody({ type: 'bug', text: 'It broke.', facts });
    expect(body).toContain('### What happened\n\nIt broke.');
    expect(body).toContain('### Expected behaviour\n\n_No response_');
  });

  it('keeps ### sections the reporter wrote, and fills facts only where empty', () => {
    const text = '### Expected behaviour\n\nA class.\n\n### Platform\n\nBricks / WordPress';
    const body = renderIssueBody({ type: 'bug', text, facts });
    expect(body).toContain('### Expected behaviour\n\nA class.');
    expect(body).toContain('### Platform\n\nBricks / WordPress');
  });

  it('lists installed versions, and says so when none resolved', () => {
    expect(renderIssueBody({ type: 'bug', text: 'x', facts })).toContain('- @getvitops/cli 9.0.0');
    const none = renderIssueBody({ type: 'bug', text: 'x', facts: { ...facts, versions: {} } });
    expect(none).toContain('no @getvitops/* package resolved');
  });

  it('detects the platform from dependencies', () => {
    expect(detectPlatform(['emdash'])).toBe('EmDash');
    expect(detectPlatform(['astro'])).toBe('Static Astro');
    expect(detectPlatform([])).toBe('Other');
  });
});

describe('redact', () => {
  const config = {
    organization: {
      name: 'Acme Plumbing',
      type: 'Plumber',
      contact: { email: 'hello@acme.ca', phone: '613-555-0100' },
    },
    site: {
      domains: { canonical: 'https://www.acme.ca' },
      environments: { production: { url: 'https://acme-prod.workers.dev' } },
    },
  };

  it('replaces config-derived names, domains and hosts, case-insensitively', () => {
    const terms = sensitiveTerms(config);
    const { text, replaced } = redact(
      'acme plumbing at https://www.acme.ca and www.acme.ca',
      terms,
    );
    expect(text).toBe('<organization> at <domain> and <domain>');
    expect(replaced.find((r) => r.placeholder === '<domain>')?.count).toBe(2);
  });

  it('replaces the longer term first', () => {
    const { text } = redact('see https://www.acme.ca/about', sensitiveTerms(config));
    expect(text).toBe('see <domain>/about');
  });

  it('skips vocabulary keys and short strings', () => {
    const terms = sensitiveTerms(config).map((t) => t.term);
    expect(terms).not.toContain('Plumber');
  });

  it('scrubs secrets, emails, home paths and IPs with no config at all', () => {
    const raw = [
      'Authorization: Bearer abcdefgh12345678',
      'key sk-abcdefghijklmnop1234',
      'token ghp_abcdefghijklmnopqrstuv',
      'mail me@client.com',
      'at /home/alex/dev/client-site/src/x.ts',
      'host 192.168.1.20',
    ].join('\n');
    const { text } = redact(raw);
    expect(text).not.toMatch(/abcdefgh|client\.com|alex|192\.168/);
    expect(text).toContain('Bearer <token>');
    expect(text).toContain('~/dev/client-site/src/x.ts');
  });

  it('tolerates a config that is not an object', () => {
    expect(sensitiveTerms(null)).toEqual([]);
    expect(sensitiveTerms('nope')).toEqual([]);
  });

  it('leaves clean text alone and reports nothing', () => {
    expect(redact('the grid class is wrong')).toEqual({
      text: 'the grid class is wrong',
      replaced: [],
    });
  });
});

describe('submission', () => {
  it('labels every report for triage', () => {
    expect(issueLabels('improvement')).toEqual(['agent-report', 'triage:new', 'enhancement']);
  });

  it('prefills the body when short', () => {
    const r = prefilledIssueUrl('bug', 'Broken', 'short');
    expect(r.bodyIncluded).toBe(true);
    expect(r.url).toContain('body=short');
  });

  it('drops the body from the URL when it would be too long', () => {
    const r = prefilledIssueUrl('bug', 'Broken', 'x'.repeat(MAX_URL_BODY + 1));
    expect(r.bodyIncluded).toBe(false);
    expect(r.url).not.toContain('body=');
    expect(r.url).toContain('title=Broken');
  });
});
