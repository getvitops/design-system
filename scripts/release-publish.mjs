/**
 * `changeset publish`, with the npm lookups it hardcodes made to work in this repo.
 *
 * Why this exists: `changeset publish` publishes through pnpm, but it first shells out to plain
 * `npm` for read-only lookups (`npm info <pkg>` to see what is already on the registry, `npm
 * profile get` to check auth) and runs them from the repo root. The root `package.json` pins
 * `devEngines.packageManager` to pnpm with `onFail: download`, and npm treats that as an error
 * (`EBADDEVENGINES`) rather than ignoring a manager it does not recognise, so the release dies
 * before it publishes anything. Changesets exposes no option to use another tool for those calls.
 *
 * What it does: puts a tiny `npm` shim first on PATH for the duration of the publish. For the
 * lookup verbs (`info`, `view`, `profile`, `whoami`) the shim adds `--prefix <empty dir>`, which
 * makes npm read an empty project instead of this one (an env var does not work: only the flag
 * moves the project root). Every other verb passes straight through to the real npm, so the
 * publish itself is untouched. Auth and registry still come from `~/.npmrc` as before.
 *
 * It does not change what is published, and it is not a way around the pnpm pin: nothing here
 * installs or builds with npm.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

const found = spawnSync('which', ['npm'], { encoding: 'utf8' });
const realNpm = found.stdout.trim();
if (found.status !== 0 || !realNpm) {
  console.error('release-publish: no `npm` on PATH — changesets needs it for registry lookups.');
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), 'vitops-release-'));
const emptyProject = join(work, 'project');
const bin = join(work, 'bin');
spawnSync('mkdir', ['-p', emptyProject, bin]);

const shim = join(bin, 'npm');
writeFileSync(
  shim,
  `#!/bin/sh
case "$1" in
  info|view|profile|whoami) exec "${realNpm}" --prefix "${emptyProject}" "$@" ;;
  *) exec "${realNpm}" "$@" ;;
esac
`,
);
chmodSync(shim, 0o755);

const result = spawnSync(
  join(process.cwd(), 'node_modules', '.bin', 'changeset'),
  ['publish', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}` },
  },
);
spawnSync('rm', ['-rf', work]);
process.exit(result.status ?? 1);
