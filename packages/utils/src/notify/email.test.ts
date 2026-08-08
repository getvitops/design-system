/**
 * The sender's contract with the runtime it cannot reach from here.
 *
 * The binding is passed in, so a stub is enough to pin the two behaviours that
 * matter operationally: what gets retried, and what happens to the request when a
 * send fails.
 */
import { describe, expect, it, vi } from 'vitest';
import { logEmail, sendEmail } from './email.ts';
import type { EmailBinding, EmailPlan, RenderedMessage } from './types.ts';

const plan: EmailPlan = {
  provider: 'cloudflare',
  binding: 'EMAIL',
  enabled: true,
  to: 'owner@acme.ca',
  from: 'noreply@acme.ca',
  fromName: 'Acme',
};

const message: RenderedMessage = { subject: 'S', text: 'T', html: '<p>H</p>' };
const noSleep = async () => {};

function failing(code: string, times = Infinity): EmailBinding & { calls: number } {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    async send() {
      calls++;
      if (calls > times) return;
      throw Object.assign(new Error(`boom ${code}`), { code });
    },
  } as EmailBinding & { calls: number };
}

describe('sendEmail', () => {
  it('sends structured fields, not a MIME blob', () => {
    const send = vi.fn(async () => {});
    return sendEmail(plan, message, { send }, { sleep: noSleep }).then((result) => {
      expect(result.sent).toBe(true);
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'owner@acme.ca',
          from: { email: 'noreply@acme.ca', name: 'Acme' },
          subject: 'S',
          text: 'T',
          html: '<p>H</p>',
        }),
      );
    });
  });

  it('omits replyTo when unset rather than sending undefined', async () => {
    let seen: Record<string, unknown> | undefined;
    const send = async (m: Record<string, unknown>) => void (seen = m);
    await sendEmail(plan, message, { send } as unknown as EmailBinding, { sleep: noSleep });
    expect(seen).not.toHaveProperty('replyTo');
  });

  it('retries a rate limit', async () => {
    const binding = failing('E_RATE_LIMIT_EXCEEDED', 2);
    const result = await sendEmail(plan, message, binding, { sleep: noSleep });
    expect(result.sent).toBe(true);
    expect(binding.calls).toBe(3);
  });

  it('does NOT retry an unverified sender', async () => {
    // A configuration fault fails identically every time; retrying is pure
    // latency and burns the daily quota.
    const binding = failing('E_SENDER_NOT_VERIFIED');
    const result = await sendEmail(plan, message, binding, { sleep: noSleep });
    expect(result.sent).toBe(false);
    expect(binding.calls).toBe(1);
  });

  it('surfaces the provider code verbatim', async () => {
    // Nothing here can check domain onboarding, so the caller needs the code
    // rather than "send failed".
    const result = await sendEmail(plan, message, failing('E_SENDER_NOT_VERIFIED'), {
      sleep: noSleep,
    });
    expect(result.code).toBe('E_SENDER_NOT_VERIFIED');
  });

  it('gives up after the attempt budget', async () => {
    const binding = failing('E_INTERNAL_SERVER_ERROR');
    const result = await sendEmail(plan, message, binding, { sleep: noSleep, attempts: 2 });
    expect(result.sent).toBe(false);
    expect(binding.calls).toBe(2);
  });

  it('never throws — a lost notification must not become a lost conversion', async () => {
    const binding: EmailBinding = {
      async send() {
        throw new Error('network down');
      },
    };
    await expect(sendEmail(plan, message, binding, { sleep: noSleep })).resolves.toMatchObject({
      sent: false,
    });
  });

  it('refuses a plan that was never enabled, keeping its reason', async () => {
    const off: EmailPlan = { ...plan, enabled: false, skip: 'No recipient.' };
    const send = vi.fn(async () => {});
    const result = await sendEmail(off, message, { send });
    expect(send).not.toHaveBeenCalled();
    expect(result.reason).toBe('No recipient.');
  });
});

describe('logEmail', () => {
  it('prints the message and reports it as unsent', () => {
    // Explicit rather than a silent no-op: "I never saw it" is the symptom of
    // both a broken integration and a working one nobody could observe.
    const lines: string[] = [];
    const result = logEmail(plan, message, (l) => lines.push(l));
    expect(result.sent).toBe(false);
    expect(lines.join('\n')).toContain('owner@acme.ca');
    expect(lines.join('\n')).toContain('T');
  });
});

/**
 * `binding.send()` is a network call with no deadline of its own, so before this
 * a hung send hung the request that produced it — forever, in the one module
 * otherwise built on always saying why. A consumer had to wrap the binding to
 * bound it; that bound belongs here.
 */
describe('sendEmail timeout', () => {
  const hanging: EmailBinding = { send: () => new Promise<void>(() => {}) };

  it('gives up on a send that never settles, and says so', async () => {
    const r = await sendEmail(plan, message, hanging, {
      timeoutMs: 5,
      attempts: 1,
      sleep: noSleep,
    });
    expect(r.sent).toBe(false);
    expect(r.reason).toContain('5ms');
  });

  it('retries a timeout — it is transient by definition', async () => {
    let calls = 0;
    const slowThenFast: EmailBinding = {
      send: async () => {
        calls++;
        if (calls === 1) return new Promise<void>(() => {});
        return undefined;
      },
    };
    const r = await sendEmail(plan, message, slowThenFast, {
      timeoutMs: 5,
      attempts: 2,
      sleep: noSleep,
    });
    expect(r.sent).toBe(true);
    expect(calls).toBe(2);
  });

  it('does not delay a send that answers in time', async () => {
    const r = await sendEmail(plan, message, { send: async () => {} }, { timeoutMs: 50 });
    expect(r.sent).toBe(true);
  });

  it('can be disabled with 0', async () => {
    const r = await sendEmail(plan, message, { send: async () => {} }, { timeoutMs: 0 });
    expect(r.sent).toBe(true);
  });
});
