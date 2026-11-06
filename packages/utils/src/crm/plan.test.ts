import { describe, expect, it } from 'vite-plus/test';
import { planCrm } from './plan.ts';
import type { CrmConfig, CrmCredentials } from './types.ts';

const hubspotConfig: CrmConfig = {
  provider: 'hubspot',
  hubspot: { portalId: '123', formGuid: 'abc' },
};
const biginConfig: CrmConfig = {
  provider: 'bigin',
  bigin: { dataCenter: 'ca' },
};
const hubspotCreds: CrmCredentials = { provider: 'hubspot', hubspot: { accessToken: 'tok' } };
const biginCreds: CrmCredentials = {
  provider: 'bigin',
  bigin: { clientId: 'id', clientSecret: 'secret', refreshToken: 'rt' },
};
const jobberConfig: CrmConfig = { provider: 'jobber', jobber: {} };
const jobberCreds: CrmCredentials = {
  provider: 'jobber',
  jobber: { clientId: 'id', clientSecret: 'secret', refreshToken: 'rt' },
};

describe('planCrm', () => {
  it('is off, with a reason, when no crm is configured', () => {
    const plan = planCrm(undefined, hubspotCreds);
    expect(plan.enabled).toBe(false);
    expect(plan.skip).toMatch(/crm/);
  });

  it('is off, with a reason, when crm.enabled is explicitly false', () => {
    const plan = planCrm({ ...hubspotConfig, enabled: false }, hubspotCreds);
    expect(plan.enabled).toBe(false);
    expect(plan.skip).toMatch(/enabled/);
  });

  it('is off when provider is hubspot but crm.hubspot is missing', () => {
    const plan = planCrm({ provider: 'hubspot' }, hubspotCreds);
    expect(plan.enabled).toBe(false);
    expect(plan.skip).toMatch(/hubspot/);
  });

  it('is off when provider is bigin but crm.bigin is missing', () => {
    const plan = planCrm({ provider: 'bigin' }, biginCreds);
    expect(plan.enabled).toBe(false);
    expect(plan.skip).toMatch(/bigin/);
  });

  it('is off, with a reason, when no credentials are supplied', () => {
    const plan = planCrm(hubspotConfig, undefined);
    expect(plan.enabled).toBe(false);
    expect(plan.skip).toMatch(/HubSpot access token/);
  });

  it('is off when credentials are for the wrong provider', () => {
    const plan = planCrm(hubspotConfig, biginCreds);
    expect(plan.enabled).toBe(false);
    expect(plan.skip).toMatch(/hubspot.*bigin/);
  });

  it('is on when config and matching credentials both resolve (hubspot)', () => {
    const plan = planCrm(hubspotConfig, hubspotCreds);
    expect(plan).toEqual({ enabled: true, provider: 'hubspot' });
  });

  it('is on when config and matching credentials both resolve (bigin)', () => {
    const plan = planCrm(biginConfig, biginCreds);
    expect(plan).toEqual({ enabled: true, provider: 'bigin' });
  });

  it('is off when provider is jobber but crm.jobber is missing', () => {
    const plan = planCrm({ provider: 'jobber' }, jobberCreds);
    expect(plan.enabled).toBe(false);
    expect(plan.skip).toMatch(/jobber/);
  });

  it('is on when config and matching credentials both resolve (jobber)', () => {
    const plan = planCrm(jobberConfig, jobberCreds);
    expect(plan).toEqual({ enabled: true, provider: 'jobber' });
  });
});
