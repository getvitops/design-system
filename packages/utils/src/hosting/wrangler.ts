/**
 * Cloudflare resources — dev D1 + R2, plus the account id. Executes a plan and
 * decides nothing; every observation and mutation is a structured result, never a
 * throw, so the CLI decides what a failure means.
 *
 * Shells out to `wrangler` and reads `gh`'s account-id output — there is no REST
 * alternative that doesn't also need the same credential wrangler already holds
 * from `wrangler login`. Same class of executor as `@getvitops/utils/media`
 * shelling to `ffmpeg`: an external tool, not an npm dependency, with `execImpl`
 * injected so the parsing is testable without a real Cloudflare account.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export interface ExecResult {
  ok: boolean;
  stdout: string;
  message?: string | undefined;
}

export type ExecImpl = (cmd: string, args: string[]) => Promise<ExecResult>;

/** The real executor — `execFile` with an argv array, never a shell string. */
export const realExec: ExecImpl = async (cmd, args) => {
  try {
    const { stdout } = await exec(cmd, args, { maxBuffer: 16 * 1024 * 1024 });
    return { ok: true, stdout };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      stdout: e.stdout ?? '',
      message: e.stderr || e.message || 'command failed',
    };
  }
};

/** `wrangler whoami` — auth check + the 32-hex account id, from one call. */
export async function wranglerWhoami(
  execImpl: ExecImpl = realExec,
): Promise<{ authed: boolean; accountId?: string }> {
  const res = await execImpl('npx', ['wrangler', 'whoami']);
  if (!res.ok) return { authed: false };
  const accountId = /\b([0-9a-f]{32})\b/.exec(res.stdout)?.[1];
  return { authed: true, ...(accountId ? { accountId } : {}) };
}

/**
 * Find an existing dev D1 database's id by name.
 *
 * `d1 create`'s own stdout carries the id, but its format has drifted across
 * wrangler versions before — a re-list is the one thing guaranteed to still hold
 * the answer, so both the "does it exist" check and the post-create fallback go
 * through this.
 */
export async function findD1(
  name: string,
  execImpl: ExecImpl = realExec,
): Promise<string | undefined> {
  const res = await execImpl('npx', ['wrangler', 'd1', 'list', '--json']);
  if (!res.ok) return undefined;
  try {
    const list = JSON.parse(res.stdout) as { name: string; uuid: string }[];
    return list.find((d) => d.name === name)?.uuid;
  } catch {
    return undefined;
  }
}

/** Create a dev D1 database, then resolve its id via `findD1` (see its docblock). */
export async function createD1(
  name: string,
  execImpl: ExecImpl = realExec,
): Promise<{ ok: boolean; id?: string | undefined; message?: string | undefined }> {
  const res = await execImpl('npx', ['wrangler', 'd1', 'create', name]);
  if (!res.ok) return { ok: false, message: res.message };
  const inline = /"database_id":\s*"([0-9a-f-]{36})"/.exec(res.stdout)?.[1];
  const id = inline ?? (await findD1(name, execImpl));
  if (!id) return { ok: false, message: 'created, but could not determine the database id' };
  return { ok: true, id };
}

export async function findR2Bucket(name: string, execImpl: ExecImpl = realExec): Promise<boolean> {
  const res = await execImpl('npx', ['wrangler', 'r2', 'bucket', 'list']);
  if (!res.ok) return false;
  return new RegExp(`name:\\s+${name}\\s*$`, 'm').test(res.stdout);
}

export async function createR2Bucket(
  name: string,
  execImpl: ExecImpl = realExec,
): Promise<{ ok: boolean; message?: string | undefined }> {
  const res = await execImpl('npx', ['wrangler', 'r2', 'bucket', 'create', name]);
  return res.ok ? { ok: true } : { ok: false, message: res.message };
}
