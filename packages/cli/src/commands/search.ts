/**
 * `vitops search` — everything that talks to search engines: `setup` onboards a
 * domain into Search Console (DNS + verification + property), `notify` tells the
 * engines a deploy happened (sitemap + IndexNow). `notify` is the former
 * top-level `vitops indexing`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  SNAPSHOT_PATH,
  collectEntries,
  formatPlan,
  googleAccessToken,
  inspectUrl,
  keyFileContents,
  newKey,
  plan,
  readSnapshot,
  resolveKeyLocation,
  resolveSitemapUrl,
  submitBatch,
  submitSitemap,
  toSnapshot,
  verifyKeyFile,
  writeSnapshot,
  type GoogleAuthLike,
  type GoogleCredential,
  type IndexingConfig,
} from '@getvitops/utils/indexing';
import {
  addSite,
  backoffSchedule,
  createApexTxt,
  findZoneId,
  formatPlan as formatSetupPlan,
  formatSummary,
  refreshTokenGrant,
  getSite,
  getVerificationToken,
  getWebResource,
  hasDrift,
  listApexTxt,
  ownerUnion,
  plan as planSetup,
  siteUrlFor,
  updateOwners,
  verifyWebResource,
  type DomainResult,
  type DomainSetup,
  type DomainState,
} from '@getvitops/utils/onboarding';
import { parse } from '../args.ts';
import {
  CLOUDFLARE_TOKEN_HINT,
  CREDENTIAL_HINT,
  isOauthUsable,
  loadCloudflareToken,
  loadGoogleOAuth,
  loadSearchCredential,
  requireAdcProject,
} from '../credentials.ts';
import { fail, pickOne, printPlanAndDryGate, siteConfig, SITE_OPTS, writeOut } from './shared.ts';
import { SEARCH_HELP } from '../help.ts';
import type { Config } from '@getvitops/generator';

/**
 * Adapt a `Config` to the indexing module's own option shape.
 *
 * A flat field map, as intended: `@getvitops/utils` cannot import from the
 * generator (the generator already depends on it), so `IndexingConfig` mirrors the
 * `seo.indexing` block rather than being it. The one piece of judgment here is the
 * origin — see below.
 */
function toIndexingConfig(cfg: Config, siteEnv: string): IndexingConfig {
  const site = cfg.site;
  const indexing = site.seo?.indexing ?? {};
  const env = site.environments?.[siteEnv];
  /*
   * The environment's own URL wins over `domains.canonical`.
   *
   * `domains.canonical` is the production origin — it is what absolute URLs and
   * SEO tags resolve against. Notifying a non-production environment while
   * deriving URLs from the canonical origin would submit *production* URLs under
   * the belief they were staging's, which the noindex gate below would then not
   * catch, because the gate reads the environment and the URLs would not.
   */
  const canonical = env?.url ?? site.domains?.canonical;
  return {
    ...(canonical ? { canonical } : {}),
    ...(indexing.sitemapUrl ? { sitemapUrl: indexing.sitemapUrl } : {}),
    ...(indexing.indexNow ? { indexNow: indexing.indexNow } : {}),
    ...(indexing.searchConsole ? { searchConsole: indexing.searchConsole } : {}),
    ...(indexing.priorityUrls ? { priorityUrls: indexing.priorityUrls } : {}),
    // Fall back to the site-wide policy so a site that states `noindex` once,
    // globally, is still protected.
    ...((env?.robots ?? site.seo?.robots) ? { robots: env?.robots ?? site.seo?.robots } : {}),
  };
}

/**
 * Adapt a `Config` to the onboarding module's own option shape.
 *
 * The same flat field map as `toIndexingConfig`, and for the same reason — utils
 * cannot import the generator. `--domain` scopes to a single `site.searchConsole`
 * entry, and a name that isn't there is an error, not an empty run.
 */
function toSearchConsoleSetup(cfg: Config, domainFilter: string | undefined): DomainSetup[] {
  const entries = cfg.site.searchConsole ?? {};
  const setups: DomainSetup[] = Object.entries(entries).map(([domain, e]) => ({
    domain,
    ...(e.delegatedOwners ? { delegatedOwners: e.delegatedOwners } : {}),
    ...(e.fullUserGroup ? { fullUserGroup: e.fullUserGroup } : {}),
  }));
  return pickOne(setups, domainFilter, (s) => s.domain, {
    flag: 'domain',
    source: 'site.searchConsole',
  });
}

