// Dev helper: trigger the background sync inline (no CF cron/queue needed) so
// the cache tables populate during local `astro dev`. In production this work is
// done by the Worker's scheduled() handler.
import type { APIRoute } from 'astro';
import { runSync } from '../../../workers/sync.ts';

export const prerender = false;

export const ALL: APIRoute = async ({ locals }) => {
  const units = await runSync(locals.env, { inline: true });
  return Response.json({ ok: true, synced: units.length, units });
};
