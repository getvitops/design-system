/**
 * EmDash schema REST executor. Fetches an instance's schema and applies additions to it; decides
 * nothing (that is `plan.ts`). Every outcome is a structured result, never a throw, so the CLI
 * decides what a failure means.
 *
 * Plain `fetch` against `/_emdash/api/schema`, not `emdash schema add-field`: the CLI command can
 * only carry `type`, `label` and `required`, so replaying through it would silently drop a select's
 * options, a repeater's sub-fields, a widget or a validation rule. The REST body takes the full
 * field definition, which is exactly what the schema export returns. `fetchImpl` is injected so
 * the request shapes are testable without an instance.
 *
 * Auth is a bearer API token (Settings → API Tokens, or `emdash login`). Mutations also carry the
 * `X-EmDash-Request` CSRF marker and an `Origin`, as `emdash/client`'s own transport sends them.
 */
import type { SchemaExport, SchemaOp } from './plan.ts';

export interface ApiTarget {
  /** Site origin, e.g. `https://dev.example.com`. */
  baseUrl: string;
  /** A bearer API token. Read from the environment by the caller, never from config. */
  token: string;
}

export type ApiResult<T> = { ok: true; value: T } | { ok: false; message: string };

export interface OpResult {
  op: SchemaOp;
  ok: boolean;
  message?: string;
}

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

/** A bearer token is only ever sent over https, or to a local dev server. */
export function checkTarget(target: ApiTarget): string | undefined {
  let url: URL;
  try {
    url = new URL(target.baseUrl);
  } catch {
    return `"${target.baseUrl}" is not a URL.`;
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOCAL.has(url.hostname))) {
    return `Refusing to send an API token over ${url.protocol}//${url.hostname}. Use https.`;
  }
  if (!target.token) return `No API token for ${url.origin}.`;
  return undefined;
}

async function call<T>(
  target: ApiTarget,
  fetchImpl: typeof fetch,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const bad = checkTarget(target);
  if (bad) return { ok: false, message: bad };
  const origin = new URL(target.baseUrl).origin;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${target.token}`,
  };
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    headers['X-EmDash-Request'] = '1';
    headers.Origin = origin;
  }
  try {
    const res = await fetchImpl(`${origin}/_emdash/api${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    let json: { data?: T; error?: { code?: string; message?: string } } | undefined;
    try {
      json = (await res.json()) as typeof json;
    } catch {
      json = undefined;
    }
    if (!res.ok) {
      const code = json?.error?.code ? ` ${json.error.code}` : '';
      return {
        ok: false,
        message: `${method} ${path} → HTTP ${res.status}${code}: ${json?.error?.message ?? res.statusText}`,
      };
    }
    return { ok: true, value: json?.data as T };
  } catch (err) {
    return { ok: false, message: `${method} ${path} failed: ${(err as Error).message}` };
  }
}

export const fetchSchema = (
  target: ApiTarget,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiResult<SchemaExport>> => call<SchemaExport>(target, fetchImpl, 'GET', '/schema');

/** Block type slugs, or a failure the caller may treat as non-fatal (older instances). */
export async function fetchBlockTypeSlugs(
  target: ApiTarget,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiResult<string[]>> {
  const res = await call<{ items?: Array<{ slug: string }> }>(
    target,
    fetchImpl,
    'GET',
    '/schema/block-types',
  );
  return res.ok ? { ok: true, value: (res.value?.items ?? []).map((i) => i.slug) } : res;
}

/**
 * Apply additions in order, stopping at the first failure. EmDash's own guidance for scripted
 * schema changes is the same: the commands are not idempotent, so stop on the first error and
 * re-diff rather than push on.
 */
export async function applyOps(
  target: ApiTarget,
  ops: SchemaOp[],
  fetchImpl: typeof fetch = fetch,
): Promise<OpResult[]> {
  const results: OpResult[] = [];
  for (const op of ops) {
    const res =
      op.kind === 'create-collection'
        ? await call(target, fetchImpl, 'POST', '/schema/collections', op.collection)
        : await call(
            target,
            fetchImpl,
            'POST',
            `/schema/collections/${encodeURIComponent(op.collection)}/fields`,
            { ...op.field, sortOrder: op.sortOrder },
          );
    if (res.ok) {
      results.push({ op, ok: true });
    } else {
      results.push({ op, ok: false, message: res.message });
      break;
    }
  }
  return results;
}
