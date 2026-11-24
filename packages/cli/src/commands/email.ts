/**
 * `vitops email` — connect `site.notifications.email.from` to whether its domain
 * is actually onboarded onto an outbound email provider.
 *
 * The silent failure this exists to catch: `EMAIL.send()` throws
 * `E_SENDER_NOT_VERIFIED` at runtime with nothing at build or deploy time saying
 * a word, because nothing previously checked the `from` domain against Cloudflare
 * Email Sending's actual onboarding state. Two subcommands, split by what they
 * do: `setup` onboards a domain and waits for its DNS to resolve; `check` is the
 * non-blocking deploy guard.
 */
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import {
  blockedDomains,
  dnsStatus,
  enableSending,
  findZoneForHost,
  formatPlan as formatEmailPlan,
  formatSummary as formatEmailSummary,
  hasDrift as hasEmailDrift,
  listSendingSubdomains,
  planSendingDomains,
  resolveTxt,
  sendingDns,
  backoffSchedule,
  collectFromAddresses,
  type DomainResult,
  type FromCandidate,
  type ZoneSendingState,
} from '@getvitops/utils/email';
import { normalizeEmailChannel, resolveSender } from '@getvitops/utils/notify';
import { scanFiles } from '@getvitops/utils';
import type { Config } from '@getvitops/generator';
import { parse } from '../args.ts';
import { CLOUDFLARE_TOKEN_HINT, loadCloudflareToken } from '../credentials.ts';
import { fail, loadConfig, siteConfig, SITE_OPTS } from './shared.ts';
import { EMAIL_HELP } from '../help.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Every `from` domain worth checking: the explicit config value first, its
 * derived `noreply@<canonical>` default second, and a best-effort scan of
 * `--src` as a supplement — never the primary source, since a computed value in
 * source is reported as dynamic rather than guessed at (see `email/scan.ts`).
 */
function gatherCandidates(
  cfg: Config,
  srcDir: string,
): { candidates: FromCandidate[]; dynamicNotes: string[] } {
  const candidates: FromCandidate[] = [];
  const dynamicNotes: string[] = [];

  const channel = normalizeEmailChannel(cfg.site.notifications?.email);
  const canonical = cfg.site.domains?.canonical;
  const address = resolveSender(channel ?? { provider: 'cloudflare' }, { canonical });
  if (address) {
    const domain = address.split('@')[1];
    if (domain) candidates.push({ address, domain, source: channel?.from ? 'config' : 'derived' });
  }

  if (existsSync(srcDir)) {
    const { addresses, dynamic } = collectFromAddresses(scanFiles(srcDir));
    for (const a of addresses) {
      const domain = a.split('@')[1];
      if (domain && !candidates.some((c) => c.address === a))
        candidates.push({ address: a, domain, source: 'scan' });
    }
    for (const d of dynamic)
      dynamicNotes.push(`! ${d.file}:${d.line}: from is computed (\`${d.expr}\`) — not checked`);
  }

  return { candidates, dynamicNotes };
}

