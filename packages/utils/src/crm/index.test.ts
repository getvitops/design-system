import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { clearJobberTokenCache } from './jobber-token.ts';
import { clearZohoTokenCache } from './zoho-token.ts';
import { deliverToCrm, describeCrmResult } from './index.ts';
import type { CrmConfig, CrmCredentials } from './types.ts';

afterEach(() => {
  clearZohoTokenCache();
  clearJobberTokenCache();
});

const baseEvent = {
  formData: { name: 'Dana Smith', email: 'dana@example.com' },
  tracking: null,
  at: 0,
} as unknown as import('../tracking/types.ts').ConversionEvent;

describe('describeCrmResult', () => {
  it('returns null for a null result', () => {
    expect(describeCrmResult(null)).toBeNull();
  });

  it('labels a successful HubSpot write', () => {
    expect(describeCrmResult({ ok: true, provider: 'hubspot', recordId: '1' })).toBe(
      'Written to HubSpot (contact 1)',
    );
  });

  it('labels a failed Jobber write — not "Bigin", the old binary ternary default', () => {
    expect(describeCrmResult({ ok: false, provider: 'jobber', reason: 'boom' })).toBe(
      '⚠ Not written to Jobber: boom',
    );
  });

  it('labels a successful Jobber write', () => {
    expect(describeCrmResult({ ok: true, provider: 'jobber', recordId: 'C1' })).toBe(
      'Written to Jobber (contact C1)',
    );
  });
});

describe('deliverToCrm dispatch', () => {
  it('plans a jobber config with no jobber block as off, with a reason', async () => {
    const config = { provider: 'jobber' } as CrmConfig;
    const credentials: CrmCredentials = {
      provider: 'jobber',
      jobber: { clientId: 'id', clientSecret: 'secret', refreshToken: 'rt' },
    };
    const fetchImpl = vi.fn();
    const result = await deliverToCrm(baseEvent, config, { credentials, fetch: fetchImpl });
    expect(result?.ok).toBe(false);
    expect(result?.reason).toMatch(/jobber/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('dispatches to the jobber executor when config and credentials both name jobber', async () => {
    const config: CrmConfig = { provider: 'jobber', jobber: {} };
    const credentials: CrmCredentials = {
      provider: 'jobber',
      jobber: { clientId: 'id', clientSecret: 'secret', refreshToken: 'rt' },
    };
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        return new Response(JSON.stringify({ access_token: 'at1', expires_in: 3600 }), {
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({ data: { clientCreate: { client: { id: 'C1' }, userErrors: [] } } }),
        { status: 200 },
      );
    });
    const result = await deliverToCrm(baseEvent, config, { credentials, fetch: fetchImpl });
    expect(result?.ok).toBe(true);
    expect(result?.provider).toBe('jobber');
  });
});
