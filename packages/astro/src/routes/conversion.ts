/**
 * The conversion endpoint, as a factory.
 *
 * A site's contact form and its `tel:`/`mailto:` beacons all mean the same
 * thing — someone got in touch — and all want the same treatment: read the
 * attribution cookie off the request, build the event, notify whoever the
 * config says. That is the same three lines in every project, so it ships
 * here.
 *
 * What deliberately does **not** ship here is field-level validation and business
 * rules — a consumer's form has its own required fields and its own response
 * shape, and baking a guess at those in would make the factory something to
 * fight rather than mount. The handler takes the parsed body and an optional
 * `validate`; that part is the caller's. What **does** ship here is generic abuse
 * resistance (honeypot, origin, rate limit, body size): this is a public,
 * unauthenticated endpoint that sends email, so leaving it wide open makes it a
 * relay and a cost amplifier regardless of whose form is behind it.
 *
 * The path matters: the capture script beacons `tel:`/`mailto:` conversions at
 * `TRACKING_ENDPOINT` (`/api/track`, exported from `@getvitops/astro/tracking`),
 * and the integration warns at build if no route answers it.
 *
 * ```ts
 * // src/pages/api/track.ts
 * export const prerender = false;
 * import { env } from 'cloudflare:workers';
 * import { createConversionRoute } from '@getvitops/astro/routes';
 *
 * export const POST = createConversionRoute({
 *   context: {
 *     // A bare address is shorthand for `{ provider: 'cloudflare', to }`.
 *     notifications: { email: 'sales@acme.ca' },
 *     canonical: 'https://acme.ca',
 *     organizationName: 'Acme',
 *   },
 *   binding: () => env.EMAIL,
 *   // A no-JS <form method="post"> submission never sees a JSON response body —
 *   // it's a full navigation, so send it somewhere real.
 *   redirectTo: '/thanks',
 * });
 * ```
 *
 * Cloudflare Turnstile is a separate, opt-in layer on top of the checks above —
 * pass `turnstile: { secretKey }` and a submission carrying a
 * `cf-turnstile-response` token gets it verified server-side via
 * `verifyTurnstileToken` (`@getvitops/utils/security`). The widget itself is the
 * consumer's own markup (`<script src="https://challenges.cloudflare.com/
 * turnstile/v0/api.js" async defer></script>` + `<div class="cf-turnstile"
 * data-sitekey="…">` on their form) — there is no `FormRenderer` for this to hook
 * into generically, matching how the rest of the form is already hand-written.
 * `site.security.turnstile.siteKey` is what the generated privacy policy reads to
 * name Turnstile as a processor; wiring this option up is what makes that true
 * rather than an assertion nothing checks.
 *
 * Two things this example used to get wrong, both of which cost a consumer real
 * time. It read the binding off `locals.runtime.env`, which Astro removed in v6
 * — and because the resulting throw precedes the response, Astro re-reads the
 * request and reports a misleading "Body has already been used" instead of the
 * actual error. This package peers on `astro >= 7`, so that form could not work
 * for any supported consumer; `import { env } from 'cloudflare:workers'` is the
 * current one. It also called a `toNotifyContext(config)` helper that used to
 * not exist — `context` can now be built with `toNotifyContext(config)` (also
 * exported from this module), rather than every consumer hand-writing a
 * `NotifyContext` literal:
 *
 * ```ts
 * import config from '../../site.json' with { type: 'json' };
 * import { createConversionRoute, toNotifyContext, toCrmConfig } from '@getvitops/astro/routes';
 *
 * export const POST = createConversionRoute({
 *   context: toNotifyContext(config),
 *   crm: toCrmConfig(config) && { config: toCrmConfig(config)!, credentials: () => ({ ... }) },
 *   binding: () => env.EMAIL,
 *   redirectTo: '/thanks',
 * });
 * ```
 */
