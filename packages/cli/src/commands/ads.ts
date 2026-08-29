/**
 * `vitops ads` — everything that links this site to an ad platform. Three
 * subcommands, split by what they touch: `setup` writes DNS, `tags` writes
 * nothing and prints markup, `lint` reads and reports.
 */
import {
  AD_PLATFORMS,
  AD_PROVIDER_KEYS,
  formatPlan as formatPlanAds,
  formatSummary as formatAdsSummary,
  hasDrift as hasAdsDrift,
  isAdProvider,
  missingFields,
  plan as planAds,
  renderTag,
  tagId,
  type AdDomainState,
  type AdPropertyResult,
  type AdPropertySetup,
  type AdProvider,
  type MissingField,
} from '@getvitops/utils/ads';
import { createApexTxt, findZoneId, listApexTxt } from '@getvitops/utils/onboarding';
import { PLATFORM_PARAMS } from '@getvitops/utils/tracking';
import type { Config } from '@getvitops/generator';
import { parse } from '../args.ts';
import { CLOUDFLARE_TOKEN_HINT, loadCloudflareToken } from '../credentials.ts';
import { ask, canPrompt, missingFieldMessage, questionFor, writeConfigPatch } from '../prompt.ts';
import { fail, loadConfig, pickOne, siteConfig, SITE_OPTS } from './shared.ts';
import { ADS_HELP } from '../help.ts';

/**
 * Adapt a `Config` to the ads module's own option shape.
 *
 * The same flat field map as `toSearchConsoleSetup` and `toIndexingConfig`, for the
 * same reason — utils cannot import the generator. The domain default is the one
 * derived value: a platform verifies the host the site is published at, so
 * `domains.canonical` answers it, and only an ad account verified against some
 * other host needs `site.ads.<provider>.domain` stated.
 */
function toAdProperties(cfg: Config, providerFilter: string | undefined): AdPropertySetup[] {
  const canonicalHost = (() => {
    const url = cfg.site.domains?.canonical;
    if (!url) return undefined;
    try {
      return new URL(url).hostname;
    } catch {
      return undefined;
    }
  })();

  const entries = cfg.site.ads ?? {};
  const properties: AdPropertySetup[] = AD_PROVIDER_KEYS.filter((p) => entries[p] != null).map(
    (provider) => {
      const e = entries[provider]!;
      const domain = e.domain ?? canonicalHost;
      return {
        provider,
        ...(e.accountId ? { accountId: e.accountId } : {}),
        ...(e.pixelId ? { pixelId: e.pixelId } : {}),
        ...(e.conversionLabel ? { conversionLabel: e.conversionLabel } : {}),
        ...(domain ? { domain } : {}),
        ...(e.domainVerification ? { domainVerification: e.domainVerification } : {}),
        ...(e.category ? { category: e.category } : {}),
        ...(e.enabled != null ? { enabled: e.enabled } : {}),
      };
    },
  );

  if (providerFilter && !isAdProvider(providerFilter))
    fail(
      `--provider "${providerFilter}" is not a known ad platform (expected: ${AD_PROVIDER_KEYS.join(' | ')})`,
    );
  return pickOne(properties, providerFilter, (p) => p.provider, {
    flag: 'provider',
    source: 'site.ads',
  });
}

/**
 * Link each configured ad property: ensure the platform's domain-verification TXT,
 * report what only a human can finish.
 *
 * Idempotent by construction — the planner decides each step from live DNS, so a
 * re-run of a linked property is all skips. `--check` reports drift and exits
 * non-zero without mutating; `--dry` prints the plan and stops. Neither is offline:
 * the DNS observation runs before the planner either way.
 *
 * The one thing this does that `search setup` does not is **ask**. A first run has
 * no verification token, because the token doesn't exist until someone fetches it
 * from the platform UI — so a blocked step becomes a prompt, the answer is folded
 * into the setup, and the planner runs again on it. That re-plan matters: what gets
 * executed is always a plan the pure planner produced, never a special case built
 * out of an answer.
 */
