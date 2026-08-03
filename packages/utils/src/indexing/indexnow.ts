/**
 * IndexNow submission.
 *
 * Honoured by Bing, Yandex, Naver, Seznam and Yep — and, through Bing's index, by
 * the AI crawlers built on it. **Not** by Google, which has never adopted the
 * protocol despite testing it; nothing here should be described to a consumer as
 * affecting Google results.
 *
 * Participating engines share submissions with each other, so one endpoint is
 * normally the whole integration.
 */
import { randomBytes } from 'node:crypto';
import type { IndexNowPlan } from './plan.ts';

/** Generate a key. 32 hex characters, the conventional shape. */
export function newKey(): string {
  return randomBytes(16).toString('hex');
}

/** The body of the key file served at `keyLocation`: the key, and nothing else. */
export const keyFileContents = (key: string): string => `${key}\n`;

export interface SubmitResult {
  ok: boolean;
  status: number;
  urls: number;
  /** The endpoint's own explanation, when it gave one. */
  message?: string;
}

/**
 * How the endpoint's status codes actually read.
 *
 * `403` and `422` are the two that matter and they are easy to misdiagnose: both
 * mean the key file is wrong, not that the URLs are.
 */
function explain(status: number): string | undefined {
  switch (status) {
    case 200:
    case 202:
      return undefined;
    case 400:
      return 'bad request — malformed URL list';
    case 403:
      return 'key file not found or its contents do not match the key';
    case 422:
      return 'a submitted URL does not belong to the key file host, or the key does not match';
    case 429:
      return 'rate limited — too many submissions';
    default:
      return `unexpected status ${status}`;
  }
}

/**
 * Verify the key file is live and correct before submitting.
 *
 * Worth a request of its own because of how IndexNow fails: a submission with an
 * unreachable key file returns `403`, but one with a *reachable* key file whose
 * contents are stale is accepted with `202` and then silently discarded. Checking
 * first is the only way to tell "submitted" from "submitted and ignored".
 */
export async function verifyKeyFile(
  keyLocation: string,
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; reason?: string }> {
  let res: Response;
  try {
    res = await fetchImpl(keyLocation, { method: 'GET' });
  } catch (e) {
    return { ok: false, reason: `could not fetch ${keyLocation}: ${(e as Error).message}` };
  }
  if (!res.ok) return { ok: false, reason: `${keyLocation} returned ${res.status}` };
  const body = (await res.text()).trim();
  if (body !== key)
    return {
      ok: false,
      reason: `${keyLocation} does not contain the configured key (found ${body.length} chars)`,
    };
  return { ok: true };
}

/**
 * Submit one batch. Callers iterate `plan.batches` — the split is the planner's
 * job, so that what gets sent is decided in the pure layer and visible in `--dry`.
 */
export async function submitBatch(
  plan: IndexNowPlan,
  urls: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<SubmitResult> {
  const body = {
    host: plan.host,
    key: plan.key,
    keyLocation: plan.keyLocation,
    urlList: urls,
  };
  const res = await fetchImpl(plan.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  const message = explain(res.status);
  return { ok: res.ok, status: res.status, urls: urls.length, ...(message ? { message } : {}) };
}
