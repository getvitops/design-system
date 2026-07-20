// Provision a freshly-created org (onboarding). Verifies the caller is a member
// of the org, then seeds plan + provider connections and runs an initial sync.
import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { member } from '../../../lib/db/schema/index.ts';
import { provisionOrg } from '../../../lib/provision.ts';
import { runSync } from '../../../workers/sync.ts';

export const prerender = false;

export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) return new Response('unauthorized', { status: 401 });

  const { organizationId } = (await request.json().catch(() => ({}))) as { organizationId?: string };
  if (!organizationId) return new Response('organizationId required', { status: 400 });

  // Membership check (owner client).
  const rows = await locals.db.db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, user.id), eq(member.organizationId, organizationId)))
    .limit(1);
  if (!rows.length) return new Response('forbidden', { status: 403 });

  await provisionOrg(locals.env, organizationId, { plan: 'growth' });
  await runSync(locals.env, { inline: true });
  return Response.json({ ok: true });
};
