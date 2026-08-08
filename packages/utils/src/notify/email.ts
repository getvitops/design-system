/**
 * The e-mail channel — Cloudflare Email Sending.
 *
 * I/O only: it executes an `EmailPlan` and decides nothing. Whether to send, to
 * whom, and from where were all settled in `plan.ts`.
 *
 * **The binding is passed in, never imported.** `@getvitops/utils` does not depend
 * on `cloudflare:workers`, so this module runs in Node and in a test with a stub,
 * and the Astro package gains no Cloudflare coupling. The consumer's route hands
 * over `env.EMAIL`.
 *
 * Uses the current Email Sending binding — a structured `send({ to, from,
 * subject, html, text })` — not the legacy `EmailMessage` + hand-built MIME path.
 * The domain in `from` must have been onboarded (`wrangler email sending enable
 * <domain>`); nothing here can check that, which is why `E_SENDER_NOT_VERIFIED`
 * is surfaced verbatim rather than collapsed into "send failed".
 */
import type { RenderedMessage } from './types.ts';
import type { ChannelResult, EmailBinding, EmailPlan } from './types.ts';

/**
 * Provider errors worth retrying.
 *
 * Everything else is a configuration fault — an unverified sender, a malformed
 * payload, a suppressed recipient — where a retry is pure latency and the send
 * will fail identically. Retrying those also burns the daily quota.
 */
const RETRYABLE = new Set([
  'E_RATE_LIMIT_EXCEEDED',
  'E_DELIVERY_FAILED',
  'E_INTERNAL_SERVER_ERROR',
]);

function codeOf(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface SendEmailOptions {
  /** Attempts for a retryable failure (default 3). */
  attempts?: number;
  /**
   * Per-attempt ceiling in milliseconds (default 10000; `0` disables).
   *
   * `binding.send()` is a network call with no deadline of its own, so without
   * this one hung attempt hangs the request that produced it — forever, in the
   * one module otherwise built on always saying why. A conversion endpoint
   * cannot be the thing that makes a form submission time out, so the bound
   * belongs here rather than in every consumer's wrapper.
   *
   * A timeout is treated as retryable: it is a transient condition by
   * definition, unlike `E_SENDER_NOT_VERIFIED` and friends.
   */
  timeoutMs?: number;
  /** Injected for tests; real callers let it default to a real delay. */
  sleep?: (ms: number) => Promise<void>;
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Marker for a send that exceeded its deadline, so the retry rule can see it. */
const TIMEOUT_CODE = 'E_SEND_TIMEOUT';

/**
 * Race a send against its deadline.
 *
 * The timer is always cleared — a pending `setTimeout` keeps a Worker's event
 * loop alive past the response, which turns a bounded send into an unbounded
 * invocation and bills for the difference.
 */
async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  if (ms <= 0) return work;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error(`Email send exceeded ${ms}ms.`) as Error & { code: string };
          err.code = TIMEOUT_CODE;
          reject(err);
        }, ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Send one rendered message according to a plan.
 *
 * Never throws: a failed notification must not take down the request that
 * produced it. The visitor has already submitted their form, and failing their
 * response because our mail didn't go out would turn a lost notification into a
 * lost conversion. The failure is returned instead, for the caller to log.
 */
export async function sendEmail(
  plan: EmailPlan,
  message: RenderedMessage,
  binding: EmailBinding,
  options: SendEmailOptions = {},
): Promise<ChannelResult> {
  if (!plan.enabled || !plan.to || !plan.from) {
    return { channel: 'email', sent: false, reason: plan.skip ?? 'Channel not enabled.' };
  }

  const attempts = Math.max(1, options.attempts ?? 3);
  const sleep = options.sleep ?? wait;
  const timeoutMs = options.timeoutMs ?? 10_000;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await withTimeout(
        binding.send({
          to: plan.to,
          from: plan.fromName ? { email: plan.from, name: plan.fromName } : { email: plan.from },
          subject: message.subject,
          text: message.text,
          html: message.html,
          ...(plan.replyTo ? { replyTo: plan.replyTo } : {}),
        }),
        timeoutMs,
      );
      return { channel: 'email', sent: true };
    } catch (error) {
      const code = codeOf(error);
      if (attempt === attempts || !code || !(RETRYABLE.has(code) || code === TIMEOUT_CODE)) {
        return {
          channel: 'email',
          sent: false,
          reason: messageOf(error),
          ...(code ? { code } : {}),
        };
      }
      // Exponential backoff. Cloudflare's rate limit is per-account, so a burst
      // of conversions retrying in lockstep would keep colliding.
      await sleep(2 ** (attempt - 1) * 250);
    }
  }

  /* c8 ignore next -- the loop always returns; this satisfies the type checker. */
  return { channel: 'email', sent: false, reason: 'Exhausted attempts.' };
}

/**
 * Print the message instead of sending it.
 *
 * The dev path, for a machine with no binding. Explicit rather than a silent
 * no-op, because "I never saw the notification" is the symptom of both a broken
 * integration and a working one nobody could observe.
 */
export function logEmail(
  plan: EmailPlan,
  message: RenderedMessage,
  log: (line: string) => void = console.log,
): ChannelResult {
  log(
    [
      '\n========== NOTIFICATION EMAIL (not sent — no binding) ==========',
      `To: ${plan.to ?? '(unresolved)'}`,
      `From: ${plan.from ?? '(unresolved)'}`,
      `Subject: ${message.subject}`,
      '---',
      message.text,
      '================================================================\n',
    ].join('\n'),
  );
  return { channel: 'email', sent: false, reason: 'No binding — logged to the console.' };
}
