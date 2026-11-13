/**
 * A config with the accessibility statement enabled, shared by the statement's config tests and its
 * content tests. A plain module (not a test file): importing a test file from another would register
 * its `describe` blocks twice.
 */
import { defaultConfig } from '../index.ts';
import type { Config } from '../config.ts';

export type Statement = NonNullable<NonNullable<Config['site']['legal']>['accessibilityStatement']>;

/** `st` patches the statement, `site` the rest of the site, `org` the organization. */
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
