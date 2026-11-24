/**
 * Every decision `vitops setup turnstile` makes, as one pure function.
 *
 * Pure in the load-bearing sense: no `fetch`, no `fs`, no clock, no stdin. The
 * executor (`cloudflare.ts`) lists the account's widgets and creates the missing one;
 * this module decides, from that observation, what is left to do. The same split
 * `ads/plan.ts` and `onboarding/plan.ts` make, for the same two payoffs: `--dry` is a
 * *complete* account of a run, and `--check` is an honest drift report.
 *
 * Idempotency lives here. A widget that already covers the site's domains resolves
 * to `skip`, so a re-run is all skips by construction rather than by the executor
 * checking twice. And there is no update or delete verb anywhere in this module's
 * vocabulary: an existing widget is only ever *adopted* (its public site key is
 * written to the config), never edited, rotated or removed.
 */
import { table } from '../plan-format.ts';
import type { TurnstileSetup, TurnstileState, WidgetSummary } from './types.ts';

export type StepAction = 'create' | 'skip' | 'blocked';

export interface StepPlan {
  action: StepAction;
  detail: string;
}

export interface TurnstilePlan {
  /** Create the widget in Cloudflare. */
  widget: StepPlan;
  /** Write the public site key to `site.security.turnstile.siteKey`. */
  config: StepPlan;
  /** The widget the config should point at, when one already exists (adopted). */
  adopt?: WidgetSummary | undefined;
  /** Hostnames the created widget will cover. */
  domains: string[];
  /** What only a human can do — most importantly, where the secret goes. */
  reminders: string[];
}

/** Cloudflare caps a widget at 10 domains; more is a plan-time refusal, not an API 400. */
export const MAX_DOMAINS = 10;

const covers = (w: WidgetSummary, domains: string[]): boolean =>
  domains.every((d) => w.domains.some((wd) => d === wd || d.endsWith(`.${wd}`)));

export function plan(setup: TurnstileSetup, state: TurnstileState): TurnstilePlan {
  const reminders = [
    'Set the secret on the Worker: `npx wrangler secret put VITOPS_TURNSTILE_SECRET` (and on the dev worker with `--env`/`--config` as your setup uses). It is shown once, at creation, and never written to site.json.',
  ];

  if (setup.domains.length === 0)
    return {
      widget: {
        action: 'blocked',
        detail:
          'no hostnames to protect — set site.domains.canonical or site.environments.<env>.url',
      },
      config: { action: 'blocked', detail: 'needs a widget first' },
      domains: [],
      reminders: [],
    };
  if (setup.domains.length > MAX_DOMAINS)
    return {
      widget: {
        action: 'blocked',
        detail: `${setup.domains.length} hostnames, but Cloudflare allows ${MAX_DOMAINS} per widget`,
      },
      config: { action: 'blocked', detail: 'needs a widget first' },
      domains: setup.domains,
      reminders: [],
    };

  if (!state.accountId)
    return {
      widget: {
        action: 'blocked',
        detail:
          'no Cloudflare account id — set CLOUDFLARE_ACCOUNT_ID (or use a token that can list accounts)',
      },
      config: { action: 'blocked', detail: 'needs a widget first' },
      domains: setup.domains,
      reminders: [],
    };

  // The config's own key wins: if it names a widget in this account, that is the one.
  const configured = setup.siteKey
    ? state.widgets.find((w) => w.sitekey === setup.siteKey)
    : undefined;
  if (setup.siteKey && !configured) {
    // A key that no widget in this account owns is drift (typo, another account, a deleted
    // widget). Creating a second widget would hide it, so stop and say so.
    return {
      widget: {
        action: 'blocked',
        detail: `site.security.turnstile.siteKey ${setup.siteKey} matches no widget in this account — remove it to let setup adopt or create one`,
      },
      config: { action: 'blocked', detail: 'config key is unverified' },
      domains: setup.domains,
      reminders: [],
    };
  }

  const existing = configured ?? state.widgets.find((w) => covers(w, setup.domains));
  if (existing) {
    const uncovered = setup.domains.filter((d) => !covers(existing, [d]));
    return {
      widget: {
        action: 'skip',
        detail:
          uncovered.length === 0
            ? `widget "${existing.name}" already covers ${setup.domains.join(', ')}`
            : `widget "${existing.name}" exists but does not cover ${uncovered.join(', ')} — add them in the dashboard; this command never edits a widget`,
      },
      config:
        setup.siteKey === existing.sitekey
          ? { action: 'skip', detail: 'site key already in site.json' }
          : { action: 'create', detail: `write ${existing.sitekey} to site.json` },
      adopt: existing,
      domains: setup.domains,
      reminders: [
        'The secret of an existing widget cannot be read back. Lost it? Rotate it in the dashboard (Turnstile > the widget > Rotate secret), then `wrangler secret put VITOPS_TURNSTILE_SECRET`.',
      ],
    };
  }

  return {
    widget: {
      action: 'create',
      detail: `create "${setup.name}" (managed) for ${setup.domains.join(', ')}`,
    },
    config: { action: 'create', detail: 'write the new site key to site.json' },
    domains: setup.domains,
    reminders,
  };
}

/** Any step that isn't a skip — the live state or the config has drifted. */
export function hasDrift(p: TurnstilePlan): boolean {
  return p.widget.action !== 'skip' || p.config.action !== 'skip';
}

const GLYPH: Record<StepAction, string> = { create: '+', skip: '·', blocked: '!' };

export function formatPlan(p: TurnstilePlan): string {
  const rows = (
    [
      ['widget', p.widget],
      ['config', p.config],
    ] as const
  ).map(([name, step]) => [GLYPH[step.action], name, step.detail]);
  return table(['', 'step', 'detail'], rows, p.reminders);
}

export type StepStatus = 'created' | 'present' | 'blocked' | 'failed';

export interface TurnstileResult {
  step: string;
  status: StepStatus;
  detail: string;
}

export function formatSummary(results: TurnstileResult[]): string {
  return table(
    ['step', 'status', 'detail'],
    results.map((r) => [r.step, r.status, r.detail]),
    [],
  );
}
