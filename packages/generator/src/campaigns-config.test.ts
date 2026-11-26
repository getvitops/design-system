import { describe, expect, test } from 'vite-plus/test';
import { CAMPAIGN_PROVIDERS, validateConfig } from './config.ts';
import { defaultConfig } from './index.ts';

/** A minimal valid config, varied by its `site.campaigns` block. */
function fixture(campaigns: Record<string, unknown> | undefined): unknown {
  return {
    designSystem: { themes: { default: defaultConfig() } },
    organization: { name: 'Acme', email: 'privacy@acme.example' },
    site: {
      defaultLocale: 'en',
      locales: { en: { name: 'English' } },
      environments: { production: { url: 'https://acme.example' } },
      domains: { canonical: 'https://acme.example' },
      ...(campaigns !== undefined ? { campaigns } : {}),
    },
  };
}

const errorsFor = (raw: unknown): string[] => {
  const result = validateConfig(raw);
  return result.ok ? [] : result.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
};

describe('CAMPAIGN_PROVIDERS', () => {
  test('has exactly zoho-campaigns and sendfox', () => {
    expect([...CAMPAIGN_PROVIDERS].sort()).toEqual(['sendfox', 'zoho-campaigns']);
  });
});

describe('validateConfig on site.campaigns', () => {
  test('accepts a well-formed sendfox block', () => {
    expect(
      errorsFor(
        fixture({
          provider: 'sendfox',
          lists: { waitlist: { label: 'Waitlist', sendfox: { listId: 7 } } },
        }),
      ),
    ).toEqual([]);
  });

  test('accepts a well-formed zoho-campaigns block', () => {
    expect(
      errorsFor(
        fixture({
          provider: 'zoho-campaigns',
          zohoCampaigns: { dataCenter: 'eu' },
          lists: { blog: { label: 'Blog', zohoCampaigns: { listKey: 'abc' } } },
        }),
      ),
    ).toEqual([]);
  });

  test('is optional', () => {
    expect(errorsFor(fixture(undefined))).toEqual([]);
  });

  test('rejects zoho-campaigns without its block', () => {
    expect(
      errorsFor(
        fixture({
          provider: 'zoho-campaigns',
          lists: { blog: { label: 'Blog', zohoCampaigns: { listKey: 'abc' } } },
        }),
      ).join('\n'),
    ).toContain('site.campaigns.zohoCampaigns is missing');
  });

  test('rejects a list missing the id its provider needs', () => {
    expect(
      errorsFor(
        fixture({
          provider: 'sendfox',
          lists: { waitlist: { label: 'Waitlist', zohoCampaigns: { listKey: 'abc' } } },
        }),
      ).join('\n'),
    ).toContain('list "waitlist" has no sendfox id');
  });

  test('rejects an unsupported provider and unknown keys', () => {
    expect(errorsFor(fixture({ provider: 'mailchimp', lists: {} })).length).toBeGreaterThan(0);
    expect(
      errorsFor(
        fixture({
          provider: 'sendfox',
          lists: { w: { label: 'W', sendfox: { listId: 1 } } },
          nope: true,
        }),
      ).length,
    ).toBeGreaterThan(0);
  });

  test('rejects a Canadian Zoho Campaigns data centre, whose API host is undocumented', () => {
    expect(
      errorsFor(
        fixture({
          provider: 'zoho-campaigns',
          zohoCampaigns: { dataCenter: 'ca' },
          lists: { b: { label: 'B', zohoCampaigns: { listKey: 'k' } } },
        }),
      ).length,
    ).toBeGreaterThan(0);
  });
});
