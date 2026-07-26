// One-time GitHub bootstrap: creates a GitHub repo named after this project
// (package.json name), pushes `main` + `dev`, and makes `dev` the default
// branch — the shape the deploy workflows expect (deploy-dev on push to dev,
// deploy-prod on push to main, promote.yml between them).
//
//   pnpm run init:github             # private repo (default)
//   pnpm run init:github -- --public
//   pnpm run init:github -- --dry-run
//
// Idempotent: safe to re-run — existing git repo, commits, dev branch, and
// origin remote are all left alone. Requires the GitHub CLI (`gh`), logged in
// (`gh auth login`).

import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const visibility = args.has('--public') ? '--public' : '--private';

const repoName = JSON.parse(readFileSync('package.json', 'utf8')).name.replace(/^@[^/]+\//, '');

function check(cmd) {
  return spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8' });
}

function quiet(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function run(cmd) {
  if (dryRun) {
    console.log(`[dry-run] ${cmd}`);
    return;
  }
  console.log(`$ ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch {
    console.error(
      `\nERROR: \`${cmd}\` failed (see output above). Fix and re-run — the script is idempotent.`,
    );
    process.exit(1);
  }
}

// --- Preflight: gh installed and authenticated -------------------------------
if (check(['gh', '--version']).status !== 0) {
  console.error('ERROR: the GitHub CLI (`gh`) is required. Install it from https://cli.github.com');
  process.exit(1);
}
if (check(['gh', 'auth', 'status']).status !== 0) {
  console.error('ERROR: `gh` is not logged in. Run `gh auth login` first.');
  process.exit(1);
}

// --- Local git: repo, initial commit, main + dev branches --------------------
if (quiet('git rev-parse --is-inside-work-tree') === null) {
  run('git init -b main');
}
if (quiet('git rev-parse HEAD') === null) {
  run('git add -A');
  run('git commit -m "Initial commit (scaffolded from @getvitops/create emdash template)"');
}

// The workflows key off `main`; normalize whatever the initial branch is.
const branch = quiet('git branch --show-current');
if (branch && branch !== 'main' && branch !== 'dev') {
  run(`git branch -m ${branch} main`);
}
if (quiet('git show-ref --verify refs/heads/dev') === null) {
  run('git branch dev main');
}

// --- GitHub: create repo (same name), push, default to dev -------------------
if (quiet('git remote get-url origin') === null) {
  run(`gh repo create ${repoName} ${visibility} --source=. --remote=origin`);
} else {
  console.log('origin remote already set — skipping `gh repo create`.');
}
run('git push -u origin main dev');
run('gh repo edit --default-branch dev');
run('git checkout dev');

// --- What's left (manual, needs your Cloudflare account) ---------------------
console.log(`
Repo ready: main (production) + dev (integration, default branch).
NOTE: the first workflow runs will fail until the secrets below exist.

Next steps:
  1. Dev resources:  wrangler d1 create ${repoName}-dev   (note the printed id)
                     wrangler r2 bucket create ${repoName}-media-dev
  2. Secrets:        gh secret set CLOUDFLARE_API_TOKEN
                     gh secret set CLOUDFLARE_ACCOUNT_ID
                     gh secret set DEV_D1_ID
  3. Protect main:   Settings → Branches → protect 'main' (require the
                     promotion PR + review), so prod only ships via promote.yml.
`);
