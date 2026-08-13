/**
 * Cloudflare zone settings + Page Rules — the things `vitops domains setup` writes.
 *
 * This module exists **beside** `onboarding/cloudflare.ts` rather than inside it because
 * that file's header states a contract it must keep: no update verb, no delete verb. What
 * this command does is inherently an update — turning a zone setting on, correcting a
 * redirect that points at the wrong host. Adding those there would quietly retire a
 * promise other commands rely on, so the update verbs live here under their own contract:
 *
 * > This module updates zone settings, and creates or updates **only** the Page Rule whose
 * > target pattern matches an alias the config declares. It has no delete verb. A rule the
 * > operator wrote in the dashboard has a different target and is never read back, never
 * > rewritten, and never removed.
 *
 * Identity is the target pattern because Page Rules carry no description field — there is
 * nowhere to stamp ownership, so ownership has to be inferred from the one thing that is
 * both stable and ours: the host we were told to redirect.
 *
 * As with the onboarding and indexing executors, `fetchImpl` is injected so the request
 * shape is testable without the network, and every call returns a structured result rather
 * than throwing — the caller decides what a failure means per step.
 *
 * Token scopes are wider than the other Cloudflare commands need: `Zone:Read` for the
 * lookup, `Zone Settings:Edit` for the two settings, `Zone:Page Rules:Edit` for the rules,
 * and `Zone:DNS:Edit` only when an alias needs its placeholder record. No dashboard
 * template bundles all four, so the failure messages name the missing scope rather than
 * letting a 403 read as "the zone isn't there".
 */
import type { HstsSetup, PageRuleState, RedirectStatus, ResolvedHsts } from './types.ts';

const API = 'https://api.cloudflare.com/client/v4';

interface CfEnvelope<T> {
  success: boolean;
  errors?: { code: number; message: string }[];
  result?: T;
}

const cfError = (status: number, body: CfEnvelope<unknown>): string => {
  const first = body.errors?.[0];
  return first ? `${first.code} ${first.message}` : `HTTP ${status}`;
};

const auth = (token: string) => ({ authorization: `Bearer ${token}` });
const authJson = (token: string) => ({ ...auth(token), 'content-type': 'application/json' });

/** What `GET /zones?name=` tells us beyond the id — chiefly whether Cloudflare is live for it. */
export interface ZoneLookup {
  ok: boolean;
  status: number;
  zoneId?: string;
  /** Cloudflare's zone status: `active` means the registrar has delegated here. */
  zoneStatus?: string;
  nameServers?: string[];
  /** Page Rules the zone's plan allows. */
  pageRuleQuota?: number;
  message?: string;
}

/**
 * Look up a zone, keeping the fields that decide whether anything else is worth doing.
 *
 * `onboarding/cloudflare.ts`'s `findZoneId` returns only the id, which is all it needs;
 * this command has to distinguish "no zone" from "a zone Cloudflare is not authoritative
 * for", and the second reads as success everywhere else.
 */
