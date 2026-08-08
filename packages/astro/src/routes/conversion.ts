/**
 * The conversion endpoint, as a factory.
 *
 * A site's contact form and its `tel:` beacon both mean the same thing — someone
 * got in touch — and both want the same treatment: read the attribution cookie
 * off the request, build the event, notify whoever the config says. That is the
 * same three lines in every project, so it ships here.
 *
 * What deliberately does **not** ship here is validation and business rules. A
 * consumer's form has its own required fields, its own spam handling and its own
 * response shape, and baking a guess at those in would make the factory something
 * to fight rather than mount. The handler takes the parsed body and an optional
 * `validate`; everything else is the caller's.
 *
 * The path matters: the capture script beacons `tel:` conversions at
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
 * });
 * ```
 *
 * Two things this example used to get wrong, both of which cost a consumer real
 * time. It read the binding off `locals.runtime.env`, which Astro removed in v6
 * — and because the resulting throw precedes the response, Astro re-reads the
 * request and reports a misleading "Body has already been used" instead of the
 * actual error. This package peers on `astro >= 7`, so that form could not work
 * for any supported consumer; `import { env } from 'cloudflare:workers'` is the
 * current one. It also called a `toNotifyContext(config)` helper that does not
 * exist — `context` is a plain `NotifyContext`, built however you like.
 */
import { type EmailBinding, notify, type NotifyContext } from '@getvitops/utils/notify';
import { parseTrackingCookie } from '@getvitops/utils/tracking';
import type { ConversionEvent } from '@getvitops/utils/tracking';

/** The subset of Astro's `APIContext` this needs — typed structurally so the
 * factory does not pin an Astro version. */
export interface ConversionRequestContext {
  request: Request;
  locals?: unknown;
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
   * Reject a submission before anything is sent. Return a message to refuse.
   * This is where a consumer puts required-field checks and spam rules.
   */
  validate?: (body: Record<string, unknown>) => string | null;
  /** Called with every channel outcome, delivered or not. Defaults to console. */
  onResult?: (result: Awaited<ReturnType<typeof notify>>) => void;
  /** Injected in tests. */
  now?: () => number;
}

/** Fields that are never part of a submission's meaning. */
const CONTROL_FIELDS = new Set(['event', 'phone']);

function toFormData(body: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (CONTROL_FIELDS.has(key)) continue;
    if (value === undefined || value === null) continue;
    out[key] = String(value);
  }
  return out;
}

/**
 * Build a POST handler for conversions.
 *
 * Returns 204 for a beacon and 200 with `{ success }` for a form, matching what
 * `navigator.sendBeacon` and a fetch-submitting form each expect.
 *
 * **A failed notification does not fail the request.** The visitor has already
 * submitted; refusing them because our mail did not go out turns a lost
 * notification into a lost conversion. Failures are reported through `onResult`.
 */
export function createConversionRoute(options: ConversionRouteOptions) {
  const { context, binding, validate, onResult, now = Date.now } = options;

  return async ({ request, locals }: ConversionRequestContext): Promise<Response> => {
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return Response.json({ success: false, error: 'Malformed request.' }, { status: 400 });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return Response.json({ success: false, error: 'Malformed request.' }, { status: 400 });
    }

    const isCall = body['event'] === 'call';
    if (isCall && typeof body['phone'] !== 'string') {
      return Response.json({ success: false, error: 'Missing phone.' }, { status: 400 });
    }

    const refusal = validate?.(body);
    if (refusal) return Response.json({ success: false, error: refusal }, { status: 400 });

    const event: ConversionEvent = {
      type: isCall ? 'call' : 'form',
      ...(isCall
        ? { phone: String(body['phone']).replace(/^tel:/, '') }
        : { formData: toFormData(body) }),
      tracking: parseTrackingCookie(request.headers.get('cookie')),
      userAgent: request.headers.get('user-agent') ?? undefined,
      // Cloudflare's own header first; `x-forwarded-for` is the portable fallback
      // and may carry a proxy chain, whose first entry is the client.
      ip:
        request.headers.get('cf-connecting-ip') ??
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        undefined,
      at: now(),
    };

    const result = await notify(event, context, { email: binding?.(locals) });

    if (onResult) onResult(result);
    else
      for (const r of result.results) {
        if (!r.sent) console.warn(`[vitops] notification not sent (${r.channel}): ${r.reason}`);
      }

    return isCall ? new Response(null, { status: 204 }) : Response.json({ success: true });
  };
}