/** Read a sitemap from a URL or a local path. */
const readSitemap = async (source: string): Promise<string> => {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source);
    if (!res.ok) fail(`could not fetch ${source}: ${res.status}`);
    return res.text();
  }
  if (!existsSync(source)) fail(`sitemap not found: ${source}`);
  return readFileSync(source, 'utf8');
};

/**
 * Attach the site's Google project to a token — for a **user** credential only.
 *
 * A user credential (an ADC login, or `VITOPS_GOOGLE_*`) authenticates through a
 * shared OAuth client that owns no project, so Google refuses the call outright
 * without `x-goog-user-project`. A service account already belongs to a project, and
 * pointing it at a *different* one would newly require `serviceusage.services.use`
 * there — turning a working CI credential into a 403 for no benefit. So the header
 * is sent exactly when it is needed, never as a default.
 */
function searchAuth(
  token: string,
  credential: GoogleCredential,
  cfg: Config,
  input: string,
): GoogleAuthLike {
  const project = cfg.site?.google?.project;
  // Only a user credential can be an ADC one, so only it can be missing a project.
  if (credential.kind === 'oauth') requireAdcProject(project, input);
  return project && credential.kind === 'oauth' ? { token, quotaProject: project } : token;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Tell search engines a deploy happened.
 *
 * Worth being precise about what this is, because the obvious expectation is
 * wrong: **Google has no API that requests indexing.** The Search Console button
 * is not exposed anywhere, URL Inspection is read-only, and the sitemap ping
 * endpoint was removed in 2023. So the Google half of this command resubmits the
 * sitemap and then *verifies* the outcome with `--check`; the immediate-push half
 * is IndexNow, which Google does not participate in.
 *
 * The Indexing API is deliberately absent — see `@getvitops/utils/indexing`'s
 * `gsc.ts`.
 */
async function cmdSearchNotify(argv: string[]) {
  const a = parse(argv, {
    ...SITE_OPTS,
    sitemap: { type: 'string' },
    urls: { type: 'string' },
    all: { type: 'boolean', default: false },
    dry: { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    'new-key': { type: 'boolean', default: false },
    'write-key': { type: 'string' },
    snapshot: { type: 'string', default: SNAPSHOT_PATH },
  });

  // Stands alone: generating a key is what you do *before* there is a config to
  // put it in.
  if (a.flag('new-key')) {
    const key = newKey();
    console.log(key);
    console.log(
      `\n  Add to your site config:\n    "seo": { "indexing": { "indexNow": { "key": "${key}" } } }`,
    );
    console.log(`  Then serve it at /${key}.txt — \`vitops search notify --write-key public\`.`);
    return;
  }

  const site = await siteConfig(a);
  const config = toIndexingConfig(site, a.str('site-env'));

  if (a.values['write-key'] !== undefined) {
    const key = config.indexNow?.key;
    if (!key) fail('no site.seo.indexing.indexNow.key in the config — generate one with --new-key');
    const file = join(resolve(a.str('write-key')), `${key}.txt`);
    writeOut(file, keyFileContents(key));
    console.log(`✓ IndexNow key file → ${file}`);
    console.log(`  It must be served at ${resolveKeyLocation(config) ?? `/${key}.txt`}`);
    return;
  }

  const sitemapUrl = a.opt('sitemap') ?? resolveSitemapUrl(config);
  if (!sitemapUrl)
    fail(
      'no sitemap to read — set seo.indexing.sitemapUrl or domains.canonical, or pass --sitemap',
    );

  const explicitUrls = a
    .opt('urls')
    ?.split(',')
    .map((u) => u.trim())
    .filter(Boolean);

  // The sitemap is only needed when the URL set comes from it.
  const current =
    explicitUrls?.length && !a.flag('check')
      ? []
      : (await collectEntries(sitemapUrl, readSitemap)).entries;

  const snapshotPath = a.path('snapshot');
  const p = plan({
    config: { ...config, sitemapUrl },
    current,
    previous: readSnapshot(snapshotPath),
    explicitUrls,
    all: a.flag('all'),
  });

  const keepGoing = printPlanAndDryGate({
    planText: formatPlan(p),
    // Not a failure. Running this against a `noindex` environment is a coherent
    // thing for a deploy script to do — the config said not to index it, and the
    // command honoured that. Failing the build would punish the correct setup.
    blocked: p.blocked,
    dry: a.flag('dry'),
    dryMessage: 'nothing was submitted',
  });
  if (!keepGoing) return;

  const credential = loadSearchCredential();
  let failed = false;

  // ── --check: read-only, and nothing else runs ───────────────────────────────
  if (a.flag('check')) {
    if (!p.searchConsole.siteUrl)
      fail('--check needs seo.indexing.searchConsole.siteUrl (the Search Console property)');
    if (!credential) fail(`--check needs a Search Console credential — ${CREDENTIAL_HINT}`);
    if (p.check.length === 0)
      fail('--check needs seo.indexing.priorityUrls — the pages whose indexing matters');

    const auth = searchAuth(await googleAccessToken(credential), credential, site, a.str('input'));
    console.log(`\nInspecting ${p.check.length} priority URL(s):`);
    for (const url of p.check) {
      const r = await inspectUrl(auth, p.searchConsole.siteUrl, url);
      if (r.error) {
        console.log(`  ? ${url} — ${r.error}`);
        failed = true;
      } else {
        console.log(
          `  ${r.indexed ? '✓' : '✗'} ${url} — ${r.coverageState ?? r.verdict ?? 'unknown'}`,
        );
        if (!r.indexed) failed = true;
      }
    }
    if (failed) {
      console.error('\n✖ one or more priority URLs are not indexed');
      process.exit(1);
    }
    console.log('\n✓ every priority URL is indexed');
    return;
  }

  // ── IndexNow ────────────────────────────────────────────────────────────────
  if (p.indexNow.enabled) {
    const { key, keyLocation } = p.indexNow;
    const check = await verifyKeyFile(keyLocation!, key!);
    if (!check.ok) {
      // Hard stop rather than "submit and hope": IndexNow answers 202 and then
      // discards the batch when the key doesn't verify, so submitting anyway
      // would print a success it did not earn.
      console.error(`✖ IndexNow key file check failed — ${check.reason}`);
      console.error(`  Write it with: vitops search notify --write-key <public dir>`);
      failed = true;
    } else {
      let sent = 0;
      for (const batch of p.indexNow.batches) {
        const r = await submitBatch(p.indexNow, batch);
        if (!r.ok) {
          console.error(`✖ IndexNow: ${r.message ?? r.status}`);
          failed = true;
          break;
        }
        sent += r.urls;
      }
      if (!failed) console.log(`✓ IndexNow: ${sent} URL(s) submitted`);
    }
  }

  // ── Search Console ──────────────────────────────────────────────────────────
  if (p.searchConsole.enabled) {
    if (!credential) {
      console.log(`· Search Console: skipped — no credential (${CREDENTIAL_HINT})`);
    } else {
      const auth = searchAuth(
        await googleAccessToken(credential),
        credential,
        site,
        a.str('input'),
      );
      const r = await submitSitemap(auth, p.searchConsole.siteUrl!, sitemapUrl);
      if (r.ok) console.log(`✓ Search Console: sitemap resubmitted`);
      else {
        console.error(`✖ Search Console: ${r.message}`);
        failed = true;
      }
    }
  }

  if (failed) process.exit(1);

  /*
   * The snapshot is written last, and only on success.
   *
   * Writing it eagerly would record URLs as notified that never were — and since
   * the next run diffs against it, a single transient 503 would drop those pages
   * from every future run, silently and permanently.
   */
  if (current.length > 0) {
    writeSnapshot(snapshotPath, toSnapshot(sitemapUrl, current, new Date().toISOString()));
    console.log(`  state → ${relative(process.cwd(), snapshotPath)}`);
  }
  if (p.check.length > 0)
    console.log(
      `\n  Indexing is not instant. Run \`vitops search notify --check\` in a day or two to see what Google actually did.`,
    );
}

/**
 * Onboard domains into Google Search Console as domain properties.
 *
 * Idempotent by construction: the planner decides each step from the domain's live
 * state, so a re-run of a fully-onboarded domain is all skips. `--check` reports
 * drift and exits non-zero without mutating; `--dry` prints the plan and stops.
 * Neither is offline: the state gather runs before the planner either way, so both
 * read from Cloudflare and Google and both need credentials.
 * DNS is only ever *created* — the verification TXT — never edited or removed.
 *
 * Search Console has no user/permission API, so granting a Google Group Full-User
 * access stays manual and is surfaced as a reminder, not attempted.
 */
async function cmdSearchSetup(argv: string[]) {
  const a = parse(argv, {
    ...SITE_OPTS,
    domain: { type: 'string' },
    check: { type: 'boolean', default: false },
    dry: { type: 'boolean', default: false },
  });

  const cfg = await siteConfig(a);
  const domains = toSearchConsoleSetup(cfg, a.opt('domain'));
  if (domains.length === 0)
    fail('no domains in site.searchConsole — add domains to onboard (keyed by bare hostname)');

  const cfToken = loadCloudflareToken();
  const oauth = loadGoogleOAuth();
  const project = cfg.site?.google?.project;
  const usableOauth = isOauthUsable(oauth, project);

  // A dry run that mutates nothing should not demand the credentials to mutate.
  // It cannot READ live state without them either, so it plans from "nothing is
  // done yet" and says so — which is still the complete account of what a first
  // run would do, and is what makes the plan showable before anyone has
  // provisioned anything. `--check` is different: reporting drift means
  // comparing against reality, so it keeps needing to see it.
  if (a.flag('dry') && (!cfToken || !usableOauth)) {
    const blank: DomainState = {
      zoneId: '',
      txtPresent: false,
      verified: false,
      currentOwners: [],
      propertyExists: false,
    };
    console.log(
      formatSetupPlan(planSetup({ domains }, new Map(domains.map((d) => [d.domain, blank])))),
    );
    const missing = [
      ...(cfToken ? [] : ['CLOUDFLARE_API_TOKEN (Zone:DNS:Edit + Zone:Read)']),
      ...(usableOauth
        ? []
        : oauth
          ? [`site.google.project in ${a.str('input')} (this ADC login has no project)`]
          : [
              'VITOPS_GOOGLE_CLIENT_ID / VITOPS_GOOGLE_CLIENT_SECRET / VITOPS_GOOGLE_REFRESH_TOKEN',
            ]),
    ];
    console.log(
      `\n(--dry, and no credentials set: planned from scratch rather than from live state, ` +
        `so nothing here is reported as already done.\n A real run needs ${missing.join(' and ')}.)`,
    );
    return;
  }

  if (!cfToken) fail(CLOUDFLARE_TOKEN_HINT);
  if (!oauth)
    fail(
      'set VITOPS_GOOGLE_CLIENT_ID / VITOPS_GOOGLE_CLIENT_SECRET / VITOPS_GOOGLE_REFRESH_TOKEN — a user OAuth token scoped to siteverification + webmasters — or run ' +
        '`gcloud auth application-default login` with the siteverification + webmasters + cloud-platform scopes (see --help)',
    );

  // Always a user credential here — `setup` requires one — so the site's project is
  // what makes the calls attributable. Without it a shared-client credential (a gcloud
  // ADC login) is refused outright; a credential from your own OAuth client carries its
  // project in the client id and works either way, which is why this isn't required.
  // Checked BEFORE the grant: a run that cannot succeed should spend no requests.
  requireAdcProject(project, a.str('input'));

  const token = await refreshTokenGrant(oauth);
  const auth: GoogleAuthLike = project ? { token, quotaProject: project } : token;

  // ── Observe live state per domain (the executors gather; the planner decides) ──
  const states = new Map<string, DomainState>();
  const verifyTokens = new Map<string, string>();
  const webIds = new Map<string, string>();
  for (const d of domains) {
    const zone = await findZoneId(cfToken, d.domain);
    if (!zone.ok || !zone.zoneId) fail(`${d.domain}: ${zone.message}`);

    const vt = await getVerificationToken(auth, d.domain);
    if (!vt.ok || !vt.token)
      fail(`${d.domain}: could not obtain a verification token — ${vt.message}`);
    verifyTokens.set(d.domain, vt.token);

    const txt = await listApexTxt(cfToken, zone.zoneId, d.domain);
    if (!txt.ok) fail(`${d.domain}: ${txt.message}`);

    const wr = await getWebResource(auth, d.domain);
    if (!wr.ok) fail(`${d.domain}: ${wr.message}`);
    if (wr.id) webIds.set(d.domain, wr.id);

    const site = await getSite(auth, siteUrlFor(d.domain));
    if (!site.ok) fail(`${d.domain}: ${site.message}`);

    states.set(d.domain, {
      zoneId: zone.zoneId,
      txtPresent: txt.contents.includes(vt.token),
      verified: wr.exists,
      currentOwners: wr.owners,
      propertyExists: site.exists,
    });
  }

  const p = planSetup({ domains }, states);
  console.log(formatSetupPlan(p));

  if (a.flag('check')) {
    if (hasDrift(p)) {
      console.error('\n✖ drift — one or more domains are not fully onboarded');
      process.exit(1);
    }
    console.log('\n✓ every domain is onboarded');
    return;
  }
  if (a.flag('dry')) {
    console.log('\n(--dry: nothing was changed)');
    return;
  }

  // ── Execute ─────────────────────────────────────────────────────────────────
  const results: DomainResult[] = [];
  let failed = false;
  const delays = backoffSchedule();

  for (const d of domains) {
    const dp = p.domains.find((x) => x.domain === d.domain)!;
    const state = states.get(d.domain)!;
    const result: DomainResult = {
      domain: d.domain,
      txt: '—',
      verified: '—',
      property: '—',
      reminders: dp.reminders,
    };

    // 1. Ensure the apex TXT record (create only).
    if (dp.txt.action === 'skip') result.txt = 'present';
    else {
      const r = await createApexTxt(cfToken, state.zoneId!, d.domain, verifyTokens.get(d.domain)!);
      if (!r.ok) {
        console.error(`✖ ${d.domain} TXT: ${r.message}`);
        result.txt = 'failed';
        failed = true;
        results.push(result);
        continue;
      }
      result.txt = 'created';
    }

    // 2. Verify ownership, retrying with backoff while DNS propagates.
    let verified = state.verified;
    if (verified) result.verified = 'yes';
    else {
      for (let attempt = 0; attempt < delays.length; attempt++) {
        const v = await verifyWebResource(auth, d.domain);
        if (v.ok) {
          verified = true;
          if (v.id) webIds.set(d.domain, v.id);
          // Verification is what CREATES the web resource, so this response is the
          // first sight of its owner list — and it contains the verifying account.
          // The pre-verification observation could only report `[]`. Dropping this
          // makes the union below a bare `ownersToAdd`, and the PUT then removes
          // the very account that just proved ownership.
          state.currentOwners = v.owners;
          break;
        }
        if (attempt < delays.length - 1) {
          const wait = delays[attempt]!;
          console.log(
            `  … ${d.domain}: not verified yet (attempt ${attempt + 1}/${delays.length}); retrying in ${wait / 1000}s`,
          );
          await sleep(wait);
        }
      }
      // PENDING, not failed: propagation is slow, not broken. Re-run later.
      result.verified = verified ? 'yes' : 'pending';
    }
    if (!verified) {
      results.push(result);
      continue;
    }

    // 3. Add the Search Console property.
    if (dp.property.action === 'skip') result.property = 'present';
    else {
      const r = await addSite(auth, dp.siteUrl);
      if (!r.ok) {
        console.error(`✖ ${d.domain} property: ${r.message}`);
        result.property = 'failed';
        failed = true;
      } else result.property = 'added';
    }

    // 4. Add delegated owners to the verified web resource (additive union).
    if (dp.owners.action === 'update' && dp.ownersToAdd.length) {
      const id = webIds.get(d.domain);
      if (!id) {
        console.error(`✖ ${d.domain} owners: no web-resource id (verify may be too fresh)`);
        failed = true;
      } else {
        const r = await updateOwners(
          token,
          id,
          d.domain,
          ownerUnion(state.currentOwners, dp.ownersToAdd),
        );
        if (!r.ok) {
          console.error(`✖ ${d.domain} owners: ${r.message}`);
          failed = true;
        } else console.log(`✓ ${d.domain}: added ${dp.ownersToAdd.length} owner(s)`);
      }
    }

    results.push(result);
  }

  console.log(`\n${formatSummary(results)}`);
  if (failed) process.exit(1);
}

export async function cmdSearch(argv: string[]) {
  const [sub, ...rest] = argv;
  switch (sub) {
    case 'setup':
      return cmdSearchSetup(rest);
    case 'notify':
      return cmdSearchNotify(rest);
    case undefined:
    case '-h':
    case '--help':
      console.log(SEARCH_HELP);
      return;
    default:
      fail(`unknown "search" subcommand "${sub}" (expected: setup | notify). Try: vitops --help`);
  }
}
