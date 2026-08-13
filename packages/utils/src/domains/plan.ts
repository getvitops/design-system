/**
 * Every decision `vitops domains setup` makes, as one pure function.
 *
 * Pure in the load-bearing sense: no `fetch`, no `fs`, no clock, no stdin. The executor
 * observes each zone's live state and applies what it is told; this module decides, from
 * that state, what is left to do. The same split `onboarding/plan.ts` and `ads/plan.ts`
 * make, for the same two payoffs: `--dry` is a *complete* account of a run, and `--check`
 * is an honest drift report.
 *
 * Idempotency lives here — a step whose desired state already holds resolves to `skip`,
 * so a re-run of a configured domain is all skips by construction rather than by the
 * executor checking twice.
 *
 * Three things here are load-bearing and easy to undo by accident:
 *
 * - **The nameserver gate comes first.** A zone can sit in a Cloudflare account with
 *   `status: "pending"` — visible in the dashboard, serving nothing, because the
 *   registrar still delegates elsewhere. Every step below would then be written
 *   successfully and take effect nowhere. `reachable` is therefore a step in its own
 *   right, and a zone that isn't `active` blocks the rest rather than reporting success.
 * - **HSTS is not quickly undoable.** A browser holds the policy for `max-age` no matter
 *   what the zone says afterwards, so it is ordered after Always Use HTTPS and the CLI
 *   defers it when that step fails. `preload` additionally demands a year and
 *   `includeSubDomains` — the preload list's own requirements — so asking for it without
 *   them is `blocked`, naming both fields, rather than sent and silently rejected.
 * - **A redirect needs DNS to exist before it means anything.** A Page Rule fires only on
 *   a request that reaches Cloudflare, which needs a *proxied* record on the alias host.
 *   Without one the rule is inert and the run still looks clean, which is the failure
 *   this planner exists to make visible.
 */
import type {
  AliasSetup,
  DomainsSetup,
  HstsSetup,
  PageRuleState,
  RedirectStatus,
  ResolvedHsts,
  ZoneState,
} from './types.ts';

/** A step's decision. `blocked` means something outside this command's reach is missing. */
export type StepAction = 'create' | 'update' | 'skip' | 'blocked';

export interface StepPlan {
  action: StepAction;
  /** Why it's a skip, or what the mutation will do, or what is missing. */
  detail: string;
  /** Set only on `blocked`: the config fields or facts that would unblock it. */
  needs?: string[] | undefined;
}

/** Defaults, applied here rather than in the schema so an absent block is the safe posture. */
export const HSTS_DEFAULT_MAX_AGE = 15552000; // 6 months — Cloudflare's own starting advice.
/** The preload list's floor. Below this, submitting is rejected. */
export const HSTS_PRELOAD_MIN_MAX_AGE = 31536000; // 1 year.

/**
 * The placeholder record for a host that exists only to redirect.
 *
 * `100::` is the IPv6 discard prefix — it routes nowhere, which is the point: the record
 * exists so the hostname resolves to Cloudflare's proxy, and the Page Rule answers before
 * anything is ever forwarded to an origin.
 */
export const REDIRECT_PLACEHOLDER = { type: 'AAAA', content: '100::', proxied: true } as const;

/** Strip a leading `www.`, or add one — the two spellings of the same site. */
export function counterpartHost(host: string): string | null {
  if (host.startsWith('www.')) return host.slice(4);
  // Only an apex gets a `www.` counterpart. `blog.acme.ca` does not imply
  // `www.blog.acme.ca`, and inventing one would redirect a host nobody named.
  return host.split('.').length === 2 ? `www.${host}` : null;
}

