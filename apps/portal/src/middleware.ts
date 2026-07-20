// Request pipeline: attach server context, resolve the session + active org +
// plan, then enforce auth and plan-based capability gating. Tenant data is only
// ever read through `locals.scoped(...)` (RLS), never the raw owner client.
import { defineMiddleware } from 'astro:middleware';
import { eq } from 'drizzle-orm';
import { hasCapability, type Plan, requiredCapabilityFor } from './lib/capabilities.ts';
import { withOrgScope } from './lib/db/scope.ts';
import { member, organizationsExt } from './lib/db/schema/index.ts';
import { getEnv } from './lib/env.ts';
import { getServer } from './lib/runtime.ts';

const PUBLIC_PATHS = new Set(['/login', '/signup']);
const isAuthApi = (p: string) => p.startsWith('/api/auth');

export const onRequest = defineMiddleware(async (ctx, next) => {
  const { locals, request, url } = ctx;
  const env = getEnv();
  const { bundle, auth } = getServer(env);
  locals.env = env;
  locals.db = bundle;
  locals.auth = auth;
  locals.plan = 'starter';

  // Better-Auth owns its endpoints entirely.
  if (isAuthApi(url.pathname)) return next();

  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user) {
    locals.user = session.user;
    locals.session = session.session;

    // Active tenant: session's active org, else the user's first membership.
    let activeOrgId = session.session?.activeOrganizationId ?? undefined;
    if (!activeOrgId) {
      const rows = await bundle.db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, session.user.id))
        .limit(1);
      activeOrgId = rows[0]?.organizationId;
    }

    if (activeOrgId) {
      const oid = activeOrgId;
      locals.activeOrgId = oid;
      const ext = await bundle.db
        .select({ plan: organizationsExt.plan })
        .from(organizationsExt)
        .where(eq(organizationsExt.organizationId, oid))
        .limit(1);
      locals.plan = (ext[0]?.plan as Plan) ?? 'starter';
      locals.scoped = (fn) => withOrgScope(bundle.db, oid, fn);
    }
  }

  const path = url.pathname;
  if (PUBLIC_PATHS.has(path)) return next();

  // Everything below requires an authenticated user with an active org.
  if (!session?.user) {
    return ctx.redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  if (!locals.activeOrgId) {
    if (path === '/onboarding') return next();
    return ctx.redirect('/onboarding');
  }

  const cap = requiredCapabilityFor(path);
  if (cap && !hasCapability(locals.plan, cap)) {
    return ctx.redirect(`/dashboard?denied=${cap}`);
  }

  return next();
});
