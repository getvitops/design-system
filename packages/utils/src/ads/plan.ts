/**
 * Every decision `vitops ads setup` makes, as one pure function.
 *
 * Pure in the load-bearing sense: no `fetch`, no `fs`, no clock, no stdin. The
 * executor gathers each domain's live DNS state and applies what it is told; this
 * module decides, from that state, what is left to do. The same split
 * `onboarding/plan.ts` makes, for the same two payoffs: `--dry` is a *complete*
 * account of a run, and `--check` is an honest drift report.
 *
 * Idempotency lives here — a step whose desired state already holds resolves to
 * `skip`, so a re-run of a linked property is all skips by construction rather than
 * by the executor checking twice.
 *
 * One thing this planner adds over the onboarding one: a step that cannot proceed
 * for want of a **config value** resolves to `blocked` carrying the field name in
 * `needs`. That is a machine-readable gap, which is what lets the CLI *ask* for the
 * missing token and re-plan, while the planner itself stays pure and knows nothing
 * about a terminal. A blocked step is drift, never a skip — the first run of a
 * property whose token has not been fetched yet must not read as "already linked".
 */
import { AD_PLATFORMS, tagId, txtRecord } from './providers.ts';
import type { AdDomainState, AdPropertySetup, AdsConfig } from './types.ts';

/** A step's decision. `blocked` means the config is missing something. */
export type StepAction = 'create' | 'skip' | 'blocked';

/** A config field the operator can supply to unblock a step. */
export type MissingField = 'domainVerification' | 'accountId' | 'pixelId';

export interface StepPlan {
  action: StepAction;
  /** Why it's a skip, or what the mutation will do, or what is missing. */
  detail: string;
  /** Set only on `blocked`: which config field would unblock it. */
  needs?: MissingField | undefined;
}

/** The steps for one ad property, decided against its live state. */
export interface AdPropertyPlan {
  provider: AdPropertySetup['provider'];
  /** The platform name, so a formatter needn't reach back into the table. */
  name: string;
  /** The domain being verified, when the platform verifies one. */
  domain?: string | undefined;
  /** Ensure the apex verification TXT. */
  txt: StepPlan;
  /** Whether the tag can be emitted (`ads tags`). */
  tag: StepPlan;
  /** The exact TXT content to create, when `txt.action` is `create`. */
  txtContent?: string | undefined;
  /** Manual follow-ups — including *why* a platform has no verification step. */
  reminders: string[];
}

export interface AdsPlan {
  properties: AdPropertyPlan[];
  /** Operator-facing warnings that span the whole run. */
  notes: string[];
}

/**
 * Decide one property's steps.
 *
 * The `dns-txt` branch has three outcomes, and keeping them distinct is the point:
 * our record is present (skip), a *different* record from the same platform is
 * present (create, and say so — a token rotation leaves the old record in place,
 * since this command never edits or deletes DNS), or no token is configured yet
 * (blocked, naming the field).
 */
export function planProperty(setup: AdPropertySetup, state: AdDomainState): AdPropertyPlan {
  const platform = AD_PLATFORMS[setup.provider];
  const reminders = [...platform.manualSteps(setup)];

  let txt: StepPlan;
  let txtContent: string | undefined;

  if (platform.verification.method === 'none') {
    txt = { action: 'skip', detail: platform.verification.reason ?? 'no domain verification' };
  } else if (!setup.domainVerification) {
    txt = {
      action: 'blocked',
      detail: `needs the verification token from ${platform.verification.where ?? platform.consoleUrl}`,
      needs: 'domainVerification',
    };
  } else {
    const desired = txtRecord(setup.provider, setup.domainVerification);
    const prefix = platform.verification.txtPrefix;
    const stale =
      prefix != null && state.txtContents.some((c) => c.startsWith(prefix) && c !== desired);
    txt = state.txtContents.includes(desired)
      ? { action: 'skip', detail: 'verification TXT already present' }
      : {
          action: 'create',
          detail: stale
            ? 'create verification TXT (an older token from this platform is still present — remove it yourself; this command never deletes DNS)'
            : 'create verification TXT',
        };
    if (txt.action === 'create') txtContent = desired;
  }

  const id = tagId(setup);
  const tag: StepPlan = id
    ? { action: 'skip', detail: `tag ready (${platform.tag.needs} ${id})` }
    : {
        action: 'blocked',
        detail: `needs ${platform.tag.needs} from ${platform.consoleUrl} to emit the tag`,
        needs: platform.tag.needs,
      };

  return {
    provider: setup.provider,
    name: platform.name,
    ...(setup.domain ? { domain: setup.domain } : {}),
    txt,
    tag,
    ...(txtContent ? { txtContent } : {}),
    reminders,
  };
}

