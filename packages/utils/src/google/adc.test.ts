import { describe, expect, it } from 'vitest';
import { adcCredentialsPath, adcQuotaProject, parseAdcUser } from './adc.ts';
import { googleHeaders } from './token.ts';

const join = (...parts: string[]) => parts.join('/');

/** The shape gcloud actually writes — captured from a real ADC login. */
const ADC = JSON.stringify({
  account: 'alex@example.com',
  client_id: '764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com',
  client_secret: 'shh',
  quota_project_id: 'acme-web',
  refresh_token: '1//refresh',
  type: 'authorized_user',
  universe_domain: 'googleapis.com',
});

describe('parseAdcUser', () => {
  it('recognises a gcloud ADC user credential', () => {
    expect(parseAdcUser(ADC)).toEqual({
      clientId: '764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com',
      clientSecret: 'shh',
      refreshToken: '1//refresh',
    });
  });

  /**
   * The bug this exists to prevent: `GOOGLE_APPLICATION_CREDENTIALS` is Google's own
   * convention AND where gcloud puts ADC, so the same variable carries both kinds.
   * Parsing an ADC file as a service account died on "missing client_email or
   * private_key" while holding a perfectly usable user credential.
   */
  it('is not confused with a service account, in either direction', () => {
    const sa = JSON.stringify({
      type: 'service_account',
      client_email: 'robot@acme.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n',
    });
    expect(parseAdcUser(sa)).toBeUndefined();
    // And a user credential has neither of the fields a service account is parsed for.
    const parsed = JSON.parse(ADC) as Record<string, unknown>;
    expect(parsed.client_email).toBeUndefined();
    expect(parsed.private_key).toBeUndefined();
  });

  it('rejects a half-written file rather than deferring the failure', () => {
    // A partial credential would fail later, in a token exchange whose error names
    // the wrong cause.
    expect(
      parseAdcUser(JSON.stringify({ type: 'authorized_user', client_id: 'a' })),
    ).toBeUndefined();
    expect(parseAdcUser('not json')).toBeUndefined();
    expect(parseAdcUser('{}')).toBeUndefined();
  });
});

describe('adcQuotaProject', () => {
  it('reads the project gcloud recorded, and tolerates its absence', () => {
    expect(adcQuotaProject(ADC)).toBe('acme-web');
    expect(adcQuotaProject(JSON.stringify({ type: 'authorized_user' }))).toBeUndefined();
    expect(adcQuotaProject('nope')).toBeUndefined();
  });
});

describe('adcCredentialsPath', () => {
  it('honours CLOUDSDK_CONFIG above everything', () => {
    expect(
      adcCredentialsPath({
        env: { CLOUDSDK_CONFIG: '/cfg', APPDATA: '/app' },
        platform: 'linux',
        home: '/home/a',
        join,
      }),
    ).toBe('/cfg/application_default_credentials.json');
  });

  it('uses the per-platform default otherwise', () => {
    expect(adcCredentialsPath({ env: {}, platform: 'linux', home: '/home/a', join })).toBe(
      '/home/a/.config/gcloud/application_default_credentials.json',
    );
    expect(
      adcCredentialsPath({ env: { APPDATA: '/app' }, platform: 'win32', home: '/h', join }),
    ).toBe('/app/gcloud/application_default_credentials.json');
  });

  it('returns undefined rather than a nonsense path when there is no home', () => {
    expect(
      adcCredentialsPath({ env: {}, platform: 'linux', home: undefined, join }),
    ).toBeUndefined();
    expect(adcCredentialsPath({ env: {}, platform: 'win32', home: '/h', join })).toBeUndefined();
  });
});

/**
 * The header is the whole reason ADC needs a project. Measured against the live API:
 * without it, `403 "requires a quota project, which is not set by default"`; with it,
 * the call is accepted and Google answers about the project instead.
 */
describe('googleHeaders', () => {
  it('sends x-goog-user-project only when there is a project', () => {
    expect(googleHeaders('tok')).toEqual({ authorization: 'Bearer tok' });
    expect(googleHeaders({ token: 'tok' })).toEqual({ authorization: 'Bearer tok' });
    expect(googleHeaders({ token: 'tok', quotaProject: 'acme-web' })).toEqual({
      authorization: 'Bearer tok',
      'x-goog-user-project': 'acme-web',
    });
  });

  it('keeps the bare-token form working', () => {
    // Every caller passed a string before per-site projects existed, and a
    // service-account caller never needs more.
    expect(googleHeaders('tok', { 'content-type': 'application/json' })).toEqual({
      authorization: 'Bearer tok',
      'content-type': 'application/json',
    });
  });
});