import { deliverToCrm, describeCrmResult } from '@getvitops/utils/crm';
import type { CrmConfig, CrmCredentials, CrmResult } from '@getvitops/utils/crm';
import { type EmailBinding, notify, type NotifyContext } from '@getvitops/utils/notify';
import { verifyTurnstileToken } from '@getvitops/utils/security';
import { parseTrackingCookie, readCookie } from '@getvitops/utils/tracking';
import type { ConversionEvent } from '@getvitops/utils/tracking';
export { resolveOrganizationName, toCrmConfig, toNotifyContext } from './config-adapters.ts';

/** The subset of Astro's `APIContext` this needs — typed structurally so the
 * factory does not pin an Astro version. */
export interface ConversionRequestContext {
  request: Request;
  locals?: unknown;
}

/**
 * Records a hit for `id` at time `at` (ms) and returns the ms since the previous
 * hit for that `id`, or `null` if this is the first. Pure interface — a store
 * decides nothing, it only remembers.
 */
export interface RateLimitStore {
  hit(id: string, at: number): Promise<number | null> | number | null;
}

/**
 * Per-isolate, in-memory default. Good enough for a single Worker instance
 * fielding occasional contact-form spam; not durable across a fleet, and not
 * shared with other routes. Inject a KV- or Durable-Object-backed `store` for
 * real cross-instance limiting — the interface is one method wide on purpose.
 */
class MemoryRateLimitStore implements RateLimitStore {
  private lastHit = new Map<string, number>();
  hit(id: string, at: number): number | null {
    const prev = this.lastHit.get(id);
    this.lastHit.set(id, at);
    return prev === undefined ? null : at - prev;
  }
}

export interface ConversionRouteOptions {
  /** Where notifications go. Build it from your site config. */
  context: NotifyContext;
  /**
   * The Workers `send_email` binding for this request, e.g. `() => env.EMAIL`
   * with `env` imported from `cloudflare:workers`. Omit it in dev and the
   * notification is printed instead of sent.
   *
   * Not `(locals) => locals.runtime.env.EMAIL` — Astro removed `locals.runtime`
   * in v6, and this package peers on `>= 7`.
   */
  binding?: (locals: unknown) => EmailBinding | undefined;
  /**
   * Push the submission into a CRM (HubSpot, Zoho Bigin or Jobber) before notifying.
   * Credentials arrive as a function of `locals`, exactly like `binding` above
   * — the consumer reads them from `import { env } from 'cloudflare:workers'`.
   * Credentials are never config; that rule is absolute in this toolchain.
   *
   * A failed CRM write never fails the request and never blocks the honeypot/
   * Turnstile gates above it — those run first, so a bot never reaches the
   * CRM. The outcome is folded into the notification email's "Delivery"
   * section (via `describeCrmResult`) so a failed write is never silent.
   */
  crm?: {
    config: CrmConfig;
    credentials?: (locals: unknown) => CrmCredentials | undefined;
    fetch?: typeof fetch;
    timeoutMs?: number;
  };
  /**
   * Reject a submission before anything is sent. Return a message to refuse.
   * This is where a consumer puts required-field checks.
   */
  validate?: (body: Record<string, unknown>) => string | null;
  /** Called with every channel outcome, delivered or not, plus the CRM
   * outcome when `crm` is configured. Defaults to console. */
  onResult?: (result: ConversionResult) => void;
  /** Injected in tests. */
  now?: () => number;
  /**
   * Where to send a no-JS `<form method="post">` submission on success. Without
   * this, that visitor's browser navigates to the raw `{"success":true}` JSON
   * body as its next page — functional, but not a page anyone should see. Has
   * no effect on the beacon/fetch (JSON) path, which always gets a JSON response.
   */
  redirectTo?: string;
  /**
   * Where to send a refused no-JS submission (validation, spam checks, malformed
   * body). Falls back to `redirectTo` if omitted, and to the JSON error response
   * if neither is set.
   */
  errorRedirectTo?: string;
  /**
   * Field names treated as honeypots: a bot fills every input it finds, a person
   * never sees these (hidden by CSS in the form markup). A non-empty value is
   * silently treated as spam — the response looks identical to a real success,
   * denying the bot the signal it needs to know the trick worked, but nothing is
   * notified and the field never reaches `notify()`. Defaults to the same names
   * `render.ts`'s `OMIT_FIELDS` already knows about (`website`, `_honeypot`,
   * `honeypot`), so the two lists don't need to be kept in sync by hand.
   */
  honeypotFields?: string[];
  /**
   * Reject a submission whose `Content-Length` exceeds this many bytes. Default
   * 25_000 — generous for a contact form with no file upload, tiny for anything
   * meant to relay large payloads. Best-effort: `Content-Length` can be absent
   * or spoofed, same caveat as the origin check below.
   */
  maxBodyBytes?: number;
  /**
   * Reject a submission whose `Origin` header doesn't match this origin.
   * Defaults to `context.canonical`'s origin. Pass `false` to disable.
   *
   * Best-effort, not a CSRF guard: browsers omit `Origin` on plenty of
   * legitimate same-origin requests, so its *absence* is never treated as a
   * mismatch — only a present-and-different value is rejected. That still stops
   * the common case (a script hitting the endpoint directly from elsewhere)
   * without breaking real submissions from older or privacy-hardened browsers.
   */
  allowedOrigin?: string | false;
  /**
   * Minimum interval between accepted submissions from the same IP. Pass
   * `false` to disable. `windowMs` defaults to 10 seconds — enough to blunt a
   * script firing in a loop without troubling someone who fat-fingers a form
   * and resubmits.
   */
  rateLimit?: { windowMs?: number; store?: RateLimitStore } | false;
  /**
   * Verify a Cloudflare Turnstile token server-side. The **secret** key —
   * unlike `site.security.turnstile.siteKey`, which is public config — must come
   * from an env var, never a config file (the same rule as every other
   * credential in this toolchain).
   */
  turnstile?: {
    secretKey: string;
    /** The submitted field carrying the token. Default `cf-turnstile-response`
     * — the name Cloudflare's widget submits under. */
    fieldName?: string;
    /**
     * Reject a submission with no token at all, rather than only a present-and-
     * invalid one. Default `false`: an absent token is the ordinary shape of a
     * visitor with JS disabled, and this factory is built around that path
     * staying usable. Set `true` only for a form where verified-human matters
     * enough to accept that trade-off — doing so means that form no longer
     * works without JS, on purpose.
     */
    required?: boolean;
  };
}

