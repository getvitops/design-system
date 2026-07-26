// Post-build step for the DEV deploy target.
//
// Why this exists: the @astrojs/cloudflare adapter regenerates
// dist/server/wrangler.json at build time and drops any top-level `env` block,
// so wrangler's native `--env dev` cannot be used. Instead we take the
// adapter's generated (prod) config — which already carries the injected
// ASSETS / SESSION / Durable Object / triggers bindings — and rewrite only the
// identity + data targets so the dev worker is fully isolated:
//
//   name    <name>        → <name>-dev
//   routes  <domain>      → dev.<domain>   (only if a custom domain is set)
//   D1      binding DB    → <name>-dev     (id from $DEV_D1_ID)
//   R2      binding MEDIA → <bucket>-dev
//
// Run after `astro build`, then deploy the emitted flat config explicitly:
//   node scripts/build-dev-wrangler.mjs
//   wrangler deploy --config dist/server/wrangler.dev.json
//
// SAFETY: refuses to run without $DEV_D1_ID. Falling back to the prod D1 id
// would bind the dev worker to the PRODUCTION database — the exact thing this
// split exists to prevent. One-time setup:
//   wrangler d1 create <name>-dev   → export DEV_D1_ID=<the id it prints>
//   wrangler r2 bucket create <bucket>-dev

import { readFileSync, writeFileSync } from 'node:fs';

const GENERATED = 'dist/server/wrangler.json';
const OUT = 'dist/server/wrangler.dev.json';

const DEV_D1_ID = process.env.DEV_D1_ID;
if (!DEV_D1_ID) {
  console.error(
    'ERROR: DEV_D1_ID is not set.\n' +
      'Create the isolated dev database and export its id first:\n' +
      '  wrangler d1 create <your-worker-name>-dev\n' +
      '  export DEV_D1_ID=<the id it prints>\n' +
      'Refusing to continue — without it the dev worker could bind the prod DB.',
  );
  process.exit(1);
}

let cfg;
try {
  cfg = JSON.parse(readFileSync(GENERATED, 'utf8'));
} catch (err) {
  console.error(`ERROR: could not read ${GENERATED}. Run \`astro build\` first.\n${err}`);
  process.exit(1);
}

const devName = `${cfg.name}-dev`;
cfg.name = devName;

// Custom domain → dev.<domain>. Without one, the dev worker just serves from
// its workers.dev subdomain (<name>-dev.<account>.workers.dev).
if (Array.isArray(cfg.routes)) {
  cfg.routes = cfg.routes.map((route) =>
    route?.pattern ? { ...route, pattern: `dev.${route.pattern}` } : route,
  );
}

cfg.d1_databases = (cfg.d1_databases ?? []).map((d) =>
  d.binding === 'DB' ? { ...d, database_name: devName, database_id: DEV_D1_ID } : d,
);

cfg.r2_buckets = (cfg.r2_buckets ?? []).map((r) =>
  r.binding === 'MEDIA' ? { ...r, bucket_name: `${r.bucket_name}-dev` } : r,
);

// Flat config — no nested environments.
delete cfg.env;

writeFileSync(OUT, `${JSON.stringify(cfg, null, 2)}\n`);
console.log(
  `Wrote ${OUT}\n  name: ${cfg.name}\n  routes: ${JSON.stringify(cfg.routes ?? [])}\n  D1: ${devName} (${DEV_D1_ID})`,
);
