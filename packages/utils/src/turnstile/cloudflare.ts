/**
 * Cloudflare's Turnstile widget API — the one thing `vitops setup turnstile` writes.
 *
 * Verified against developers.cloudflare.com (2026-11): list is
 * `GET /accounts/{id}/challenges/widgets` (paged, `per_page` 5 to 1000), create is
 * `POST` to the same path with `name`, `domains` (max 10) and `mode` required, and only
 * the create response carries `secret`. The token needs the **Account > Turnstile > Edit**
 * permission (API reference names: `Turnstile Sites Write`, or `Account Settings Write`).
 *
 * As in `onboarding/cloudflare.ts` there is deliberately no update, rotate or delete verb:
 * the destructive operations are absent rather than guarded. `fetchImpl` is injected and
 * every call returns a structured result rather than throwing.
 */
import type { WidgetSummary } from './types.ts';

const API = 'https://api.cloudflare.com/client/v4';

interface CfEnvelope<T> {
  success: boolean;
  errors?: { code: number; message: string }[];
  result?: T;
  result_info?: { page: number; per_page: number; total_count: number };
}

const cfError = (status: number, body: CfEnvelope<unknown>): string => {
  const first = body.errors?.[0];
  return first ? `${first.code} ${first.message}` : `HTTP ${status}`;
};

const PERMISSION_HINT = ' (does the token carry Account > Turnstile > Edit?)';

async function json<T>(res: Response): Promise<CfEnvelope<T>> {
  try {
    return (await res.json()) as CfEnvelope<T>;
  } catch {
    return { success: false };
  }
}

/**
 * The account to create the widget in. `CLOUDFLARE_ACCOUNT_ID` wins; otherwise the token's
 * only account. Cloudflare's docs state no permission for `GET /accounts`, so a token scoped
 * to Turnstile alone may be refused here: the message says to set the id instead.
 */
export async function resolveAccountId(
  token: string,
  explicit: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; accountId?: string; message?: string }> {
  if (explicit) return { ok: true, accountId: explicit };
  const res = await fetchImpl(`${API}/accounts?per_page=5`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = await json<{ id: string; name: string }[]>(res);
  if (!res.ok || !body.success)
    return {
      ok: false,
      message: `${cfError(res.status, body)} — set CLOUDFLARE_ACCOUNT_ID to skip the account lookup`,
    };
  const accounts = body.result ?? [];
  if (accounts.length === 1) return { ok: true, accountId: accounts[0]!.id };
  return {
    ok: false,
    message:
      accounts.length === 0
        ? 'the token can see no accounts — set CLOUDFLARE_ACCOUNT_ID'
        : `the token can see ${accounts.length} accounts — set CLOUDFLARE_ACCOUNT_ID to choose one`,
  };
}

/** Every widget in the account, following pagination. */
export async function listWidgets(
  token: string,
  accountId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; widgets: WidgetSummary[]; message?: string }> {
  const widgets: WidgetSummary[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await fetchImpl(
      `${API}/accounts/${encodeURIComponent(accountId)}/challenges/widgets?page=${page}&per_page=100`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    const body = await json<WidgetSummary[]>(res);
    if (!res.ok || !body.success)
      return {
        ok: false,
        widgets: [],
        message: cfError(res.status, body) + (res.status === 403 ? PERMISSION_HINT : ''),
      };
    for (const w of body.result ?? [])
      widgets.push({ sitekey: w.sitekey, name: w.name, domains: w.domains ?? [], mode: w.mode });
    const info = body.result_info;
    if (!info || page * info.per_page >= info.total_count) break;
  }
  return { ok: true, widgets };
}

/**
 * Create a managed widget. **Create only** — the planner decides whether one is needed. The
 * returned `secret` is the only time Cloudflare shows it; the caller must store it as a Worker
 * secret and must not write it to a config file.
 */
export async function createWidget(
  token: string,
  accountId: string,
  widget: { name: string; domains: string[] },
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; sitekey?: string; secret?: string; message?: string }> {
  const res = await fetchImpl(
    `${API}/accounts/${encodeURIComponent(accountId)}/challenges/widgets`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: widget.name, domains: widget.domains, mode: 'managed' }),
    },
  );
  const body = await json<{ sitekey: string; secret: string }>(res);
  if (!res.ok || !body.success || !body.result?.sitekey || !body.result.secret)
    return {
      ok: false,
      message: cfError(res.status, body) + (res.status === 403 ? PERMISSION_HINT : ''),
    };
  return { ok: true, sitekey: body.result.sitekey, secret: body.result.secret };
}