/** Plan every configured property. */
export function plan(config: AdsConfig, states: Map<string, AdDomainState>): AdsPlan {
  const notes: string[] = [];
  const properties = config.properties.map((setup) => {
    const key = setup.domain ?? '';
    const state = states.get(key);
    if (!state && AD_PLATFORMS[setup.provider].verification.method === 'dns-txt')
      // Should not happen — the CLI observes every verifiable domain before
      // planning — but a missing observation must not read as "nothing to do".
      notes.push(`${setup.provider}: no observed DNS state for ${key || '(no domain)'}`);
    return planProperty(setup, state ?? { txtContents: [] });
  });
  return { properties, notes };
}

/** Any step that isn't a skip — i.e. the live state or the config has drifted. */
export function hasDrift(p: AdsPlan): boolean {
  return p.properties.some((x) => x.txt.action !== 'skip' || x.tag.action !== 'skip');
}

/** Every field a run still needs, per provider — what the CLI asks for. */
export function missingFields(p: AdsPlan): { provider: string; needs: MissingField }[] {
  const out: { provider: string; needs: MissingField }[] = [];
  for (const x of p.properties) {
    for (const step of [x.txt, x.tag]) {
      if (step.action === 'blocked' && step.needs)
        out.push({ provider: x.provider, needs: step.needs });
    }
  }
  return out;
}

/** Render a plan as the block `--dry` and `--check` print. */
export function formatPlan(p: AdsPlan): string {
  const glyph = (s: StepPlan) => (s.action === 'skip' ? '·' : s.action === 'blocked' ? '?' : '+');
  const lines: string[] = [];
  for (const x of p.properties) {
    lines.push(`${x.provider}${x.domain ? `  (${x.domain})` : ''}`);
    lines.push(`  ${glyph(x.txt)} verify  ${x.txt.detail}`);
    lines.push(`  ${glyph(x.tag)} tag     ${x.tag.detail}`);
    for (const r of x.reminders) lines.push(`  ! ${r}`);
  }
  for (const n of p.notes) lines.push(`! ${n}`);
  return lines.join('\n');
}

/** The outcome of one property's run, for the summary table. */
export interface AdPropertyResult {
  provider: string;
  domain: string;
  txt: 'created' | 'present' | 'blocked' | 'failed' | 'n/a';
  tag: 'ready' | 'blocked';
  reminders: string[];
}

const pad = (s: string, n: number) => s.padEnd(n);

/** Render the end-of-run summary: one row per property, plus any reminders. */
export function formatSummary(results: AdPropertyResult[]): string {
  const headers = ['PROVIDER', 'DOMAIN', 'VERIFY', 'TAG'];
  const rows = results.map((r) => [r.provider, r.domain, r.txt, r.tag]);
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => row[i]?.length ?? 0)),
  );
  const line = (cells: string[]) =>
    cells
      .map((c, i) => pad(c, widths[i] ?? 0))
      .join('  ')
      .trimEnd();

  const out = [line(headers), widths.map((w) => '─'.repeat(w)).join('  ')];
  for (const row of rows) out.push(line(row));

  const reminders = results.flatMap((r) => r.reminders.map((m) => `  ! ${r.provider}: ${m}`));
  if (reminders.length) out.push('', 'Reminders (manual — no API):', ...reminders);
  return out.join('\n');
}