export async function lookupZone(
  token: string,
  domain: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ZoneLookup> {
  const res = await fetchImpl(`${API}/zones?name=${encodeURIComponent(domain)}`, {
    headers: auth(token),
  });
  const body = (await res.json()) as CfEnvelope<
    {
      id: string;
      name: string;
      status?: string;
      name_servers?: string[];
      plan?: { legacy_id?: string };
      meta?: { page_rule_quota?: number };
    }[]
  >;
  if (!res.ok || !body.success)
    return { ok: false, status: res.status, message: cfError(res.status, body) };
  const zone = body.result?.[0];
  // Not an error: "no such zone" is a legitimate observation the planner turns into a
  // blocked step naming what to do about it, rather than a failed run.
  if (!zone) return { ok: true, status: res.status };
  return {
    ok: true,
    status: res.status,
    zoneId: zone.id,
    ...(zone.status ? { zoneStatus: zone.status } : {}),
    ...(zone.name_servers ? { nameServers: zone.name_servers } : {}),
    ...(zone.meta?.page_rule_quota != null ? { pageRuleQuota: zone.meta.page_rule_quota } : {}),
  };
}

/** Read one zone setting's raw value. */
export async function getZoneSetting(
  token: string,
  zoneId: string,
  setting: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; value?: unknown; message?: string }> {
  const res = await fetchImpl(`${API}/zones/${zoneId}/settings/${setting}`, {
    headers: auth(token),
  });
  const body = (await res.json()) as CfEnvelope<{ id: string; value: unknown }>;
  if (!res.ok || !body.success)
    return { ok: false, status: res.status, message: cfError(res.status, body) };
  return { ok: true, status: res.status, value: body.result?.value };
}

/** Write one zone setting. Needs `Zone Settings:Edit`. */
export async function setZoneSetting(
  token: string,
  zoneId: string,
  setting: string,
  value: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; message?: string }> {
  const res = await fetchImpl(`${API}/zones/${zoneId}/settings/${setting}`, {
    method: 'PATCH',
    headers: authJson(token),
    body: JSON.stringify({ value }),
  });
  const body = (await res.json()) as CfEnvelope<unknown>;
  if (!res.ok || !body.success)
    return {
      ok: false,
      status: res.status,
      message: `${cfError(res.status, body)}${res.status === 403 ? ' (does the token carry Zone Settings:Edit?)' : ''}`,
    };
  return { ok: true, status: res.status };
}

/** `always_use_https` as a boolean — the API spells it `"on"` / `"off"`. */
export const readAlwaysUseHttps = (value: unknown): boolean => value === 'on';

/** Read the HSTS block out of a `security_header` setting value. */
export function readHsts(value: unknown): HstsSetup | undefined {
  const sts = (value as { strict_transport_security?: Record<string, unknown> } | undefined)
    ?.strict_transport_security;
  if (!sts) return undefined;
  return {
    enabled: sts['enabled'] === true,
    ...(typeof sts['max_age'] === 'number' ? { maxAge: sts['max_age'] } : {}),
    includeSubDomains: sts['include_subdomains'] === true,
    preload: sts['preload'] === true,
  };
}

/**
 * The `security_header` value for a desired HSTS state.
 *
 * `nosniff` rides in the same setting but is a different header entirely
 * (`X-Content-Type-Options`), so it is passed through from what the zone already has
 * rather than defaulted — sending `false` here would silently turn off a header nobody
 * asked us to touch.
 */
export function hstsValue(want: ResolvedHsts, currentNosniff = false): unknown {
  return {
    strict_transport_security: {
      enabled: want.enabled,
      max_age: want.maxAge,
      include_subdomains: want.includeSubDomains,
      preload: want.preload,
      nosniff: currentNosniff,
    },
  };
}

/** Whether the zone currently sends `X-Content-Type-Options: nosniff`, for the passthrough above. */
export const readNosniff = (value: unknown): boolean =>
  (value as { strict_transport_security?: { nosniff?: boolean } } | undefined)
    ?.strict_transport_security?.nosniff === true;

// ── Page Rules ────────────────────────────────────────────────────────────────────

interface RawPageRule {
  id: string;
  status?: string;
  targets?: { target: string; constraint?: { operator: string; value: string } }[];
  actions?: { id: string; value?: unknown }[];
}

/** Narrow a raw Page Rule to the fields the planner compares. */
export function readPageRule(raw: RawPageRule): PageRuleState {
  const target = raw.targets?.[0]?.constraint?.value ?? '';
  const forwarding = raw.actions?.find((a) => a.id === 'forwarding_url')?.value as
    | { url?: string; status_code?: number }
    | undefined;
  return {
    id: raw.id,
    target,
    ...(forwarding?.url ? { forwardTo: forwarding.url } : {}),
    ...(forwarding?.status_code ? { status: forwarding.status_code as RedirectStatus } : {}),
    enabled: raw.status !== 'disabled',
  };
}

/** Every Page Rule on a zone — foreign ones included, so the planner can count the quota. */
export async function listPageRules(
  token: string,
  zoneId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; rules: PageRuleState[]; message?: string }> {
  const res = await fetchImpl(`${API}/zones/${zoneId}/pagerules`, { headers: auth(token) });
  const body = (await res.json()) as CfEnvelope<RawPageRule[]>;
  if (!res.ok || !body.success)
    return { ok: false, status: res.status, rules: [], message: cfError(res.status, body) };
  return { ok: true, status: res.status, rules: (body.result ?? []).map(readPageRule) };
}

/** The request body for a forwarding Page Rule. Shared by create and update so they can't drift. */
export function forwardingRuleBody(
  target: string,
  forwardTo: string,
  status: RedirectStatus,
): unknown {
  return {
    targets: [{ target: 'url', constraint: { operator: 'matches', value: target } }],
    actions: [{ id: 'forwarding_url', value: { url: forwardTo, status_code: status } }],
    status: 'active',
  };
}

/** Create a forwarding Page Rule. Needs `Zone:Page Rules:Edit`. */
export async function createPageRule(
  token: string,
  zoneId: string,
  target: string,
  forwardTo: string,
  status: RedirectStatus,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; message?: string }> {
  const res = await fetchImpl(`${API}/zones/${zoneId}/pagerules`, {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify(forwardingRuleBody(target, forwardTo, status)),
  });
  const body = (await res.json()) as CfEnvelope<{ id: string }>;
  if (!res.ok || !body.success)
    return {
      ok: false,
      status: res.status,
      message: `${cfError(res.status, body)}${res.status === 403 ? ' (does the token carry Zone:Page Rules:Edit?)' : ''}`,
    };
  return { ok: true, status: res.status };
}

/**
 * Update an existing forwarding Page Rule **by id**.
 *
 * Only ever called with an id the planner resolved from a matching target pattern, which
 * is what keeps this from reaching a rule the operator wrote. There is no delete sibling.
 */
export async function updatePageRule(
  token: string,
  zoneId: string,
  ruleId: string,
  target: string,
  forwardTo: string,
  status: RedirectStatus,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; message?: string }> {
  const res = await fetchImpl(`${API}/zones/${zoneId}/pagerules/${ruleId}`, {
    method: 'PUT',
    headers: authJson(token),
    body: JSON.stringify(forwardingRuleBody(target, forwardTo, status)),
  });
  const body = (await res.json()) as CfEnvelope<{ id: string }>;
  if (!res.ok || !body.success)
    return { ok: false, status: res.status, message: cfError(res.status, body) };
  return { ok: true, status: res.status };
}
