import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vite-plus/test';
import { AD_PROVIDERS, BIGIN_DATA_CENTERS, CRM_PROVIDERS } from './providers.ts';
import { AdProviderSchema } from './ads.ts';
import { CrmProviderSchema, CrmSchema } from './crm.ts';

describe('closed provider lists', () => {
  it('are the vocabulary the schemas accept — one source, so they cannot drift', () => {
    for (const p of AD_PROVIDERS) expect(AdProviderSchema.safeParse(p).success).toBe(true);
    for (const p of CRM_PROVIDERS) expect(CrmProviderSchema.safeParse(p).success).toBe(true);
    expect(AdProviderSchema.safeParse('myspace').success).toBe(false);
  });

  it('name the CRMs and Bigin data centres the integrations are written against', () => {
    expect([...CRM_PROVIDERS].sort()).toEqual(['bigin', 'hubspot', 'jobber']);
    expect(BIGIN_DATA_CENTERS).toContain('ca');
  });

  it('are strict about what a CRM block may say', () => {
    expect(CrmSchema.safeParse({ provider: 'hubspot', bogus: 1 }).success).toBe(false);
    expect(CrmSchema.safeParse({ provider: 'hubspot' }).success).toBe(true);
  });
});

describe('./providers entry', () => {
  it('imports no zod — Worker code takes these lists as values, and zod would ride along', () => {
    const source = readFileSync(new URL('./providers.ts', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(source).not.toMatch(/\bfrom\s+['"][^'"]*zod/);
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});
