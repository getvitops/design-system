// Provision an org's defaults (plan + a site + provider connections). Used by
// the onboarding endpoint and the seed script. Runs on the OWNER client.
import { eq } from 'drizzle-orm';
import { getServer } from './runtime.ts';
import { organizationsExt, providerConnections, sites } from './db/schema/index.ts';
import type { Plan } from './capabilities.ts';
import type { Env } from './env.ts';

const DEFAULT_PROVIDERS = ['cloudflare', 'ga4', 'clarity', 'matomo', 'helpdesk-mock', 'licensing', 'scim'];

export async function provisionOrg(
  env: Env,
  organizationId: string,
  opts: { plan?: Plan; siteName?: string; siteDomain?: string } = {},
): Promise<void> {
  const { db } = getServer(env).bundle;
  const plan = opts.plan ?? 'growth';

  await db
    .insert(organizationsExt)
    .values({ organizationId, plan })
    .onConflictDoUpdate({ target: organizationsExt.organizationId, set: { plan } });

  const domain = opts.siteDomain ?? 'example.com';
  const existing = await db
    .select({ id: sites.id })
    .from(sites)
    .where(eq(sites.organizationId, organizationId));
  if (!existing.length) {
    await db
      .insert(sites)
      .values({ organizationId, name: opts.siteName ?? domain, domain, providerRefs: {} });
  }

  for (const provider of DEFAULT_PROVIDERS) {
    await db
      .insert(providerConnections)
      .values({ organizationId, provider, status: 'connected', externalOrgId: organizationId })
      .onConflictDoNothing();
  }
}
