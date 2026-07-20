// The portal's environment surface. Plain `process.env` everywhere — this is a
// Node server (no Cloudflare bindings). Secrets come from the process env (a
// `.env` file locally via `node --env-file`, real env vars in the container).

export interface Env {
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  SECRET_SEAL_KEY?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  ZOHO_CLIENT_ID?: string;
  ZOHO_CLIENT_SECRET?: string;
  ZOHO_ORG_ID?: string;
}

export function getEnv(_locals?: unknown): Env {
  const proc = typeof process !== 'undefined' ? process.env : {};
  return { ...proc } as unknown as Env;
}
