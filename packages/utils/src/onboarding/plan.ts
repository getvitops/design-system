/**
 * Every decision `vitops search setup` makes, as one pure function.
 *
 * Pure in the load-bearing sense: no `fetch`, no `fs`, no clock. The executors
 * beside this one gather each domain's live state and apply what they are told;
 * this module decides, from that state, what is left to do. That split is what
 * makes `--dry` a complete account of a run and `--check` an honest drift report —
 * the same arrangement the indexing planner makes against `gsc.ts`/`indexnow.ts`.
 *
 * Idempotency lives here too: a step whose desired state already holds resolves to
 * `skip`, so a re-run of a fully-onboarded domain is all skips — a no-op, by
 * construction rather than by the executors checking twice.
 */
import type { DomainSetup, DomainState } from './types.ts';

/** A step's decision: do it, or skip it because it already holds. */
export type StepAction = 'create' | 'update' | 'skip';

export interface StepPlan {
  action: StepAction;
  /** Why it's a skip, or what the mutation will do. */
  detail: string;
}

/** The four onboarding steps for one domain, decided against its live state. */
export interface DomainPlan {
  domain: string;
  /** `sc-domain:` property identifier this domain maps to. */
  siteUrl: string;
  /** Ensure the apex TXT verification record. */
  txt: StepPlan;
  /** Verify ownership via the Site Verification API (DNS_TXT). */
  verify: StepPlan;
  /** Add the Search Console domain property. */
  property: StepPlan;
  /** Add delegated owners to the verified web resource. */
  owners: StepPlan;
  /** Owners not yet present that the run should add. */
  ownersToAdd: string[];
  /** Manual follow-ups (e.g. a Full-User group). */
  reminders: string[];
}

export interface OnboardingPlan {
  domains: DomainPlan[];
  /** Operator-facing warnings that span the whole run. */
  notes: string[];
}

/** The `sc-domain:` property identifier for a bare domain. */
export const siteUrlFor = (domain: string): string => `sc-domain:${domain}`;

/**
 * Backoff ladder for the verification retry, in milliseconds.
 *
 * DNS_TXT verification fails until the record has propagated, which is a matter of
 * seconds-to-minutes, not a real error — so the schedule is a *policy*, decided
 * here and asserted in the tests, while the actual sleeping is the CLI's job.
 * Capped at `maxAttempts`; a domain still unverified after the last attempt is
 * reported PENDING, never failed.
 */
export function backoffSchedule(maxAttempts = 5): number[] {
  const out: number[] = [];
  for (let i = 1; i <= maxAttempts; i++) out.push(2 ** i * 1000);
  return out;
}

/** Decide the four steps for one domain from its desired config and live state. */
export function planDomain(setup: DomainSetup, state: DomainState): DomainPlan {
  const reminders: string[] = [];
  if (setup.fullUserGroup)
    reminders.push(
      `add ${setup.fullUserGroup} as a Full User in Search Console — no API exists for this, do it in the UI`,
    );

  const txt: StepPlan = state.txtPresent
    ? { action: 'skip', detail: 'apex TXT already present' }
    : { action: 'create', detail: 'create apex TXT verification record' };

  const verify: StepPlan = state.verified
    ? { action: 'skip', detail: 'ownership already verified' }
    : { action: 'create', detail: 'verify ownership (DNS_TXT)' };

  const property: StepPlan = state.propertyExists
    ? { action: 'skip', detail: 'property already exists' }
    : { action: 'create', detail: `add property ${siteUrlFor(setup.domain)}` };

  // Owners can only be read once verified; before that, treat every delegated
  // owner as still-to-add so --check reports the drift rather than hiding it.
  const desired = setup.delegatedOwners ?? [];
  const present = new Set(state.currentOwners.map((o) => o.toLowerCase()));
  const ownersToAdd = desired.filter((o) => !present.has(o.toLowerCase()));
  const owners: StepPlan =
    desired.length === 0
      ? { action: 'skip', detail: 'no delegated owners' }
      : ownersToAdd.length === 0
        ? { action: 'skip', detail: 'all delegated owners already present' }
        : { action: 'update', detail: `add ${ownersToAdd.length} owner(s): ${ownersToAdd.join(', ')}` };

  return {
    domain: setup.domain,
    siteUrl: siteUrlFor(setup.domain),
    txt,
    verify,
    property,
    owners,
    ownersToAdd,
    reminders,
  };
}

/** Plan every domain. */
export function plan(config: { domains: DomainSetup[] }, states: Map<string, DomainState>): OnboardingPlan {
  const notes: string[] = [];
  const domains = config.domains.map((setup) => {
    const state = states.get(setup.domain);
    if (!state)
      // Should not happen — the CLI observes every domain before planning — but a
      // missing observation must not silently read as "nothing to do".
      notes.push(`${setup.domain}: no observed state; treating everything as pending`);
    return planDomain(
      setup,
      state ?? { txtPresent: false, verified: false, currentOwners: [], propertyExists: false },
    );
  });
  return { domains, notes };
}

/** Any step on any domain is a mutation — i.e. the live state has drifted. */
export function hasDrift(p: OnboardingPlan): boolean {
  return p.domains.some(
    (d) =>
      d.txt.action !== 'skip' ||
      d.verify.action !== 'skip' ||
      d.property.action !== 'skip' ||
      d.owners.action !== 'skip',
  );
}

/** Render a plan as the block `--dry` and `--check` print. */
export function formatPlan(p: OnboardingPlan): string {
  const lines: string[] = [];
  const glyph = (s: StepPlan) => (s.action === 'skip' ? '·' : '+');
  for (const d of p.domains) {
    lines.push(d.domain);
    lines.push(`  ${glyph(d.txt)} TXT       ${d.txt.detail}`);
    lines.push(`  ${glyph(d.verify)} verify    ${d.verify.detail}`);
    lines.push(`  ${glyph(d.property)} property  ${d.property.detail}`);
    lines.push(`  ${glyph(d.owners)} owners    ${d.owners.detail}`);
    for (const r of d.reminders) lines.push(`  ! ${r}`);
  }
  for (const n of p.notes) lines.push(`! ${n}`);
  return lines.join('\n');
}

/** The outcome of one domain's run, for the summary table. */
export interface DomainResult {
  domain: string;
  txt: 'created' | 'present' | 'failed' | '—';
  verified: 'yes' | 'pending' | 'failed' | '—';
  property: 'added' | 'present' | 'failed' | '—';
  reminders: string[];
}

const pad = (s: string, n: number) => s.padEnd(n);

/** Render the end-of-run summary: one row per domain, plus any reminders. */
export function formatSummary(results: DomainResult[]): string {
  const headers = ['DOMAIN', 'TXT', 'VERIFIED', 'PROPERTY'];
  const rows = results.map((r) => [r.domain, r.txt, r.verified, r.property]);
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => row[i]?.length ?? 0)),
  );
  const line = (cells: string[]) => cells.map((c, i) => pad(c, widths[i] ?? 0)).join('  ').trimEnd();

  const out = [line(headers), widths.map((w) => '─'.repeat(w)).join('  ')];
  for (const row of rows) out.push(line(row));

  const reminders = results.flatMap((r) => r.reminders.map((m) => `  ! ${r.domain}: ${m}`));
  if (reminders.length) {
    out.push('', 'Reminders (manual — no API):', ...reminders);
  }
  return out.join('\n');
}
