/**
 * Conversion notifications — plan, render, dispatch.
 *
 * The seam between "a conversion happened" and "someone found out about it".
 * A `ConversionEvent` from `@getvitops/utils/tracking` goes in; where it goes and
 * how it reads are config, not code at the call site.
 *
 * Three files, three jobs, matching `indexing/`:
 *   - `plan.ts`    decides everything, purely — which channels, which recipients,
 *                  and why anything is off.
 *   - `render.ts`  turns the event into prose, purely.
 *   - `email.ts`   executes, and decides nothing.
 *
 * ---
 *
 * **TODO — further channels.** Only `email` is implemented. The seam is
 * `NotificationsConfig` + a sender with `sendEmail`'s signature `(plan, message,
 * transport) => ChannelResult`; adding one should mean a new sender file, a new
 * branch in `planNotifications`, and a schema variant — touching neither
 * `ConversionEvent` nor the recipient cascade. Planned:
 *   - `sms`      — the same event rendered short. `render.ts` already separates
 *                  `describeEvent` from `renderEmail` for exactly this.
 *   - `persist`  — append to a store (D1, a portal log) the client reviews.
 * The generic `email`/`text`/`persist` helpers taking content + provider config
 * belong at that point, not before: one implemented channel is not enough to know
 * what the abstraction should be.
 */
import type { ConversionEvent } from '../tracking/types.ts';
import { logEmail, sendEmail } from './email.ts';
import { planNotifications } from './plan.ts';
import { renderEmail } from './render.ts';
import type { ChannelResult, EmailBinding, NotifyContext } from './types.ts';

export interface NotifyDeps {
  /**
   * The Workers `send_email` binding (`env.EMAIL`). Omit it and the notification
   * is printed instead — the dev path.
   */
  email?: EmailBinding | undefined;
}

export interface NotifyResult {
  results: ChannelResult[];
  /** True when at least one channel delivered. */
  delivered: boolean;
}

/**
 * Notify every configured channel about a conversion.
 *
 * Channels are independent: one failing must not stop the others, and none of
 * them may throw into the request that produced the event. Every outcome —
 * delivered, skipped, failed — comes back as data for the caller to log.
 */
export async function notify(
  event: ConversionEvent,
  ctx: NotifyContext,
  deps: NotifyDeps = {},
): Promise<NotifyResult> {
  const plan = planNotifications(ctx);
  const results: ChannelResult[] = [];

  if (plan.email.enabled) {
    const message = renderEmail(event);
    results.push(
      deps.email ? await sendEmail(plan.email, message, deps.email) : logEmail(plan.email, message),
    );
  } else {
    results.push({ channel: 'email', sent: false, reason: plan.email.skip ?? 'Not configured.' });
  }

  return { results, delivered: results.some((r) => r.sent) };
}

export {
  DEFAULT_EMAIL_BINDING,
  normalizeEmailChannel,
  planNotifications,
  resolveRecipient,
  resolveSender,
} from './plan.ts';
export { describeEvent, renderEmail } from './render.ts';
export { logEmail, sendEmail } from './email.ts';
export type {
  ChannelPlan,
  ChannelResult,
  EmailBinding,
  EmailChannelConfig,
  EmailPlan,
  NotificationPlan,
  NotificationsConfig,
  NotifyContext,
  RenderedMessage,
} from './types.ts';