async function cmdAdsSetup(argv: string[]) {
  const a = parse(argv, {
    ...SITE_OPTS,
    provider: { type: 'string' },
    check: { type: 'boolean', default: false },
    dry: { type: 'boolean', default: false },
    'no-prompt': { type: 'boolean', default: false },
    'no-write': { type: 'boolean', default: false },
  });

  const input = a.path('input');
  const cfg = await loadConfig(input, a.str('site-env'));
  let properties = toAdProperties(cfg, a.opt('provider'));
  if (properties.length === 0)
    fail('no properties in site.ads — add the ad platforms this site is linked to');

  const dry = a.flag('dry');
  const check = a.flag('check');

  // Only the DNS-verifying platforms need a Cloudflare token; a config of
  // tag-only platforms (Google Ads, LinkedIn, Reddit, Microsoft) has no DNS work
  // at all, and demanding a credential for a run that writes nothing would be an
  // obstacle standing in front of an empty room.
  const needsDns = properties.some(
    (p) => AD_PLATFORMS[p.provider].verification.method === 'dns-txt',
  );
  const cfToken = loadCloudflareToken();
  // As in `search setup`: a dry run mutates nothing, so it must not demand the
  // credential to mutate. Without one it cannot read live DNS either, so
  // `observe()` returns an empty map and the plan is "from scratch" — still the
  // complete account of a first run, and showable before anything is provisioned.
  if (needsDns && !cfToken && dry !== true) fail(CLOUDFLARE_TOKEN_HINT);

  /** Observe live DNS per domain. Cached by domain: several platforms share one. */
  const observe = async (): Promise<Map<string, AdDomainState>> => {
    const states = new Map<string, AdDomainState>();
    if (!cfToken) return states;
    for (const p of properties) {
      const domain = p.domain;
      if (!domain || states.has(domain)) continue;
      if (AD_PLATFORMS[p.provider].verification.method !== 'dns-txt') continue;
      const zone = await findZoneId(cfToken, domain);
      if (!zone.ok || !zone.zoneId) fail(`${domain}: ${zone.message}`);
      const txt = await listApexTxt(cfToken, zone.zoneId, domain);
      if (!txt.ok) fail(`${domain}: ${txt.message}`);
      states.set(domain, { zoneId: zone.zoneId, txtContents: txt.contents });
    }
    return states;
  };

  let states = await observe();
  let adsPlan = planAds({ properties }, states);

  // ── Ask for what the config is missing, then re-plan on the answers ──────────
  const interactive = canPrompt({
    dry,
    check,
    noPrompt: a.flag('no-prompt'),
  });
  const gaps = missingFields(adsPlan);
  if (gaps.length && interactive) {
    const answers: { provider: AdProvider; needs: MissingField; value: string }[] = [];
    for (const gap of gaps) {
      const value = await ask(questionFor(gap.provider as AdProvider, gap.needs));
      if (value) answers.push({ provider: gap.provider as AdProvider, needs: gap.needs, value });
    }
    if (answers.length) {
      properties = properties.map((p) => {
        const mine = answers.filter((a) => a.provider === p.provider);
        return mine.reduce((acc, a) => ({ ...acc, [a.needs]: a.value }), p);
      });
      adsPlan = planAds({ properties }, states);
      if (!a.flag('no-write')) {
        for (const ans of answers) {
          const res = writeConfigPatch(input, ans.provider, ans.needs, ans.value);
          if (res.written) console.log(`✓ wrote site.ads.${ans.provider}.${ans.needs} to ${input}`);
          else console.error(`! ${res.reason}`);
        }
      }
    }
    // A token answered now may name a record we haven't looked for yet.
    states = await observe();
    adsPlan = planAds({ properties }, states);
  } else if (gaps.length && !dry && !check) {
    for (const gap of gaps)
      console.error(`! ${missingFieldMessage(gap.provider as AdProvider, gap.needs)}`);
  }

  if (dry || check) {
    console.log(formatPlanAds(adsPlan));
    if (check && hasAdsDrift(adsPlan)) {
      console.error('\n✖ ad properties are not fully linked');
      process.exit(1);
    }
    return;
  }

  // ── Apply ────────────────────────────────────────────────────────────────────
  const results: AdPropertyResult[] = [];
  let failed = false;
  for (const p of adsPlan.properties) {
    const result: AdPropertyResult = {
      provider: p.provider,
      domain: p.domain ?? '—',
      txt: 'n/a',
      tag: p.tag.action === 'skip' ? 'ready' : 'blocked',
      reminders: p.reminders,
    };
    // A property still missing a field after the prompt round is not linked, and
    // the exit code has to say so — a run that silently succeeds while a pixel has
    // no id is the failure this command exists to make visible.
    if (p.txt.action === 'blocked' || p.tag.action === 'blocked') failed = true;
    if (p.txt.action === 'blocked') result.txt = 'blocked';
    else if (p.txt.action === 'skip')
      result.txt = AD_PLATFORMS[p.provider].verification.method === 'dns-txt' ? 'present' : 'n/a';
    else {
      const zoneId = p.domain ? states.get(p.domain)?.zoneId : undefined;
      if (!cfToken || !zoneId || !p.domain || !p.txtContent) {
        console.error(`✖ ${p.provider}: no Cloudflare zone for ${p.domain ?? '(no domain)'}`);
        result.txt = 'failed';
        failed = true;
      } else {
        const r = await createApexTxt(cfToken, zoneId, p.domain, p.txtContent);
        if (!r.ok) {
          console.error(`✖ ${p.provider} TXT: ${r.message}`);
          result.txt = 'failed';
          failed = true;
        } else {
          console.log(`✓ ${p.provider}: created TXT on ${p.domain}`);
          result.txt = 'created';
        }
      }
    }
    results.push(result);
  }

  console.log(`\n${formatAdsSummary(results)}`);
  if (results.some((r) => r.txt === 'created'))
    console.log('\n  DNS takes minutes to propagate before a platform can see the record.');
  if (results.some((r) => r.reminders.length))
    console.log('  Finish the reminders above in the platform UI — no API covers those.');
  if (failed) process.exit(1);
}

