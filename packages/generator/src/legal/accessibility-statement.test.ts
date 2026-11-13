/**
 * The accessibility statement is a public claim about people's ability to use a site, so these tests
 * pin two things: that it asserts only what the config declares, and that the document itself holds
 * the Level AAA content criteria it asks the reader to trust (reading level, abbreviations, link
 * purpose, headings). The second half runs on the rendered HTML for every combination of optional
 * sections, not for one hand-picked fixture.
 */
import { describe, expect, test } from 'vite-plus/test';
import { defaultConfig } from '../index.ts';
import {
  accessibilityStatementWarnings,
  resolveAccessibilityContact,
  validateConfig,
  type Config,
} from '../config.ts';

type Statement = NonNullable<NonNullable<Config['site']['legal']>['accessibilityStatement']>;

/** A config with the statement enabled. `st` patches the statement, `site` the rest of the site. */
export function statementConfig(
  st: Partial<Statement> = {},
  site: Partial<Config['site']> = {},
  org: Partial<Config['organization']> = {},
): Config {
  return {
    designSystem: { themes: { default: defaultConfig() } },
    organization: {
      name: 'Acme',
      legalName: 'Acme Widgets Inc.',
      email: 'access@acme.example',
      phone: '+1 613 555 0100',
      address: {
        streetAddress: '1 Elgin St',
        addressLocality: 'Ottawa',
        addressRegion: 'ON',
        postalCode: 'K1P 5K7',
        addressCountry: 'Canada',
      },
      ...org,
    },
    site: {
      defaultLocale: 'en',
      locales: { en: { name: 'English' } },
      environments: { production: { url: 'https://acme.example' } },
      domains: { canonical: 'https://acme.example' },
      legal: { accessibilityStatement: { enabled: true, ...st } },
      ...site,
    },
  } as Config;
}

const messages = (cfg: unknown) =>
  validateConfig(cfg)
    .errors.map((e) => e.message)
    .join(' | ');

describe('accessibilityStatement config', () => {
  test('a minimal enabled statement validates', () => {
    expect(validateConfig(statementConfig()).ok).toBe(true);
  });

  test('requires somebody to contact', () => {
    const cfg = statementConfig({}, {}, { email: undefined, phone: undefined, address: undefined });
    expect(validateConfig(cfg).ok).toBe(false);
    expect(messages(cfg)).toContain('requires a contact');
  });

  test('a phone number alone is a reachable channel', () => {
    const cfg = statementConfig({}, {}, { email: undefined, address: undefined });
    expect(resolveAccessibilityContact(cfg)?.phone).toBe('+1 613 555 0100');
    expect(validateConfig(cfg).ok).toBe(true);
  });

  test("prefers the statement's own contact over the organization's", () => {
    const cfg = statementConfig({ contact: { email: 'a11y@acme.example' } });
    expect(resolveAccessibilityContact(cfg)?.email).toBe('a11y@acme.example');
  });

  test('a contact string must be an organization.locations key', () => {
    expect(messages(statementConfig({ contact: 'nowhere' }))).toContain('organization.locations');
  });

  test('a conformance claim needs the date the site was tested', () => {
    expect(messages(statementConfig({ conformance: 'partial' }))).toContain('testedOn');
    expect(
      validateConfig(statementConfig({ conformance: 'partial', testedOn: '2026-10-01' })).ok,
    ).toBe(true);
  });

  test('"full" cannot be claimed alongside known limitations', () => {
    const cfg = statementConfig({
      conformance: 'full',
      testedOn: '2026-10-01',
      limitations: [{ content: 'The map', issue: 'It cannot be used with a screen reader.' }],
    });
    expect(messages(cfg)).toContain('contradicts');
  });

  test('"mandatory" is incompatible with a target below AA', () => {
    const cfg = statementConfig({ mandatory: true }, { accessibility: { level: 'A' } });
    expect(messages(cfg)).toContain('incompatible');
    // Unset level defaults to AA, which is fine.
    expect(validateConfig(statementConfig({ mandatory: true })).ok).toBe(true);
  });

  test('a policy title is link text, so it cannot be generic', () => {
    const cfg = statementConfig({
      policies: [{ title: 'Click here', url: 'https://acme.example/p' }],
    });
    expect(messages(cfg)).toContain('generic link text');
  });

  test('URLs are http(s) only: a javascript: URL is rejected at parse time', () => {
    const cfg = statementConfig({ feedbackUrl: 'javascript:alert(1)' } as never);
    expect(validateConfig(cfg).ok).toBe(false);
  });

  test('rejects an unknown law, so a typo cannot silently drop the AODA wording', () => {
    expect(validateConfig(statementConfig({ law: 'aoda2' } as never)).ok).toBe(false);
  });
});

describe('accessibilityStatementWarnings', () => {
  test('is quiet when the statement is off, and for a healthy one', () => {
    const off = statementConfig();
    off.site.legal!.accessibilityStatement!.enabled = false;
    expect(accessibilityStatementWarnings(off)).toEqual([]);
    expect(accessibilityStatementWarnings(statementConfig())).toEqual([]);
  });

  test('warns when email is the only channel', () => {
    const cfg = statementConfig({}, {}, { phone: undefined, address: undefined });
    expect(accessibilityStatementWarnings(cfg).join(' ')).toContain('only contact channel');
  });

  test('warns about an external audit with no auditor, and a claim with no lastUpdated', () => {
    const w = accessibilityStatementWarnings(
      statementConfig({
        testing: ['external-audit'],
        conformance: 'partial',
        testedOn: '2026-10-01',
      }),
    ).join(' ');
    expect(w).toContain('auditor');
    expect(w).toContain('lastUpdated');
  });

  test('warns when the declared target is below AA', () => {
    const w = accessibilityStatementWarnings(
      statementConfig({}, { accessibility: { level: 'none' } }),
    ).join(' ');
    expect(w).toContain('Most accessibility law asks for AA');
  });
});
