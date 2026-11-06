/**
 * GitHub's Contents API — `commitFile()` creates or updates a single file with
 * one commit, called from the EmDash design-system-editor plugin route (see
 * AGENTS.md's "EmDash plugin as the design-system editing surface" section)
 * to auto-sync a client's admin edit back into the git-tracked `site.json`.
 *
 * `fetch`-only, no `gh` CLI — a deployed Cloudflare Worker has neither a
 * filesystem nor `child_process`, so this can't shell out the way
 * `packages/utils/src/hosting/github.ts` does for a local `vitops setup repo`
 * run. Same "injected `fetchImpl`, structured result, never throws" shape as
 * `onboarding/cloudflare.ts` and `security/turnstile.ts` — a Worker route
 * calling this has already decided a commit failure must degrade (the
 * immediate override still applies), never fail the request.
 *
 * The token is a fine-grained PAT scoped to one repository with `Contents:
 * Read and write` only — an env var (`VITOPS_GITHUB_TOKEN`), never config,
 * the same rule every other credential in this toolchain follows. Branch
 * protection on `main` (provisioned by `vitops setup repo`) is the real
 * backstop against this token being used for anything beyond the integration
 * branch it's meant to commit to, regardless of what it nominally permits.
 */

const API = 'https://api.github.com';

export interface CommitFileOptions {
  /** Repository owner (user or org). */
  owner: string;
  repo: string;
  /** Branch to commit to — never `main`/production directly, see module docblock. */
  branch: string;
  /** File path within the repo, e.g. `"site.json"`. */
  path: string;
  /** The full new file content (already merged — this call replaces it whole). */
  content: string;
  /** Commit message. */
  message: string;
  /** Fine-grained PAT, `Contents: Read and write` on this repo only. */
  token: string;
  /**
   * Narrower than `typeof fetch` on purpose — every call site here only ever
   * passes a string URL, never a `Request`/`URL` object, which is also
   * exactly the shape EmDash's own `ctx.http.fetch` (a capability-gated
   * external-fetch helper) exposes. Typing this as the wider `typeof fetch`
   * would make passing `ctx.http.fetch` a type error for no real benefit.
   */
  fetchImpl?: ((url: string, init?: RequestInit) => Promise<Response>) | undefined;
}

export interface CommitFileResult {
  ok: boolean;
  status?: number;
  /** The new commit's SHA, present iff `ok`. */
  commitSha?: string;
  message?: string;
}

/** UTF-8-safe base64 — `btoa` alone only handles Latin1. Portable to both Node and a Worker. */
function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function describeError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    return body.message ? `${res.status} ${body.message}` : `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

/**
 * Create or update `path` on `branch` with `content`, in one commit.
 *
 * Reads the file's current `sha` first (required by the Contents API's
 * update call, omitted for a brand-new file) — a plain GET, not a second
 * round-trip a caller has to orchestrate. Never throws: a network failure, a
 * non-2xx response and a malformed body all come back as `{ ok: false,
 * message }`, matching every other executor in this toolchain.
 */
export async function commitFile(opts: CommitFileOptions): Promise<CommitFileResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const headers = {
    authorization: `Bearer ${opts.token}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': '@getvitops/utils-git',
  };
  const url = `${API}/repos/${opts.owner}/${opts.repo}/contents/${opts.path}`;

  let sha: string | undefined;
  try {
    const getRes = await fetchImpl(`${url}?ref=${encodeURIComponent(opts.branch)}`, { headers });
    if (getRes.ok) {
      sha = ((await getRes.json()) as { sha?: string }).sha;
    } else if (getRes.status !== 404) {
      return { ok: false, status: getRes.status, message: await describeError(getRes) };
    }
  } catch (e) {
    return { ok: false, message: `network-error: ${(e as Error).message}` };
  }

  try {
    const putRes = await fetchImpl(url, {
      method: 'PUT',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        message: opts.message,
        content: toBase64(opts.content),
        branch: opts.branch,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!putRes.ok)
      return { ok: false, status: putRes.status, message: await describeError(putRes) };
    const body = (await putRes.json()) as { commit?: { sha?: string } };
    return {
      ok: true,
      status: putRes.status,
      ...(body.commit?.sha ? { commitSha: body.commit.sha } : {}),
    };
  } catch (e) {
    return { ok: false, message: `network-error: ${(e as Error).message}` };
  }
}