/** The canonical origin's host. Throws nothing — an unparseable origin is the caller's error. */
export function canonicalHost(canonical: string): string {
  try {
    return new URL(canonical).hostname;
  } catch {
    return canonical.replace(/^https?:\/\//, '').split('/')[0] ?? canonical;
  }
}

/**
 * Every alias this run should redirect, explicit and implicit, in a stable order.
 *
 * The implicit one is the *counterpart* of the canonical host rather than "www" — so a
 * canonical of `https://www.acme.ca` makes the **apex** redirect, which is the same rule
 * read from the other end. An explicit `aliases` entry for that host always wins; it is
 * merged rather than duplicated, so stating a non-default `redirectType` still works.
 */
export function resolveAliases(setup: DomainsSetup): AliasSetup[] {
  const host = canonicalHost(setup.canonical);
  const declared = (setup.aliases ?? []).filter(
    // An alias scoped to another environment is not this run's business. It is dropped
    // here and named in `notes`, so it reads as deliberate rather than forgotten.
    (a) => a.environment == null || a.environment === setup.environment,
  );
  const out = declared.map((a) => ({ ...a, implicit: false }));

  const counterpart = counterpartHost(host);
  if (counterpart && !out.some((a) => a.domain === counterpart))
    out.push({ domain: counterpart, implicit: true });

  return out.filter((a) => a.domain !== host).sort((a, b) => a.domain.localeCompare(b.domain));
}

/** The Page Rule target for an alias — scheme-less, so it matches http *and* https. */
export const ruleTarget = (host: string): string => `${host}/*`;

/**
 * Where an alias forwards to. `$1` carries the captured path through, and Cloudflare
 * appends the query string to a forwarding URL, so a deep link survives the redirect.
 */
export const ruleForward = (target: string): string => `https://${target}/$1`;

/** Resolve one alias's desired rule, applying the defaults the schema leaves open. */
export function desiredRule(
  alias: AliasSetup,
  host: string,
): { target: string; forwardTo: string; status: RedirectStatus } {
  return {
    target: ruleTarget(alias.domain),
    forwardTo: ruleForward(alias.redirectTo ?? host),
    status: alias.redirectType ?? 301,
  };
}

/** Effective HSTS, defaults applied. */
export function resolveHsts(hsts: HstsSetup | undefined): ResolvedHsts {
  return {
    enabled: hsts?.enabled ?? true,
    maxAge: hsts?.maxAge ?? HSTS_DEFAULT_MAX_AGE,
    includeSubDomains: hsts?.includeSubDomains ?? false,
    preload: hsts?.preload ?? false,
  };
}

// ── Steps ─────────────────────────────────────────────────────────────────────────

/**
 * The gate. Everything else on a zone is conditional on this, because a zone Cloudflare
 * is not authoritative for accepts every write and serves none of them.
 */
export function planReachable(zone: string, state: ZoneState | undefined): StepPlan {
  // No observation at all — a `--dry` run with no credential never looked. Saying the
  // zone is missing would be asserting a fact we didn't check, and it sends the reader
  // to the dashboard to fix something that may already be right. An observed-but-absent
  // zone is the case below, and it *has* earned that message.
  if (state === undefined)
    return {
      action: 'blocked',
      detail: `not checked — no credential to read ${zone} with; planning as if nothing is configured`,
      needs: ['CLOUDFLARE_API_TOKEN'],
    };
  if (!state.zoneId)
    return {
      action: 'blocked',
      detail: `no Cloudflare zone named "${zone}" in this account — add the zone, then point the registrar at its nameservers`,
      needs: ['cloudflare zone'],
    };
  if (state.status !== 'active')
    return {
      action: 'blocked',
      // The nameservers are the actionable half: without them the operator has to go
      // find them in the dashboard, which is the step this message exists to remove.
      detail: `zone "${zone}" is ${state.status ?? 'not active'} — Cloudflare is not yet the nameserver${
        state.nameServers?.length
          ? `; set these at the registrar: ${state.nameServers.join(', ')}`
          : ''
      }`,
      needs: ['registrar nameservers'],
    };
  return { action: 'skip', detail: `zone active — Cloudflare is authoritative for ${zone}` };
}

/** Always Use HTTPS — what upgrades `http://<canonical>`, which no Page Rule covers. */
export function planHttps(setup: DomainsSetup, state: ZoneState | undefined): StepPlan {
  if (setup.httpsEnabled === false)
    return { action: 'skip', detail: 'disabled (domains.https.enabled = false)' };
  if (state?.alwaysUseHttps === true)
    return { action: 'skip', detail: 'Always Use HTTPS already on' };
  return { action: 'update', detail: 'turn on Always Use HTTPS' };
}

/**
 * HSTS, with the two guards that make it safe to automate.
 *
 * `includeSubDomains` is checked against the *config's own* environment origins: a dev
 * environment on `http://dev.acme.ca` becomes unreachable the moment the flag is set, and
 * this is the one place the toolchain can see that coming. It cannot see subdomains the
 * config never mentions, which is why the flag also carries a reminder.
 */
export function planHsts(setup: DomainsSetup, state: ZoneState | undefined): StepPlan {
  const want = resolveHsts(setup.hsts);
  if (!want.enabled)
    return { action: 'skip', detail: 'disabled (domains.https.hsts.enabled = false)' };

  if (want.preload) {
    const missing: string[] = [];
    if (want.maxAge < HSTS_PRELOAD_MIN_MAX_AGE) missing.push('hsts.maxAge');
    if (!want.includeSubDomains) missing.push('hsts.includeSubDomains');
    if (missing.length)
      return {
        action: 'blocked',
        detail: `preload needs maxAge >= ${HSTS_PRELOAD_MIN_MAX_AGE} (1 year) and includeSubDomains — submitting without both is rejected by the preload list`,
        needs: missing,
      };
  }

  if (want.includeSubDomains) {
    const apex = canonicalHost(setup.canonical).replace(/^www\./, '');
    const plaintext = (setup.environmentOrigins ?? []).filter((o) => {
      if (!o.startsWith('http://')) return false;
      const h = canonicalHost(o);
      return h === apex || h.endsWith(`.${apex}`);
    });
    if (plaintext.length)
      return {
        action: 'blocked',
        detail: `includeSubDomains would make these configured environments unreachable: ${plaintext.join(', ')} — move them to https first, or turn the flag off`,
        needs: ['hsts.includeSubDomains'],
      };
  }

  const have = state?.hsts;
  const same =
    have != null &&
    have.enabled === true &&
    have.maxAge === want.maxAge &&
    (have.includeSubDomains ?? false) === want.includeSubDomains &&
    (have.preload ?? false) === want.preload;
  if (same) return { action: 'skip', detail: `HSTS already set (max-age ${want.maxAge})` };

  const flags = [
    want.includeSubDomains ? 'includeSubDomains' : null,
    want.preload ? 'preload' : null,
  ].filter(Boolean);
  return {
    action: have?.enabled ? 'update' : 'create',
    detail: `set HSTS max-age ${want.maxAge}${flags.length ? ` + ${flags.join(' + ')}` : ''}`,
  };
}

/** One alias's redirect and the DNS record that makes it reachable. */
export interface AliasPlan {
  domain: string;
  /** The zone the Page Rule lives on — an alias in another zone is set up there. */
  zone: string;
  target: string;
  forwardTo: string;
  status: RedirectStatus;
  /** Derived from the canonical host rather than read from `aliases`. */
  implicit: boolean;
  /** The Page Rule. */
  rule: StepPlan;
  /** The proxied record without which the rule never fires. */
  dns: StepPlan;
  /** The id of an existing rule to update, when `rule.action` is `update`. */
  ruleId?: string | undefined;
}

/**
 * Identity is the **target pattern**, not a description — Page Rules have no description
 * field. A rule targeting exactly `<alias>/*` is ours to update; anything else on the
 * zone is another rule doing another job and is never touched. This is why the command
 * has no delete verb at all: it never needs one.
 */
export function findOurRule(
  rules: PageRuleState[] | undefined,
  target: string,
): PageRuleState | undefined {
  return (rules ?? []).find((r) => r.target === target);
}

export function planAlias(
  alias: AliasSetup,
  host: string,
  zone: string,
  state: ZoneState | undefined,
): AliasPlan {
  const want = desiredRule(alias, host);
  const base = {
    domain: alias.domain,
    zone,
    target: want.target,
    forwardTo: want.forwardTo,
    status: want.status,
    implicit: alias.implicit ?? false,
  };

  const reachable = planReachable(zone, state);
  if (reachable.action === 'blocked')
    return { ...base, rule: { ...reachable }, dns: { ...reachable } };

  // DNS first in the reading order, because it is the precondition. A host with records
  // that are not proxied is left alone deliberately: it may be a live site being retired,
  // and editing someone's A record is not what this command promises.
  const types = state?.aliasRecordTypes ?? [];
  let dns: StepPlan;
  if (types.length === 0)
    dns = {
      action: 'create',
      detail: `create proxied ${REDIRECT_PLACEHOLDER.type} ${REDIRECT_PLACEHOLDER.content} so requests reach Cloudflare`,
    };
  else if (state?.aliasProxied === false)
    dns = {
      action: 'blocked',
      detail: `${alias.domain} has ${types.join('/')} records that are not proxied — the redirect cannot fire until they are (this command never edits a record it did not create)`,
      needs: ['cloudflare proxy on the existing record'],
    };
  else dns = { action: 'skip', detail: 'proxied record already present' };

  const existing = findOurRule(state?.pageRules, want.target);
  let rule: StepPlan;
  let ruleId: string | undefined;
  if (!existing) {
    const quota = state?.pageRuleQuota;
    const used = (state?.pageRules ?? []).length;
    rule =
      quota != null && used >= quota
        ? {
            action: 'blocked',
            // A POST over quota fails with an opaque error; saying which plan limit was
            // hit is the difference between a fix and a support ticket.
            detail: `zone is at its Page Rule limit (${used}/${quota}) — free the quota or upgrade the plan`,
            needs: ['page rule quota'],
          }
        : {
            action: 'create',
            detail: `forward ${want.target} -> ${want.forwardTo} (${want.status})`,
          };
  } else if (
    existing.forwardTo === want.forwardTo &&
    existing.status === want.status &&
    existing.enabled !== false
  ) {
    rule = { action: 'skip', detail: `already forwards to ${want.forwardTo} (${want.status})` };
  } else {
    ruleId = existing.id;
    const why =
      existing.enabled === false
        ? 'rule is disabled'
        : existing.forwardTo !== want.forwardTo
          ? `forwards to ${existing.forwardTo ?? '(not a forwarding rule)'}`
          : `status is ${existing.status ?? '?'}`;
    rule = { action: 'update', detail: `${why} — set ${want.forwardTo} (${want.status})` };
  }

  return { ...base, rule, dns, ...(ruleId ? { ruleId } : {}) };
}

// ── The whole run ─────────────────────────────────────────────────────────────────

export interface DomainsPlan {
  canonical: string;
  /** The canonical host's zone — where the two settings are applied. */
  zone: string;
  reachable: StepPlan;
  https: StepPlan;
  hsts: StepPlan;
  aliases: AliasPlan[];
  /** Operator-facing warnings that span the whole run. */
  notes: string[];
  /** Manual follow-ups — things with no API behind them. */
  reminders: string[];
}

/**
 * The zone a host belongs to, derived without a public-suffix list: the observation map
 * is keyed by host, and the CLI records which zone each host resolved to. When it hasn't
 * (a `--dry` run with no credentials), fall back to the registrable-looking suffix, which
 * is right for the overwhelmingly common two-label case and is only ever used for display.
 */
export function zoneOf(host: string, state: ZoneState | undefined): string {
  if (state?.zoneId) return host.startsWith('www.') ? host.slice(4) : host;
  const parts = host.split('.');
  return parts.length > 2 ? parts.slice(-2).join('.') : host;
}

export function plan(setup: DomainsSetup, states: Map<string, ZoneState>): DomainsPlan {
  const host = canonicalHost(setup.canonical);
  const zone = zoneOf(host, states.get(host));
  const canonicalState = states.get(host);
  const notes: string[] = [];
  const reminders: string[] = [];

  const reachable = planReachable(zone, canonicalState);
  const blocked = reachable.action === 'blocked';

  const dropped = (setup.aliases ?? []).filter(
    (a) => a.environment != null && a.environment !== setup.environment,
  );
  for (const a of dropped)
    notes.push(`${a.domain}: scoped to environment "${a.environment}", not this run`);

  const aliases = resolveAliases(setup).map((a) => {
    const aState = states.get(a.domain);
    const aZone = zoneOf(a.domain, aState);
    return planAlias(a, host, aZone, aState);
  });

  const crossZone = aliases.filter((a) => a.zone !== zone).map((a) => a.zone);
  for (const z of new Set(crossZone))
    notes.push(`${z} is a separate zone — its own nameservers and Page Rule quota apply`);

  if (resolveHsts(setup.hsts).includeSubDomains)
    reminders.push(
      'includeSubDomains reaches every subdomain, including ones this config never names — confirm they all serve https',
    );

  return {
    canonical: setup.canonical,
    zone,
    reachable,
    // A zone Cloudflare isn't serving gets no settings steps: writing them would
    // succeed and change nothing, which is the one outcome worse than failing.
    https: blocked ? { ...reachable } : planHttps(setup, canonicalState),
    hsts: blocked ? { ...reachable } : planHsts(setup, canonicalState),
    aliases,
    notes,
    reminders,
  };
}

/** Any step that isn't a skip — i.e. the live state or the config has drifted. */
export function hasDrift(p: DomainsPlan): boolean {
  if (p.reachable.action !== 'skip' || p.https.action !== 'skip' || p.hsts.action !== 'skip')
    return true;
  return p.aliases.some((a) => a.rule.action !== 'skip' || a.dns.action !== 'skip');
}

/** Every unmet requirement in a run, flattened — what the CLI prints when it can't ask. */
export function missingRequirements(p: DomainsPlan): string[] {
  const steps = [p.reachable, p.https, p.hsts, ...p.aliases.flatMap((a) => [a.rule, a.dns])];
  return [...new Set(steps.flatMap((s) => (s.action === 'blocked' ? (s.needs ?? []) : [])))];
}

const glyph = (s: StepPlan) => (s.action === 'skip' ? '·' : s.action === 'blocked' ? '?' : '+');

/** Render a plan as the block `--dry` and `--check` print. */
export function formatPlan(p: DomainsPlan): string {
  const lines = [`${p.zone}  (canonical ${p.canonical})`];
  lines.push(`  ${glyph(p.reachable)} zone     ${p.reachable.detail}`);
  lines.push(`  ${glyph(p.https)} https    ${p.https.detail}`);
  lines.push(`  ${glyph(p.hsts)} hsts     ${p.hsts.detail}`);
  for (const a of p.aliases) {
    lines.push(
      `${a.domain}${a.implicit ? '  (implicit)' : ''}${a.zone !== p.zone ? `  [zone ${a.zone}]` : ''}`,
    );
    lines.push(`  ${glyph(a.dns)} dns      ${a.dns.detail}`);
    lines.push(`  ${glyph(a.rule)} redirect ${a.rule.detail}`);
  }
  for (const n of p.notes) lines.push(`! ${n}`);
  for (const r of p.reminders) lines.push(`! ${r}`);
  return lines.join('\n');
}

/** The outcome of one alias's run, for the summary table. */
export interface AliasResult {
  domain: string;
  dns: 'created' | 'present' | 'blocked' | 'failed' | '—';
  redirect: 'created' | 'updated' | 'present' | 'blocked' | 'failed' | '—';
}

/** The outcome of the zone-level steps. `deferred` is HSTS held back on a failed https step. */
export interface DomainsResult {
  zone: string;
  https: 'on' | 'set' | 'blocked' | 'failed' | '—';
  hsts: 'set' | 'present' | 'blocked' | 'deferred' | 'failed' | '—';
  aliases: AliasResult[];
  reminders: string[];
}

const pad = (s: string, n: number) => s.padEnd(n);

/** Render the end-of-run summary: the zone settings, one row per alias, plus reminders. */
export function formatSummary(r: DomainsResult): string {
  const headers = ['DOMAIN', 'DNS', 'REDIRECT'];
  const rows = r.aliases.map((a) => [a.domain, a.dns, a.redirect]);
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => row[i]?.length ?? 0)),
  );
  const line = (cells: string[]) =>
    cells
      .map((c, i) => pad(c, widths[i] ?? 0))
      .join('  ')
      .trimEnd();

  const out = [`${r.zone}:  https ${r.https}   hsts ${r.hsts}`];
  if (rows.length) {
    out.push('', line(headers), widths.map((w) => '─'.repeat(w)).join('  '));
    for (const row of rows) out.push(line(row));
  }
  if (r.reminders.length)
    out.push('', 'Reminders (manual — no API):', ...r.reminders.map((m) => `  ! ${m}`));
  return out.join('\n');
}
