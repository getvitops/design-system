// One-time hosting-platform setup for the target configured in
// astro.config.mjs (vitopsHosting from @getvitops/emdash).
//
//   pnpm run init:hosting                 # cloudflare (the default target)
//   pnpm run init:hosting -- --dry-run
//   pnpm run init:hosting -- --target node
//
// cloudflare: creates the isolated DEV resources (D1 database + R2 bucket —
// prod ones are auto-provisioned by wrangler on the first deploy) and, when a
// GitHub repo is wired up (see init-github.mjs), sets the repo secrets the
// deploy workflows need. The Cloudflare API token cannot be created via CLI,
// so that one secret stays manual.
//
// Idempotent: safe to re-run — existing resources and secrets are just
// updated/skipped. Requires wrangler auth (`npx wrangler login`).

import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const targetFlag = args[args.indexOf('--target') + 1];
const target = (args.includes('--target') && targetFlag) || process.env.HOSTING || 'cloudflare';

const name = JSON.parse(readFileSync('package.json', 'utf8')).name.replace(/^@[^/]+\//, '');

function quiet(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function run(cmd, { capture = false } = {}) {
  if (dryRun) {
    console.log(`[dry-run] ${cmd}`);
    return '';
  }
  console.log(`$ ${cmd}`);
  try {
    if (capture) {
      const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
      process.stdout.write(out);
      return out;
    }
    execSync(cmd, { stdio: 'inherit' });
    return '';
  } catch {
    console.error(
      `\nERROR: \`${cmd}\` failed (see output above). Fix and re-run — the script is idempotent.`,
    );
    process.exit(1);
  }
}

if (target === 'node') {
  console.log(`Hosting target 'node' has no cloud resources to provision. To switch this
project to a Node host (VPS / docker-compose / k8s):

  1. pnpm add @astrojs/node better-sqlite3
  2. In astro.config.mjs: vitopsHosting({ target: 'node' })  (or set HOSTING=node)
  3. Build and run:  pnpm build && node ./dist/server/entry.mjs
     Data lives in ./data/ (SQLite db + uploads) — persist it as a volume.
  4. CI deploy for VPS/docker/k8s is not scaffolded yet — the deploy-*.yml
     workflows are Cloudflare-specific; replace or disable them.

For production on Node, move storage to S3-compatible and/or the database to
Postgres via vitopsHosting({ node: { database, storage } }) — see the
@getvitops/emdash README.`);
  process.exit(0);
}

if (target !== 'cloudflare') {
  console.error(`ERROR: unknown hosting target '${target}'. Valid targets: cloudflare, node.`);
  process.exit(1);
}

// --- Preflight: wrangler auth ------------------------------------------------
const whoami = spawnSync('npx', ['wrangler', 'whoami'], { encoding: 'utf8' });
if (whoami.status !== 0) {
  console.error('ERROR: wrangler is not logged in. Run `npx wrangler login` first.');
  process.exit(1);
}
// "Account Name | <32-hex account id>" table row in `wrangler whoami` output.
const accountId = (whoami.stdout.match(/\b([0-9a-f]{32})\b/) ?? [])[1] ?? null;

// --- Dev D1 database ---------------------------------------------------------
const devDb = `${name}-dev`;
let devDbId = null;
const d1List = quiet('npx wrangler d1 list --json');
if (d1List) {
  devDbId = JSON.parse(d1List).find((d) => d.name === devDb)?.uuid ?? null;
}
if (devDbId) {
  console.log(`D1 database ${devDb} already exists (${devDbId}).`);
} else {
  const out = run(`npx wrangler d1 create ${devDb}`, { capture: true });
  devDbId = (out.match(/"database_id":\s*"([0-9a-f-]{36})"/) ?? [])[1] ?? null;
  if (!dryRun && !devDbId) {
    // Output format drifts across wrangler versions — the list is authoritative.
    const relist = quiet('npx wrangler d1 list --json');
    devDbId = relist ? (JSON.parse(relist).find((d) => d.name === devDb)?.uuid ?? null) : null;
  }
  if (!dryRun && !devDbId) {
    console.error('ERROR: could not determine the database_id of the created dev database.');
    process.exit(1);
  }
}

// --- Dev R2 bucket -----------------------------------------------------------
const devBucket = `${name}-media-dev`;
const bucketList = quiet('npx wrangler r2 bucket list');
if (bucketList && new RegExp(`name:\\s+${devBucket}\\s*$`, 'm').test(bucketList)) {
  console.log(`R2 bucket ${devBucket} already exists.`);
} else {
  run(`npx wrangler r2 bucket create ${devBucket}`);
}

// --- GitHub repo secrets (when the repo is wired up) -------------------------
const hasGh = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' }).status === 0;
const hasOrigin = quiet('git remote get-url origin') !== null;
if (hasGh && hasOrigin) {
  if (devDbId) run(`gh secret set DEV_D1_ID --body ${devDbId}`);
  if (accountId) run(`gh secret set CLOUDFLARE_ACCOUNT_ID --body ${accountId}`);
} else {
  console.log(
    '\nSkipping GitHub secrets (no gh auth or no origin remote — run init:github first).',
  );
}

console.log(`
Cloudflare dev environment ready:
  D1:  ${devDb}${devDbId ? ` (${devDbId})` : ''}
  R2:  ${devBucket}
${
  hasGh && hasOrigin
    ? ''
    : `  Set repo secrets once GitHub is wired up:
    gh secret set DEV_D1_ID --body ${devDbId ?? '<id>'}
    gh secret set CLOUDFLARE_ACCOUNT_ID --body ${accountId ?? '<account id>'}
`
}
Still manual (CLI can't create API tokens):
  1. Create a token with Workers + D1 + R2 edit permissions:
     https://dash.cloudflare.com/profile/api-tokens
  2. gh secret set CLOUDFLARE_API_TOKEN

Prod D1/R2 are provisioned automatically by wrangler on the first \`pnpm deploy\`.
Local \`pnpm deploy:dev\` runs need:  export DEV_D1_ID=${devDbId ?? '<id>'}`);
