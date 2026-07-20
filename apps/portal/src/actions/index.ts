// Astro server actions — the ingestion write path. Each validates input and
// INSERTs a `pending` row into the outbox THROUGH `withOrgScope` (RLS-checked:
// the WITH CHECK policy guarantees the row is stamped with the caller's org).
// The dispatch worker forwards it to the vendor. Idempotency key is derived from
// the payload so a resubmit is a no-op (onConflictDoNothing) — never double-files.
import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { requests } from '../lib/db/schema/index.ts';

function idempotencyKey(type: string, payload: unknown): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString('base64').replace(/=+$/, '');
  return `${type}:${b64.slice(0, 48)}`;
}

async function enqueue(
  locals: App.Locals,
  type: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true }> {
  if (!locals.user || !locals.activeOrgId || !locals.scoped) {
    throw new ActionError({ code: 'UNAUTHORIZED', message: 'Sign in and select an organization.' });
  }
  const orgId = locals.activeOrgId;
  await locals.scoped((tx) =>
    tx
      .insert(requests)
      .values({
        organizationId: orgId,
        type,
        payload,
        idempotencyKey: idempotencyKey(type, payload),
        submittedBy: locals.user!.email,
      })
      .onConflictDoNothing(),
  );
  return { ok: true };
}

export const server = {
  submitTicket: defineAction({
    accept: 'form',
    input: z.object({
      subject: z.string().min(3, 'Subject is too short'),
      description: z.string().optional(),
      priority: z.enum(['Low', 'Medium', 'High']).default('Medium'),
    }),
    handler: (input, ctx) =>
      enqueue(ctx.locals, 'ticket', {
        subject: input.subject,
        description: input.description ?? '',
        priority: input.priority,
      }),
  }),

  submitProvisioning: defineAction({
    accept: 'form',
    input: z.object({
      op: z.enum(['jml', 'pto']),
      subject: z.string().min(2, 'Who is this for?'),
      detail: z.string().optional(),
    }),
    handler: (input, ctx) =>
      enqueue(ctx.locals, input.op, { subject: input.subject, detail: input.detail ?? '' }),
  }),
};