/** `notify()`'s own result, plus the CRM outcome when `crm` is configured.
 * Additive over `Awaited<ReturnType<typeof notify>>` — a consumer's existing
 * `onResult` reading `.results`/`.delivered` keeps compiling unchanged. */
export interface ConversionResult extends Awaited<ReturnType<typeof notify>> {
  crm?: CrmResult | undefined;
}

/** Fields that are never part of a submission's meaning. `cf-turnstile-response`
 * is excluded unconditionally, matching `render.ts`'s `OMIT_FIELDS` — the field
 * carries a verification token, not something the visitor wrote. */
const CONTROL_FIELDS = new Set(['event', 'phone', 'cf-turnstile-response']);
const DEFAULT_HONEYPOT_FIELDS = ['website', '_honeypot', 'honeypot'];
const DEFAULT_MAX_BODY_BYTES = 25_000;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 10_000;

function toFormData(
  body: Record<string, unknown>,
  honeypotFields: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (CONTROL_FIELDS.has(key) || honeypotFields.includes(key)) continue;
    if (value === undefined || value === null) continue;
    out[key] = String(value);
  }
  return out;
}

function hasHoneypot(body: Record<string, unknown>, honeypotFields: string[]): boolean {
  return honeypotFields.some((field) => {
    const value = body[field];
    return typeof value === 'string' && value.trim() !== '';
  });
}

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** A `Location` header response — used for the no-JS form path instead of
 * `Response.redirect()`, which requires a base URL this factory doesn't have. */
function redirectTo(location: string, status = 303): Response {
  return new Response(null, { status, headers: { Location: location } });
}

