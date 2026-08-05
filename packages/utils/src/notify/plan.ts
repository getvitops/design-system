/**
 * Every decision a notification makes, as one pure function.
 *
 * Pure in the load-bearing sense: no `fetch`, no binding, no clock. Whether a
 * channel fires, who it reaches, and *why* it was skipped are all decided here and
 * asserted in `plan.test.ts`; the senders beside this file do what they are told
 * and decide nothing. That is the same split `indexing/plan.ts` makes against
 * `gsc.ts`, and `@getvitops/core`'s consent store makes against its DOM wiring,
 * for the same reason: the consequential logic has to be testable without the
 * environment it runs in.
 *
 * The practical payoff is that a misconfigured site can be told exactly what will
 * and won't happen without sending anything — a silently unsent conversion
 * notification is indistinguishable from no conversion.
 */
import type { EmailChannelConfig, EmailPlan, NotificationPlan, NotifyContext } from './types.ts';

/** Default Workers binding name for Cloudflare Email Sending. */
export const DEFAULT_EMAIL_BINDING = 'EMAIL';

/** Normalise the `email` shorthand: a bare address means a Cloudflare send to it. */
export function normalizeEmailChannel(
  input: string | EmailChannelConfig | undefined,
): EmailChannelConfig | undefined {
  if (input === undefined) return undefined;
  return typeof input === 'string' ? { provider: 'cloudflare', to: input } : input;
}

/**
 * Who the notification reaches.
 *
 * An explicit recipient wins; otherwise it falls to the site's own contact
 * addresses, primary first. This cascade is why a site that has already said
 * where it receives mail doesn't have to say it twice.
 */
export function resolveRecipient(
  channel: EmailChannelConfig,
  ctx: NotifyContext,
): string | undefined {
  if (channel.to) return channel.to;
  return ctx.locationEmails?.find((e) => !!e);
}

/**
 * The From address.
 *
 * `noreply@<canonical>` by default, because the sending domain has to be one the
 * site controls — Cloudflare rejects anything else with `E_SENDER_NOT_VERIFIED`,
 * and guessing from the recipient's domain would send that failure every time.
 */
export function resolveSender(channel: EmailChannelConfig, ctx: NotifyContext): string | undefined {
  if (channel.from) return channel.from;
  if (!ctx.canonical) return undefined;
  let host: string;
  try {
    host = new URL(ctx.canonical).hostname;
  } catch {
    // A bare hostname is a legitimate way to write `domains.canonical`.
    host = ctx.canonical.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  }
  return host ? `noreply@${host}` : undefined;
}

/**
 * Decide what will be sent, and say why anything won't be.
 *
 * Every "off" carries a reason rather than being an absence, so a caller can
 * report the misconfiguration instead of reporting success over a no-op.
 */
export function planNotifications(ctx: NotifyContext): NotificationPlan {
  const email = planEmail(ctx);
  return { email, empty: !email.enabled };
}

function planEmail(ctx: NotifyContext): EmailPlan {
  const channel = normalizeEmailChannel(ctx.notifications?.email);
  const binding = channel?.binding ?? DEFAULT_EMAIL_BINDING;

  if (!channel) {
    return {
      provider: 'cloudflare',
      binding,
      enabled: false,
      skip: 'No `notifications.email` configured.',
    };
  }

  const to = resolveRecipient(channel, ctx);
  if (!to) {
    return {
      provider: 'cloudflare',
      binding,
      enabled: false,
      skip:
        'No recipient: set `notifications.email.to`, or give a location an `email` ' +
        'so the notification has somewhere to go.',
    };
  }

  const from = resolveSender(channel, ctx);
  if (!from) {
    return {
      provider: 'cloudflare',
      binding,
      to,
      enabled: false,
      skip:
        'No sender: set `notifications.email.from`, or `domains.canonical` so ' +
        '`noreply@<host>` can be derived. Cloudflare only sends from a domain you have onboarded.',
    };
  }

  return {
    provider: 'cloudflare',
    binding,
    to,
    from,
    fromName: channel.fromName ?? ctx.organizationName,
    replyTo: channel.replyTo,
    enabled: true,
  };
}
