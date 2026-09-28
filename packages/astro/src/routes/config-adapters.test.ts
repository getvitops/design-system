import { describe, expect, it } from 'vite-plus/test';
import type { Config } from '@getvitops/generator';
import { toCrmConfig, toNotifyContext } from './config-adapters.ts';

function config(overrides: {
  organization?: Config['organization'];
  site?: Partial<Config['site']>;
}): Config {
  return {
    designSystem: { themes: { default: {} } },
    organization: overrides.organization,
    site: {
      defaultLocale: 'en',
      locales: { en: {} },
      environments: { production: { url: 'https://acme.ca' } },
      ...overrides.site,
    },
  } as unknown as Config;
}

describe('toNotifyContext', () => {
  it('resolves a localizable organization name in the requested locale', () => {
    const cfg = config({ organization: { name: { en: 'Acme', fr: 'Acme Ltée' } } });
    expect(toNotifyContext(cfg, 'fr').organizationName).toBe('Acme Ltée');
    expect(toNotifyContext(cfg, 'de').organizationName).toBe('Acme'); // falls back to defaultLocale
  });

  it('falls back to legalName when name is unset', () => {
    const cfg = config({ organization: { legalName: 'Acme Widgets Inc.' } });
    expect(toNotifyContext(cfg).organizationName).toBe('Acme Widgets Inc.');
  });

  it('never returns an empty-string organizationName', () => {
    const cfg = config({ organization: { name: { fr: 'Acme Ltée' }, legalName: 'Acme Inc.' } });
    // requested + default locale both miss the map — t() would return '' — must fall back
    expect(toNotifyContext(cfg, 'de').organizationName).toBe('Acme Inc.');
  });

  it('carries canonical and notifications through unchanged', () => {
    const cfg = config({
      site: {
        domains: { canonical: 'https://acme.ca' },
        notifications: { email: 'owner@acme.ca' },
      },
    });
    const ctx = toNotifyContext(cfg);
    expect(ctx.canonical).toBe('https://acme.ca');
    expect(ctx.notifications).toEqual({ email: 'owner@acme.ca' });
  });

  it('orders locationEmails with the primary location first', () => {
    const cfg = config({
      organization: {
        primaryLocation: 'ottawa',
        locations: {
          toronto: { name: 'Toronto', email: 'toronto@acme.ca' },
          ottawa: { name: 'Ottawa', email: 'ottawa@acme.ca' },
        },
      },
    });
    expect(toNotifyContext(cfg).locationEmails).toEqual(['ottawa@acme.ca', 'toronto@acme.ca']);
  });

  it('drops locations with no email rather than emitting an empty string', () => {
    const cfg = config({
      organization: {
        locations: { ottawa: { name: 'Ottawa' } },
      },
    });
    expect(toNotifyContext(cfg).locationEmails).toEqual([]);
  });

  it('handles no organization at all', () => {
    const cfg = config({});
    expect(toNotifyContext(cfg)).toEqual({
      notifications: undefined,
      canonical: undefined,
      organizationName: undefined,
      locationEmails: [],
    });
  });
});

describe('toCrmConfig', () => {
  it('passes site.crm through unchanged', () => {
    const crm: Config['site']['crm'] = {
      provider: 'hubspot',
      hubspot: { portalId: '123', formGuid: 'abc' },
    };
    expect(toCrmConfig(config({ site: { crm } }))).toEqual(crm);
  });

  it('returns undefined when crm is unset', () => {
    expect(toCrmConfig(config({}))).toBeUndefined();
  });
});