/**
 * Build a POST handler for conversions.
 *
 * Returns 204 for a beacon and 200 with `{ success }` for a JSON (fetch-based)
 * form submission, matching what `navigator.sendBeacon` and a fetch-submitting
 * form each expect. A no-JS `<form method="post">` — `application/
 * x-www-form-urlencoded` or `multipart/form-data` — is parsed the same way and,
 * on success, redirected to `redirectTo` if one is configured.
 *
 * **A failed notification does not fail the request.** The visitor has already
 * submitted; refusing them because our mail did not go out turns a lost
 * notification into a lost conversion. Failures are reported through `onResult`.
 */
export function createConversionRoute(options: ConversionRouteOptions) {
  const {
    context,
    binding,
    validate,
    onResult,
    now = Date.now,
    redirectTo: successRedirect,
    errorRedirectTo = successRedirect,
    honeypotFields = DEFAULT_HONEYPOT_FIELDS,
    maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
  } = options;

  const allowedOrigin =
    options.allowedOrigin === false ? null : (options.allowedOrigin ?? originOf(context.canonical));

  const rateLimit =
    options.rateLimit === false
      ? null
      : {
          windowMs: options.rateLimit?.windowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS,
          store: options.rateLimit?.store ?? new MemoryRateLimitStore(),
        };

  return async ({ request, locals }: ConversionRequestContext): Promise<Response> => {
    const contentType = request.headers.get('content-type') ?? '';
    const isFormPost =
      contentType.includes('multipart/form-data') ||
      contentType.includes('application/x-www-form-urlencoded');

    const respondError = (error: string, status: number): Response =>
      isFormPost && errorRedirectTo
        ? redirectTo(errorRedirectTo)
        : Response.json({ success: false, error }, { status });

    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > maxBodyBytes) {
      return respondError('Request too large.', 413);
    }

    if (allowedOrigin) {
      const requestOrigin = request.headers.get('origin');
      if (requestOrigin && requestOrigin !== allowedOrigin) {
        return respondError('Origin not allowed.', 403);
      }
    }

    let body: Record<string, unknown>;
    try {
      if (isFormPost) {
        const formData = await request.formData();
        body = {};
        for (const [key, value] of formData.entries()) {
          if (typeof value === 'string') body[key] = value;
        }
      } else {
        // Not just `application/json`: `navigator.sendBeacon` sends a bare
        // string as `text/plain`, and this must keep accepting that body.
        const parsed: unknown = await request.json();
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return respondError('Malformed request.', 400);
        }
        body = parsed as Record<string, unknown>;
      }
    } catch {
      return respondError('Malformed request.', 400);
    }

    const ip =
      request.headers.get('cf-connecting-ip') ??
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      undefined;

    // Classified before rate limiting, not read raw off the client — see the key
    // below. `phone`/`email` presence is still checked after limiting, since that
    // check just rejects a malformed beacon rather than deciding the bucket.
    const isCall = body['event'] === 'call';
    const isEmailClick = body['event'] === 'email';

    // Keyed on IP *and* the server's own classification (`call` | `email` |
    // `form`), never the raw `event` string the client sent. A call beacon and an
    // email-click beacon from the same visitor are two distinct, legitimate
    // conversions, not a repeat of one, so they need separate buckets — but
    // trusting the raw string for that also let a client dodge the form rate
    // limit entirely by varying `event` on every request (any value other than
    // exactly `'call'`/`'email'` used to get its own bucket). Collapsing
    // everything else to `'form'` closes that without losing the call/email split.
    if (rateLimit && ip) {
      const rlKey = `${ip}:${isCall ? 'call' : isEmailClick ? 'email' : 'form'}`;
      const sinceLastHit = await rateLimit.store.hit(rlKey, now());
      if (sinceLastHit !== null && sinceLastHit < rateLimit.windowMs) {
        return respondError('Too many requests.', 429);
      }
    }

    if (isCall && typeof body['phone'] !== 'string') {
      return respondError('Missing phone.', 400);
    }

    if (isEmailClick && typeof body['email'] !== 'string') {
      return respondError('Missing email.', 400);
    }

    // A call and an email-click beacon are the same shape of thing: a fire-and-
    // forget ping with no form fields to validate, honeypot, verify or map into
    // a CRM — both skip every check below that exists for a form submission.
    const isBeacon = isCall || isEmailClick;

    const spam = !isBeacon && hasHoneypot(body, honeypotFields);

    if (!isBeacon && !spam && options.turnstile) {
      const {
        secretKey,
        fieldName = 'cf-turnstile-response',
        required = false,
      } = options.turnstile;
      const token = body[fieldName];
      if (typeof token === 'string' && token) {
        const verification = await verifyTurnstileToken(token, secretKey, ip);
        if (!verification.success) return respondError('Verification failed.', 400);
      } else if (required) {
        return respondError('Verification required.', 400);
      }
    }

    const refusal = !spam && validate?.(body);
    if (refusal) return respondError(refusal, 400);

    const respondSuccess = (): Response =>
      isBeacon
        ? new Response(null, { status: 204 })
        : isFormPost && successRedirect
          ? redirectTo(successRedirect)
          : Response.json({ success: true });

    // A honeypot trip never reaches `notify()` — the response is identical to a
    // real success, so a bot gets no signal that it was caught.
    if (spam) {
      onResult?.({
        results: [{ channel: 'email', sent: false, reason: 'Skipped: honeypot triggered.' }],
        delivered: false,
      });
      return respondSuccess();
    }

    const turnstileFieldName = options.turnstile?.fieldName;
    const excludedFields = turnstileFieldName
      ? [...honeypotFields, turnstileFieldName]
      : honeypotFields;

    const event: ConversionEvent = {
      type: isCall ? 'call' : isEmailClick ? 'email' : 'form',
      ...(isCall
        ? { phone: String(body['phone']).replace(/^tel:/, '') }
        : isEmailClick
          ? { email: String(body['email']).replace(/^mailto:/, '') }
          : { formData: toFormData(body, excludedFields) }),
      tracking: parseTrackingCookie(request.headers.get('cookie')),
      userAgent: request.headers.get('user-agent') ?? undefined,
      ip,
      at: now(),
    };

    // CRM before notify: the notification email states the CRM outcome, which
    // is only possible once it's known. Never attempted for a `tel:`/`mailto:`
    // beacon — a CRM contact comes from submitted form fields, and neither
    // event has any to map.
    let crmResult: CrmResult | null = null;
    if (!isBeacon && options.crm) {
      crmResult = await deliverToCrm(event, options.crm.config, {
        credentials: options.crm.credentials?.(locals),
        fetch: options.crm.fetch,
        timeoutMs: options.crm.timeoutMs,
        // Provider-neutral: HubSpot reads `hutk` to stitch the submission to
        // its own tracking; Jobber reads `pageUri` for its note body. Neither
        // is HubSpot-specific to build, so this is passed unconditionally
        // rather than gated on `options.crm.config.provider`.
        pageContext: {
          hutk: readCookie(request.headers.get('cookie'), 'hubspotutk') ?? undefined,
          pageUri: request.headers.get('referer') ?? undefined,
        },
      });
    }
    const crmNote = describeCrmResult(crmResult);

    const result: ConversionResult = {
      ...(await notify(
        event,
        context,
        { email: binding?.(locals) },
        crmNote ? { notes: [crmNote] } : {},
      )),
      ...(crmResult ? { crm: crmResult } : {}),
    };

    if (onResult) onResult(result);
    else {
      for (const r of result.results) {
        if (!r.sent) console.warn(`[vitops] notification not sent (${r.channel}): ${r.reason}`);
      }
      if (crmResult && !crmResult.ok) {
        console.warn(
          `[vitops] CRM write not delivered (${crmResult.provider}): ${crmResult.reason}`,
        );
      }
    }

    return respondSuccess();
  };
}
