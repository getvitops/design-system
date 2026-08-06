/**
 * Application Default Credentials — recognising a credential gcloud already wrote.
 *
 * `gcloud auth application-default login` writes
 * `{ client_id, client_secret, refresh_token, type: "authorized_user" }`, which maps
 * field-for-field onto the refresh-token grant this package already performs. So the
 * only thing that ever stood between "I'm logged in to gcloud" and `vitops search`
 * was recognising the shape.
 *
 * Pure, and here rather than in the CLI, for the reason the consent store and the
 * indexing planner are: the decidable part (is this a user credential? where would
 * gcloud have put it?) is worth asserting without a filesystem, and the CLI keeps
 * only the `readFileSync`. `type` is the discriminator Google's own libraries switch
 * on — never the presence of fields, since a service-account JSON also has a `type`.
 */
import type { GoogleOAuth } from './token.ts';

/** A parsed ADC user credential, or `undefined` if `raw` is not one. */
export function parseAdcUser(raw: string): GoogleOAuth | undefined {
  let parsed: {
    type?: string;
    client_id?: string;
    client_secret?: string;
    refresh_token?: string;
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return undefined;
  }
  if (parsed.type !== 'authorized_user') return undefined;
  // A truncated or half-written file is not a credential. Returning a partial one
  // would defer the failure to a token exchange whose error names the wrong cause.
  if (!parsed.client_id || !parsed.client_secret || !parsed.refresh_token) return undefined;
  return {
    clientId: parsed.client_id,
    clientSecret: parsed.client_secret,
    refreshToken: parsed.refresh_token,
  };
}

/** The quota project gcloud recorded with an ADC credential, if any. */
export function adcQuotaProject(raw: string): string | undefined {
  try {
    return (JSON.parse(raw) as { quota_project_id?: string }).quota_project_id || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Where gcloud keeps ADC when nothing points at it explicitly.
 *
 * Reading the well-known path is what makes "I'm logged in" mean something, instead
 * of asking the user to export a variable at a file gcloud already wrote.
 * `CLOUDSDK_CONFIG` wins if set, as it does for gcloud itself.
 *
 * Every input is a parameter so the platform branches are testable on one machine.
 */
export function adcCredentialsPath(opts: {
  env: Record<string, string | undefined>;
  platform: string;
  home: string | undefined;
  join: (...parts: string[]) => string;
}): string | undefined {
  const { env, platform, home, join } = opts;
  const sdk = env.CLOUDSDK_CONFIG;
  if (sdk) return join(sdk, 'application_default_credentials.json');
  if (platform === 'win32') {
    return env.APPDATA
      ? join(env.APPDATA, 'gcloud', 'application_default_credentials.json')
      : undefined;
  }
  return home ? join(home, '.config', 'gcloud', 'application_default_credentials.json') : undefined;
}
