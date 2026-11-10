/**
 * The site's one on-demand endpoint: contact-form posts (the `vitops_form` block) and the
 * conversion beacons (`<Tracking />`, `tel:`/`mailto:` clicks) all arrive here.
 *
 * Every public page is prerendered (see .agents/skills/content-and-deploys); this route sets
 * `prerender = false` because it has to run on each request. It is the one exception, and the
 * Cloudflare adapter handles it in the Worker beside the EmDash admin.
 *
 * Credentials are functions of the request, read from the Worker's bindings and never from
 * `site.json`:
 *   VITOPS_TURNSTILE_SECRET            created by `vitops setup turnstile`
 *   EMAIL                              the `send_email` binding in wrangler.jsonc
 *   VITOPS_HUBSPOT_ACCESS_TOKEN        or VITOPS_ZOHO_* / VITOPS_JOBBER_*, when `site.crm` is set
 *
 * Where a submission goes: `site.notifications.email` (or the primary location's email) and,
 * when `site.crm` is set, the CRM. The email is the durability floor: a failed CRM write never
 * fails the request and is stated in the email. With neither configured the post is refused,
 * because accepting a message nobody receives is worse than an error page.
 */
import { env } from 'cloudflare:workers';
import {
  createConversionRoute,
  toNotifyContext,
  type RateLimitStore,
} from '@getvitops/astro/routes';
import type { APIRoute } from 'astro';
import config from '../../../site.json' with { type: 'json' };

export const prerender = false;

type Site = Parameters<typeof toNotifyContext>[0];
const site = config as unknown as Site;

/**
 * Challenge every form post that carries no token when a Turnstile key exists. `false` keeps a
 * no-JavaScript visitor able to submit, at the price that a bot can simply omit the token and be
 * held only by the honeypot, origin and rate checks. A form that gets spam should keep this true.
 */
const TURNSTILE_REQUIRED = true;

const bindings: Record<string, unknown> = env;
const secret = (name: string): string | undefined => {
  const v = bindings[name];
  return typeof v === 'string' && v ? v : undefined;
};

/**
 * One store for the life of the isolate. `createConversionRoute` builds its default store per
 * call, and this handler builds a route per request (the redirect depends on the form's page),
 * so the default would never see a second hit. Per-isolate only; a fleet-wide limit needs a KV
 * or Durable Object store behind the same one-method interface.
 */
const hits = new Map<string, number>();
const rateLimitStore: RateLimitStore = {
  hit(id, at) {
    const prev = hits.get(id);
    hits.set(id, at);
    if (hits.size > 5000) for (const [k, t] of hits) if (at - t > 60_000) hits.delete(k);
    return prev === undefined ? null : at - prev;
  },
};

/** A same-site path or nothing: `_next` comes from the request, so it must never be an open redirect. */
function safeNext(input: unknown): string | null {
  const v = typeof input === 'string' ? input : '';
  if (!v.startsWith('/') || v.startsWith('//') || v.includes('\\') || v.length > 200) return null;
  return /[\u0000-\u001f\u007f#?]/.test(v) ? null : v;
}

function crmCredentials() {
  const crm = site.site.crm;
  if (!crm) return undefined;
  switch (crm.provider) {
    case 'hubspot': {
      const accessToken = secret('VITOPS_HUBSPOT_ACCESS_TOKEN');
      return accessToken ? { provider: 'hubspot' as const, hubspot: { accessToken } } : undefined;
    }
    case 'bigin': {
      const clientId = secret('VITOPS_ZOHO_CLIENT_ID');
      const clientSecret = secret('VITOPS_ZOHO_CLIENT_SECRET');
      const refreshToken = secret('VITOPS_ZOHO_REFRESH_TOKEN');
      return clientId && clientSecret && refreshToken
        ? { provider: 'bigin' as const, bigin: { clientId, clientSecret, refreshToken } }
        : undefined;
    }
    case 'jobber': {
      const clientId = secret('VITOPS_JOBBER_CLIENT_ID');
      const clientSecret = secret('VITOPS_JOBBER_CLIENT_SECRET');
      const refreshToken = secret('VITOPS_JOBBER_REFRESH_TOKEN');
      return clientId && clientSecret && refreshToken
        ? { provider: 'jobber' as const, jobber: { clientId, clientSecret, refreshToken } }
        : undefined;
    }
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  const context = toNotifyContext(site);
  const isForm = /multipart\/form-data|application\/x-www-form-urlencoded/.test(
    request.headers.get('content-type') ?? '',
  );

  // Where a no-JS visitor lands: the page the form was on, with the fragment that reveals the
  // right notice. A JSON/beacon caller gets a JSON response and never reaches these.
  let next: string | null = null;
  if (isForm) {
    try {
      next = safeNext((await request.clone().formData()).get('_next'));
    } catch {
      // A body that will not parse is the route's own 400; the redirect falls back to the root.
    }
  }
  const page = next ?? '/';
  const sent = `${page}?sent=1#form-sent`;
  const failed = `${page}?error=1#form-error`;

  // Nothing to deliver to: refuse rather than accept and lose the message.
  if (
    isForm &&
    !context.notifications?.email &&
    !context.locationEmails?.length &&
    !site.site.crm
  ) {
    console.error(
      '[vitops] form post refused: set site.notifications.email (or a location email, or site.crm) in site.json',
    );
    return Response.redirect(new URL(failed, request.url), 303);
  }

  // A site key means the page renders the widget, so a missing secret would mean a check that
  // nothing enforces. Fail closed.
  const siteKey = site.site.security?.turnstile?.siteKey;
  const turnstileSecret = secret('VITOPS_TURNSTILE_SECRET');
  if (isForm && siteKey && !turnstileSecret) {
    console.error(
      '[vitops] form post refused: site.security.turnstile.siteKey is set but the VITOPS_TURNSTILE_SECRET Worker secret is not (run `vitops setup turnstile`)',
    );
    return Response.redirect(new URL(failed, request.url), 303);
  }

  const handle = createConversionRoute({
    context,
    binding: () => bindings['EMAIL'] as never,
    ...(site.site.crm
      ? { crm: { config: site.site.crm, credentials: () => crmCredentials() } }
      : {}),
    ...(siteKey && turnstileSecret
      ? { turnstile: { secretKey: turnstileSecret, required: TURNSTILE_REQUIRED } }
      : {}),
    // The request's own origin: a cross-site form post carries a different `Origin` and is
    // refused. Set `site.domains.canonical` and this follows it instead.
    ...(context.canonical ? {} : { allowedOrigin: new URL(request.url).origin }),
    rateLimit: { store: rateLimitStore },
    redirectTo: sent,
    errorRedirectTo: failed,
  });
  return handle({ request, locals });
};
