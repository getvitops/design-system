/**
 * Credential loaders shared by `search setup`, `search notify`, `ads setup` and
 * `reviews` — every command that talks to Google or Cloudflare. Never reads a
 * config file: these are secrets, and a `site.json` is committed.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  SCOPES,
  parseServiceAccount,
  adcCredentialsPath,
  adcQuotaProject,
  parseAdcUser,
  type GoogleCredential,
  type ServiceAccount,
} from '@getvitops/utils/indexing';
import type { GoogleOAuth } from '@getvitops/utils/onboarding';
import { fail } from './commands/shared.ts';

/**
 * The Search Console credential, from either supported source.
 *
 * Never from the config file: it is the one genuine secret in this command, and a
 * `site.json` is committed. Returns `undefined` rather than failing, so a site
 * running IndexNow alone doesn't need a GCP project at all.
 */
export function loadServiceAccount(): ServiceAccount | undefined {
  const inline = process.env.VITOPS_GSC_SERVICE_ACCOUNT;
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const raw = inline ?? (path && existsSync(path) ? readFileSync(path, 'utf8') : undefined);
  if (!raw) return undefined;
  // An ADC file is not a malformed service account, it is a different KIND of
  // credential — and one this command already supports. `GOOGLE_APPLICATION_CREDENTIALS`
  // is exactly where `gcloud auth application-default login` writes an
  // `authorized_user` file, so parsing it as a service account died on "missing
  // client_email or private_key" while holding a perfectly usable user credential.
  // Hand it to the OAuth path rather than failing.
  if (parseAdcUser(raw)) return undefined;
  try {
    return parseServiceAccount(raw);
  } catch (err) {
    fail(
      `${inline ? 'VITOPS_GSC_SERVICE_ACCOUNT' : `GOOGLE_APPLICATION_CREDENTIALS (${path})`}: ${(err as Error).message}`,
    );
  }
}

/**
 * The Cloudflare DNS credential. From the environment only — a `site.json` is
 * committed, and this is a real secret. A `Zone:DNS:Edit` token (the standard
 * "Edit zone DNS" template, which also carries `Zone:Read`).
 */
export function loadCloudflareToken(): string | undefined {
  return process.env.CLOUDFLARE_API_TOKEN || undefined;
}

/** The message printed everywhere a missing Cloudflare token blocks a command. */
export const CLOUDFLARE_TOKEN_HINT =
  'set CLOUDFLARE_API_TOKEN (a Zone:DNS:Edit token — the standard "Edit zone DNS" template, ' +
  'which also carries the Zone:Read that the zone-by-name lookup needs)';

/**
 * Set when the Google credential came from an ADC file rather than the env vars.
 *
 * Provenance matters for exactly one check: an ADC credential authenticates through
 * a shared OAuth client that owns no project, so it CANNOT work without
 * `site.google.project`, while a credential from your own OAuth client works fine
 * without one. Knowing which we hold is what turns Google's "requires a quota
 * project" 403 into an error that names the field and the likely value.
 */
let adcOrigin: { path: string; project?: string } | undefined;

/**
 * Refuse an ADC credential with no project, before spending a request on a 403.
 *
 * This is the mistake waiting for the *second* site: the command is copied from
 * whatever onboarded the first one, `site.google.project` is left out, and Google
 * answers with a message about quota projects that names neither the config field
 * nor the file the credential came from.
 */
export function requireAdcProject(project: string | undefined, input: string): void {
  if (!adcOrigin || project) return;
  fail(
    `this Google credential comes from ${adcOrigin.path}, which authenticates through a shared ` +
      `OAuth client that owns no project — so it needs "site.google.project" in ${input} to say ` +
      `which project the API usage belongs to.` +
      (adcOrigin.project
        ? `\n  gcloud recorded "${adcOrigin.project}" as the quota project for that login, so that is probably the value.`
        : '') +
      `\n  One project per site keeps each site's usage and billing separate. That project also ` +
      `needs searchconsole.googleapis.com and siteverification.googleapis.com enabled, and the ` +
      `identity needs serviceusage.services.use on it.` +
      `\n  Or set VITOPS_GOOGLE_CLIENT_ID / _CLIENT_SECRET / _REFRESH_TOKEN to use your own OAuth client instead.`,
  );
}