/** Observe each candidate domain's zone, keyed by the domain itself (not the zone name). */
async function observeZones(
  token: string | undefined,
  domains: string[],
): Promise<{ states: Map<string, ZoneSendingState>; failures: string[] }> {
  const states = new Map<string, ZoneSendingState>();
  const failures: string[] = [];
  if (!token) return { states, failures };
  for (const domain of domains) {
    const zone = await findZoneForHost(token, domain);
    if (!zone.ok || !zone.zoneId) {
      failures.push(`${domain}: ${zone.message}`);
      continue;
    }
    const res = await listSendingSubdomains(token, zone.zoneId);
    if (!res.ok) {
      failures.push(`${domain}: ${res.message}`);
      continue;
    }
    states.set(domain, { zoneId: zone.zoneId, subdomains: res.subdomains });
  }
  return { states, failures };
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

/**
 * Onboard a `from` domain and wait for its DNS to resolve.
 *
 * Idempotent by construction — a re-run of a fully-onboarded domain is all
 * skips. `--dry` prints the plan and mutates nothing (and needs no credential,
 * planning from scratch); `--check` reports drift and exits non-zero.
 */
async function cmdEmailSetup(argv: string[]) {
  const a = parse(
    argv,
    {
      ...SITE_OPTS,
      src: { type: 'string', default: 'src' },
      dry: { type: 'boolean', default: false },
      check: { type: 'boolean', default: false },
      'no-prompt': { type: 'boolean', default: false },
      timeout: { type: 'string', default: '5' },
    },
    true,
  );

  const cfg = await loadConfig(a.path('input'), a.str('site-env'));
  const explicitDomain = a.positionals[0];
  const dry = a.flag('dry');
  const check = a.flag('check');

  const { candidates, dynamicNotes } = explicitDomain
    ? {
        candidates: [
          {
            address: `noreply@${explicitDomain}`,
            domain: explicitDomain,
            source: 'config' as const,
          },
        ],
        dynamicNotes: [],
      }
    : gatherCandidates(cfg, a.path('src'));

  if (candidates.length === 0)
    fail(
      'no from domain to check — set site.notifications.email.from or site.domains.canonical, or pass a domain: vitops email setup <domain>',
    );

  const cfToken = loadCloudflareToken();
  if (!cfToken && !dry) fail(CLOUDFLARE_TOKEN_HINT);

  const domains = [...new Set(candidates.map((c) => c.domain))];
  const { states, failures } = await observeZones(cfToken, domains);
  const emailPlan = planSendingDomains({ candidates, provider: 'cloudflare' }, states);

  if (dry || check) {
    console.log(formatEmailPlan(emailPlan));
    for (const n of dynamicNotes) console.log(n);
    for (const f of failures) console.error(`! ${f}`);
    if (check && hasEmailDrift(emailPlan)) {
      console.error('\n✖ a from domain is not fully onboarded');
      process.exit(1);
    }
    return;
  }

  const interactive = !a.flag('no-prompt') && Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const timeoutMs = Number(a.str('timeout')) * 1000;

  const results: DomainResult[] = [];
  let failed = false;
  for (const d of emailPlan.domains) {
    if (d.onboard.action === 'skip') {
      results.push({ domain: d.domain, onboard: 'present', reminders: [] });
      continue;
    }
    if (d.onboard.action === 'blocked') {
      console.error(`? ${d.domain}: ${d.onboard.detail}`);
      results.push({ domain: d.domain, onboard: 'blocked', reminders: [] });
      failed = true;
      continue;
    }

    console.log(`\n${d.domain}: ${d.onboard.detail}`);
    if (interactive && !(await confirm(`Enable Email Sending for "${d.domain}"?`))) {
      results.push({ domain: d.domain, onboard: 'blocked', reminders: ['skipped by operator'] });
      continue;
    }

    const zone = await findZoneForHost(cfToken!, d.domain);
    if (!zone.ok || !zone.zoneId) {
      console.error(`✖ ${d.domain}: ${zone.message}`);
      results.push({ domain: d.domain, onboard: 'failed', reminders: [] });
      failed = true;
      continue;
    }
    const enabled = await enableSending(cfToken!, zone.zoneId, d.domain);
    if (!enabled.ok) {
      console.error(`✖ ${d.domain}: ${enabled.message}`);
      results.push({ domain: d.domain, onboard: 'failed', reminders: [] });
      failed = true;
      continue;
    }
    console.log(`✓ ${d.domain}: enabled`);

    const reminders: string[] = [];
    if (enabled.tag) {
      const dns = await sendingDns(cfToken!, zone.zoneId, enabled.tag);
      const expected = dns.records.filter((r) => r.type === 'TXT');
      if (dns.ok && expected.length) {
        const schedule = backoffSchedule();
        let pending = expected;
        for (let attempt = 0; attempt < schedule.length && pending.length; attempt++) {
          await sleep(Math.min(schedule[attempt]!, timeoutMs));
          const resolved = new Map<string, string[]>();
          for (const name of new Set(pending.map((r) => r.name))) {
            const r = await resolveTxt(name);
            if (r.ok) resolved.set(name, r.contents);
          }
          const status = dnsStatus(pending, resolved);
          pending = status.filter((s) => !s.present).map((s) => s.record);
          console.log(
            `  DNS: ${expected.length - pending.length}/${expected.length} records resolving (attempt ${attempt + 1}/${schedule.length})`,
          );
        }
        if (pending.length)
          reminders.push(
            `${pending.length} DNS record(s) not yet resolving — check again shortly.`,
          );
      }
    }
    results.push({ domain: d.domain, onboard: 'created', reminders });
  }

  console.log(`\n${formatEmailSummary(results)}`);
  for (const n of dynamicNotes) console.log(n);
  for (const f of failures) console.error(`! ${f}`);
  if (failed) process.exit(1);
}

/**
 * The non-blocking deploy guard: warn when a `from` domain isn't onboarded,
 * exit 0 by default. `--strict` makes it a real gate.
 *
 * Runs with no credential too — it then reports "not checked", exits 0, and a
 * CI job with no CLOUDFLARE_API_TOKEN never fails on the check itself.
 */
async function cmdEmailCheck(argv: string[]) {
  const a = parse(argv, {
    ...SITE_OPTS,
    src: { type: 'string', default: 'src' },
    strict: { type: 'boolean', default: false },
    skip: { type: 'boolean', default: false },
  });

  if (a.flag('skip') || process.env['VITOPS_SKIP_EMAIL_CHECK']) {
    console.log('· vitops email check: skipped (--skip / VITOPS_SKIP_EMAIL_CHECK)');
    return;
  }

  const cfg = await siteConfig(a);
  const emailCfg = cfg.site.notifications?.email;
  if (typeof emailCfg === 'object' && emailCfg.verifySender === false) {
    console.log('· vitops email check: skipped (site.notifications.email.verifySender is false)');
    return;
  }

  const { candidates, dynamicNotes } = gatherCandidates(cfg, a.path('src'));
  if (candidates.length === 0) {
    console.log('· no from domain configured — nothing to check');
    return;
  }

  const cfToken = loadCloudflareToken();
  if (!cfToken) {
    console.log('· vitops email check: not checked — no CLOUDFLARE_API_TOKEN');
    return;
  }

  const domains = [...new Set(candidates.map((c) => c.domain))];
  const { states, failures } = await observeZones(cfToken, domains);
  const emailPlan = planSendingDomains({ candidates, provider: 'cloudflare' }, states);

  for (const n of dynamicNotes) console.log(n);
  for (const f of failures) console.error(`! ${f}`);

  const blocked = blockedDomains(emailPlan);
  if (blocked.length === 0) {
    console.log(`✓ every from domain is onboarded`);
    return;
  }
  for (const b of blocked) console.error(`! ${b.domain}: ${b.onboard.detail}`);
  if (a.flag('strict')) {
    console.error('\n✖ a from domain is not onboarded (--strict)');
    process.exit(1);
  }
}

export async function cmdEmail(argv: string[]) {
  const [sub, ...rest] = argv;
  switch (sub) {
    case 'setup':
      return cmdEmailSetup(rest);
    case 'check':
      return cmdEmailCheck(rest);
    case undefined:
    case '-h':
    case '--help':
      console.log(EMAIL_HELP);
      return;
    default:
      fail(`unknown "email" subcommand "${sub}" (expected: setup | check). Try: vitops --help`);
  }
}
