/**
 * Every decision `vitops email setup`/`vitops email check` makes, as one pure
 * function.
 *
 * Pure in the load-bearing sense: no `fetch`, no clock. The executors beside this
 * one (`cloudflare.ts`, `dns.ts`) gather live state and apply what they are told;
 * this module decides, from that state, what is left to do — the same split
 * `ads/plan.ts` and `onboarding/plan.ts` make, for the same two payoffs: `--dry`
 * is a complete account of a run, and `--check`/`email check` is an honest drift
 * report.
 *
 * One rule specific to this planner, discovered against a live account: **the
 * onboarded entity is an exact name**, and it is usually a subdomain
 * (`send.example.com`), never the apex a `from` address's domain names. So the
 * most valuable thing this planner can report is not "onboard this domain" but
 * "a sibling in the same zone already IS onboarded — send from there instead."
 * That is why a domain absent-with-a-sibling-present is `blocked`, not `create`:
 * creating the apex too is the second option, and it carries a DMARC caveat (see
 * `AGENTS.md`'s Conversion tracking section) that a bare `create` step would hide.
 */
import type { EmailConfig, EmailProvider, FromCandidate, ZoneSendingState } from './types.ts';
import { table } from '../plan-format.ts';

export type StepAction = 'create' | 'skip' | 'blocked';

export interface StepPlan {
  action: StepAction;
  /** Why it's a skip, what the mutation will do, or what a human should do instead. */
  detail: string;
}

export interface SendingDomainPlan {
  domain: string;
  /** Where this domain came from — config, derived, or the source scan. */
  sources: FromCandidate['source'][];
  onboard: StepPlan;
  reminders: string[];
}

export interface EmailPlan {
  domains: SendingDomainPlan[];
  notes: string[];
}

/** Decide one domain's step from its zone's observed sending names. */
export function planDomain(
  domain: string,
  provider: EmailProvider,
  state: ZoneSendingState | undefined,
): StepPlan {
  if (provider !== 'cloudflare')
    return { action: 'skip', detail: `no onboarding check implemented for "${provider}"` };

  if (!state)
    return {
      action: 'blocked',
      detail: `no observed Cloudflare state for "${domain}" — is it in this account? (needs CLOUDFLARE_API_TOKEN with Zone:Read + an Email Sending scope)`,
    };

  const exact = state.subdomains.find((s) => s.name === domain);
  if (exact) {
    return exact.enabled
      ? { action: 'skip', detail: `already onboarded and enabled` }
      : {
          action: 'create',
          detail: `onboarded but disabled — \`wrangler email sending enable ${domain}\` (or re-enable in the dashboard)`,
        };
  }

  const sibling = state.subdomains.find((s) => s.enabled);
  if (sibling) {
    return {
      action: 'blocked',
      detail:
        `"${domain}" is not onboarded, but "${sibling.name}" already is in the same zone — ` +
        `send from "@${sibling.name}" instead (isolates transactional mail's DMARC/reputation ` +
        `from the domain's regular mail), or run \`wrangler email sending enable ${domain}\` ` +
        `to onboard the apex too (this rewrites _dmarc.${domain} — check what's there first)`,
    };
  }

  return {
    action: 'create',
    detail: `not onboarded — \`wrangler email sending enable ${domain}\``,
  };
}

/** Plan every candidate domain. One entry per distinct domain, sources merged. */
export function planSendingDomains(
  config: EmailConfig,
  states: Map<string, ZoneSendingState>,
): EmailPlan {
  const byDomain = new Map<string, FromCandidate['source'][]>();
  for (const c of config.candidates) {
    const sources = byDomain.get(c.domain) ?? [];
    if (!sources.includes(c.source)) sources.push(c.source);
    byDomain.set(c.domain, sources);
  }

  const domains: SendingDomainPlan[] = [...byDomain.entries()].map(([domain, sources]) => {
    const onboard = planDomain(domain, config.provider, states.get(domain));
    const reminders =
      onboard.action === 'create' && config.provider === 'cloudflare'
        ? ['DNS takes minutes to propagate before mail sent from it will authenticate.']
        : [];
    return { domain, sources, onboard, reminders };
  });

  return { domains, notes: [] };
}

/** Any step that isn't a skip — i.e. drift, worth reporting. */
export function hasDrift(p: EmailPlan): boolean {
  return p.domains.some((d) => d.onboard.action !== 'skip');
}

/** Every domain still blocked, for a summary that names what's outstanding. */
export function blockedDomains(p: EmailPlan): SendingDomainPlan[] {
  return p.domains.filter((d) => d.onboard.action === 'blocked');
}

/** Render a plan as the block `--dry`/`--check`/`email check` print. */
export function formatPlan(p: EmailPlan): string {
  const glyph = (s: StepPlan) => (s.action === 'skip' ? '·' : s.action === 'blocked' ? '?' : '+');
  const lines: string[] = [];
  for (const d of p.domains) {
    lines.push(`${d.domain}  (${d.sources.join(', ')})`);
    lines.push(`  ${glyph(d.onboard)} ${d.onboard.detail}`);
    for (const r of d.reminders) lines.push(`  ! ${r}`);
  }
  for (const n of p.notes) lines.push(`! ${n}`);
  return lines.join('\n');
}

/** The outcome of one domain's run, for the summary table. */
export interface DomainResult {
  domain: string;
  onboard: 'created' | 'present' | 'blocked' | 'failed';
  reminders: string[];
}

export function formatSummary(results: DomainResult[]): string {
  const headers = ['DOMAIN', 'ONBOARD'];
  const rows = results.map((r) => [r.domain, r.onboard]);
  return table(
    headers,
    rows,
    results.flatMap((r) => r.reminders),
  );
}

/** One expected record vs. what DoH actually resolved for it. Pure — testable with no resolver. */
export function dnsStatus(
  expected: { type: 'MX' | 'TXT'; name: string; content: string }[],
  resolved: Map<string, string[]>,
): { record: (typeof expected)[number]; present: boolean }[] {
  return expected.map((record) => ({
    record,
    present: (resolved.get(record.name) ?? []).some((c) => c === record.content),
  }));
}