/**
 * The Google user-OAuth credential (refresh-token flow), from the environment.
 *
 * A user token, not a service account: onboarding acts *as a person* who can own
 * the sites. All-or-nothing — a partial set is a misconfiguration worth naming
 * rather than a reason to run degraded.
 */
export function loadGoogleOAuth(): GoogleOAuth | undefined {
  const clientId = process.env.VITOPS_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.VITOPS_GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.VITOPS_GOOGLE_REFRESH_TOKEN;
  // Explicit vars win over ambient credentials: an operator who set them meant them,
  // and a stale gcloud login silently overriding a deliberate CI secret is the worst
  // available precedence. Fall back to ADC only when nothing was set at all — that is
  // what makes "I'm logged in to gcloud" enough for a one-time human `search setup`.
  if (!clientId && !clientSecret && !refreshToken) {
    const path =
      process.env.GOOGLE_APPLICATION_CREDENTIALS ??
      adcCredentialsPath({ env: process.env, platform: process.platform, home: homedir(), join });
    if (path && existsSync(path)) {
      const raw = readFileSync(path, 'utf8');
      const adc = parseAdcUser(raw);
      if (adc) {
        // Remember that this came from ADC, and what project gcloud recorded with it.
        // A shared-client credential is refused outright without a project, so the
        // preflight below can name the likely value instead of leaving a bare 403.
        const recorded = adcQuotaProject(raw);
        adcOrigin = recorded ? { path, project: recorded } : { path };
        return adc;
      }
    }
    return undefined;
  }
  const missing = [
    ['VITOPS_GOOGLE_CLIENT_ID', clientId],
    ['VITOPS_GOOGLE_CLIENT_SECRET', clientSecret],
    ['VITOPS_GOOGLE_REFRESH_TOKEN', refreshToken],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) fail(`incomplete Google OAuth credential — missing ${missing.join(', ')}`);
  return { clientId: clientId!, clientSecret: clientSecret!, refreshToken: refreshToken! };
}

/**
 * Whether `oauth` can actually be used to read live state.
 *
 * An ADC credential with no project is refused outright by `requireAdcProject` —
 * so for the purposes of "can this dry run read live state", it is not usable
 * credentials, the same as no credential at all.
 */
export function isOauthUsable(
  oauth: GoogleOAuth | undefined,
  project: string | undefined,
): boolean {
  return !!oauth && !(adcOrigin && !project);
}

/**
 * The Google identity for `search notify`, preferring a service account.
 *
 * Search Console accepts either, and the preference is about *where this command
 * runs*: it fires on every deploy, in CI, and a service account has no expiry,
 * while a refresh token can be revoked — and for an OAuth client still in
 * *Testing* publishing status Google expires it after 7 days, which is a bad
 * property for a deploy step. So the robot wins when it is available.
 *
 * The fallback is the point, though. `search setup` needs user OAuth (verifying
 * a site makes the caller an owner, which should be a person), so a consumer who
 * ran setup already has a Google credential. Demanding a second, unrelated one
 * for the other half of the same command bought nothing.
 */
export function loadSearchCredential(): GoogleCredential | undefined {
  const account = loadServiceAccount();
  if (account) return { kind: 'service-account', account, scope: SCOPES.webmasters };
  const oauth = loadGoogleOAuth();
  return oauth ? { kind: 'oauth', oauth } : undefined;
}

/** Both spellings, for an error that has to tell you what to actually set. */
export const CREDENTIAL_HINT =
  'a service account in VITOPS_GSC_SERVICE_ACCOUNT / GOOGLE_APPLICATION_CREDENTIALS, or a user OAuth credential in VITOPS_GOOGLE_CLIENT_ID / VITOPS_GOOGLE_CLIENT_SECRET / VITOPS_GOOGLE_REFRESH_TOKEN';