/**
 * Print each configured pixel as an inert, consent-gated `<script>`.
 *
 * The universal delivery path, the same reasoning as `vitops legal`: every consumer
 * has this CLI whatever their stack, so Bricks, WordPress and a hand-built site all
 * get the correct gated markup without integration code.
 */
async function cmdAdsTags(argv: string[]) {
  const a = parse(argv, {
    ...SITE_OPTS,
    provider: { type: 'string' },
    strategy: { type: 'string', default: 'idle' },
  });

  const strategy = a.str('strategy');
  if (!['idle', 'async', 'interaction'].includes(strategy))
    fail(`--strategy "${strategy}" is not one of: idle | async | interaction`);

  const cfg = await siteConfig(a);
  const properties = toAdProperties(cfg, a.opt('provider'));
  if (properties.length === 0) fail('no properties in site.ads — nothing to emit');

  const out: string[] = [];
  for (const p of properties) {
    if (p.enabled === false) continue;
    const tag = renderTag(p, strategy as 'idle' | 'async' | 'interaction');
    if (!tag) {
      console.error(
        `! ${p.provider}: no ${AD_PLATFORMS[p.provider].tag.needs} — skipped (run \`vitops ads setup\` to be prompted for it)`,
      );
      continue;
    }
    out.push(tag);
  }
  if (out.length === 0) fail('no ad property has a tag id yet');
  console.log(out.join('\n\n'));
}

/**
 * Report the ad-property gaps that are invisible at runtime.
 *
 * Each finding is a silent failure, which is the bar for being here at all: an
 * uncaptured click ID looks exactly like organic traffic, and a pixel on a site
 * with tracking off produces conversions no campaign gets credit for.
 */
async function cmdAdsLint(argv: string[]) {
  const a = parse(argv, SITE_OPTS);

  const cfg = await siteConfig(a);
  const properties = toAdProperties(cfg, undefined);
  if (properties.length === 0) {
    console.log('· no site.ads properties — nothing to check');
    return;
  }

  const findings: string[] = [];
  const trackingOn = cfg.site.tracking?.enabled === true;

  for (const p of properties) {
    const platform = AD_PLATFORMS[p.provider];
    if (p.enabled === false) continue;

    if (!tagId(p))
      findings.push(
        `${p.provider}: no ${platform.tag.needs} — the property is on record but no tag can be emitted`,
      );

    const uncaptured = platform.clickIdParams.filter((param) => !(param in PLATFORM_PARAMS));
    if (uncaptured.length)
      findings.push(
        `${p.provider}: click ID ${uncaptured.join(', ')} is not in the capture vocabulary — every conversion from this platform will arrive unattributed`,
      );

    if (!trackingOn)
      findings.push(
        `${p.provider}: site.tracking.enabled is not true, so ${platform.clickIdParams.join('/')} is never captured — conversions will be unattributed`,
      );
  }

  if (findings.length === 0) {
    console.log(
      `✓ ${properties.length} ad propert${properties.length === 1 ? 'y' : 'ies'} check out`,
    );
    return;
  }
  for (const f of findings) console.error(`✖ ${f}`);
  process.exit(1);
}

export async function cmdAds(argv: string[]) {
  const [sub, ...rest] = argv;
  switch (sub) {
    case 'setup':
      return cmdAdsSetup(rest);
    case 'tags':
      return cmdAdsTags(rest);
    case 'lint':
      return cmdAdsLint(rest);
    case undefined:
    case '-h':
    case '--help':
      console.log(ADS_HELP);
      return;
    default:
      fail(`unknown "ads" subcommand "${sub}" (expected: setup | tags | lint). Try: vitops --help`);
  }
}
