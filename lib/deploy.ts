#!/usr/bin/env node
/**
 * Deploy dist/ to a theme folder — remote (rsync over SSH) or local (symlink).
 *
 * Run with Node's native env loading:
 *   node --env-file=.env deploy.mjs
 * (wired into `npm run deploy`).
 *
 * Local mode (e.g. WPLocal): set DEPLOY_LOCAL_PATH to the target dir and the
 * script symlinks it to this repo's dist/. One-time setup; later builds need
 * no deploy step.
 *   DEPLOY_LOCAL_PATH  absolute path, e.g.
 *                      ~/Local Sites/<site>/app/public/wp-content/themes/bricks-child/dist
 *
 * Remote mode env (set in .env):
 *   DEPLOY_HOST   SSH host IONOS provides
 *   DEPLOY_USER   SSH/SFTP username
 *   DEPLOY_PATH   remote target dir, relative to login root
 *                 e.g. wordpress/wp-content/themes/bricks-child/dist
 * Optional:
 *   DEPLOY_PORT   default 22
 *   DEPLOY_KEY    path to private key (else ssh-agent/default key)
 *
 * Pass --dry to preview without making changes.
 */
import { spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const { DEPLOY_HOST, DEPLOY_USER, DEPLOY_PATH, DEPLOY_PORT, DEPLOY_KEY, DEPLOY_LOCAL_PATH } =
  process.env;
const DRY_RUN = process.argv.includes('--dry') || process.env.DRY_RUN;

if (DEPLOY_LOCAL_PATH) {
  const target = resolve('dist');
  const link = resolve(DEPLOY_LOCAL_PATH.replace(/^~/, process.env.HOME ?? '~'));

  let existing: ReturnType<typeof lstatSync> | null = null;
  try {
    existing = lstatSync(link);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }

  if (existing?.isSymbolicLink()) {
    const current = resolve(dirname(link), readlinkSync(link));
    if (current === target) {
      console.log(`✓ ${link} → ${target} (already linked)`);
      process.exit(0);
    }
    console.log(`${DRY_RUN ? '[dry run] ' : ''}replacing stale symlink at ${link}`);
    if (!DRY_RUN) rmSync(link);
  } else if (existing) {
    // Refuse to clobber a real file/dir — that's almost certainly an existing
    // theme dir with files we don't have in this repo.
    console.error(`Refusing to replace non-symlink at ${link}`);
    console.error(`Remove it manually if you really want to symlink over it.`);
    process.exit(1);
  }

  console.log(`${DRY_RUN ? '[dry run] ' : ''}→ symlink ${link} → ${target}`);
  if (!DRY_RUN) {
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(target, link);
  }
  process.exit(0);
}

const missing = ['DEPLOY_HOST', 'DEPLOY_USER', 'DEPLOY_PATH'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env: ${missing.join(', ')}`);
  console.error('Set them in .env and run: node --env-file=.env deploy.mjs');
  process.exit(1);
}

const port = DEPLOY_PORT || '22';
const sshParts = ['ssh', '-p', port, '-o', 'StrictHostKeyChecking=accept-new'];
if (DEPLOY_KEY) sshParts.push('-i', DEPLOY_KEY);

const rsyncArgs = [
  '-avz',
  '--delete',
  ...(DRY_RUN ? ['-n'] : []),
  '-e',
  sshParts.join(' '),
  'dist/',
  `${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/`,
];

console.log(
  `${DRY_RUN ? '[dry run] ' : ''}→ rsync dist/ to ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}`,
);

const res = spawnSync('rsync', rsyncArgs, { stdio: 'inherit' });

if (res.error) {
  console.error('Failed to run rsync:', res.error.message);
  process.exit(1);
}
process.exit(res.status ?? 0);
