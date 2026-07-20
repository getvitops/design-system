// Standalone background worker (run as its own process: `vp run portal:worker`
// or a second container). node-cron drives the two loops that replace Cloudflare
// Cron/Queues: periodic vendor sync (reads) + outbox dispatch (writes).
import cron from 'node-cron';
import { getEnv } from '../lib/env.ts';
import { dispatchPending } from './dispatch.ts';
import { runSync } from './sync.ts';

const env = getEnv();

console.log('[worker] node-cron up — dispatch every 30s, sync hourly');

// Outbox dispatch — frequent (6-field cron incl. seconds).
cron.schedule('*/30 * * * * *', async () => {
  try {
    const r = await dispatchPending(env);
    if (r.processed) console.log('[dispatch]', r);
  } catch (err) {
    console.error('[dispatch] loop error:', err);
  }
});

// Vendor sync — hourly (Clarity adapter self-throttles).
cron.schedule('0 * * * *', async () => {
  try {
    const units = await runSync(env, { inline: true });
    console.log(`[sync] ${units.length} units`);
  } catch (err) {
    console.error('[sync] loop error:', err);
  }
});

// Kick a dispatch pass immediately on startup.
dispatchPending(env)
  .then((r) => r.processed && console.log('[dispatch] startup', r))
  .catch((err) => console.error('[dispatch] startup error:', err));
