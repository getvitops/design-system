/**
 * `vitops crm` — the two things `site.crm` needs a human-in-the-loop for.
 *
 * `check` is the drift guard, and the reason this command exists at all:
 * HubSpot *rejects* a submission naming an unrecognised property, and Bigin
 * silently *ignores* one — so a typo'd `fieldMap`/`trackingFields` entry is
 * invisible in one CRM and fatal in the other, and nothing short of fetching
 * the live field list can tell you which. `setup` creates the missing
 * properties HubSpot's API allows creating; Bigin has no such endpoint, so it
 * always resolves to a manual reminder, matching how `ads setup` handles a
 * platform with no verification API. Jobber currently renders `fieldMap`/
 * `trackingFields` values as note-text lines rather than app-configured
 * custom fields (see `@getvitops/utils/crm`'s `jobber.ts` docblock for why
 * that surface is deferred), so there is nothing live to check yet — both
 * subcommands say so rather than guessing at an unverified API.
 *
 * Modelled on `commands/ads.ts`: read-and-create only, never destructive.
 */
import {
  zohoAccountsHost,
  zohoApiHost,
  type CrmConfig,
  type CrmProvider,
} from '@getvitops/utils/crm';
import { parse } from '../args.ts';
import { loadHubSpotToken, loadZohoOAuth } from '../credentials.ts';
import { CRM_HELP } from '../help.ts';
import { fail, siteConfig, SITE_OPTS } from './shared.ts';

/** Every CRM property name this site's config asserts exists, from both maps —
 * `fieldMap`/`trackingFields` values are property names, not the submitted
 * field names on the left. */
function configuredProperties(crm: CrmConfig): string[] {
  return [...Object.values(crm.fieldMap ?? {}), ...Object.values(crm.trackingFields ?? {})];
}

async function hubspotContactProperties(accessToken: string): Promise<Set<string>> {
  const res = await fetch('https://api.hubapi.com/crm/v3/properties/contacts', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) fail(`HubSpot properties lookup failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { results?: { name: string }[] };
  return new Set((json.results ?? []).map((p) => p.name));
}

async function biginContactFields(
  oauth: { clientId: string; clientSecret: string; refreshToken: string },
  dataCenter: string,
): Promise<Set<string>> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: oauth.clientId,
    client_secret: oauth.clientSecret,
    refresh_token: oauth.refreshToken,
  });
  const tokenRes = await fetch(`https://${zohoAccountsHost(dataCenter)}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!tokenRes.ok)
    fail(`Zoho token exchange failed (${tokenRes.status}): ${await tokenRes.text()}`);
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) fail('Zoho token exchange returned no access_token');

  const res = await fetch(
    `https://${zohoApiHost(dataCenter)}/bigin/v2/settings/fields?module=Contacts`,
    { headers: { authorization: `Zoho-oauthtoken ${access_token}` } },
  );
  if (!res.ok) fail(`Bigin fields lookup failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { fields?: { api_name: string }[] };
  return new Set((json.fields ?? []).map((f) => f.api_name));
}

/** What each provider's `check` needs to say when it doesn't fail outright.
 * Kept as a table rather than an `if/else if` chain so a fourth provider is
 * a missing entry (a type error), not a silently-wrong branch. */
const CHECK_NOUNS: Record<CrmProvider, string> = {
  hubspot: 'properties',
  bigin: 'fields',
  jobber: 'fields',
};
const CHECK_REJECTION: Record<CrmProvider, string> = {
  hubspot: 'HubSpot will reject the whole submission',
  bigin: 'Bigin will silently drop this value',
  jobber: 'Jobber will silently drop this value',
};

/**
 * Fetch the live field/property vocabulary and report every `fieldMap`/
 * `trackingFields` target that doesn't exist there.
 */
async function cmdCrmCheck(argv: string[]) {
  const a = parse(argv, SITE_OPTS);
  const cfg = await siteConfig(a);
  const crm = cfg.site.crm;
  if (!crm) {
    console.log('· no site.crm — nothing to check');
    return;
  }
  if (crm.enabled === false) {
    console.log('· site.crm.enabled is false — nothing to check');
    return;
  }

  const wanted = configuredProperties(crm);
  if (wanted.length === 0) {
    console.log('· site.crm has no fieldMap/trackingFields entries — nothing to check');
    return;
  }

  if (crm.provider === 'jobber') {
    console.log(
      '· no live check for Jobber yet — fieldMap/trackingFields values currently render as ' +
        'note-text lines, not app-configured custom fields, so nothing there can silently ' +
        'mismatch (see @getvitops/utils/crm jobber.ts docblock).',
    );
    return;
  }

  let known: Set<string>;
  if (crm.provider === 'hubspot') {
    const token = loadHubSpotToken();
    if (!token) fail('set VITOPS_HUBSPOT_ACCESS_TOKEN to check the live property list');
    known = await hubspotContactProperties(token);
  } else {
    const oauth = loadZohoOAuth();
    if (!oauth)
      fail(
        'set VITOPS_ZOHO_CLIENT_ID / VITOPS_ZOHO_CLIENT_SECRET / VITOPS_ZOHO_REFRESH_TOKEN to check the live field list',
      );
    known = await biginContactFields(oauth, crm.bigin!.dataCenter);
  }

  const missing = wanted.filter((p) => !known.has(p));
  if (missing.length === 0) {
    console.log(`✓ ${wanted.length} mapped ${CHECK_NOUNS[crm.provider]} exist`);
    return;
  }
  for (const p of missing)
    console.error(
      `✖ "${p}" is not a ${crm.provider === 'hubspot' ? 'HubSpot contact property' : 'Bigin Contacts field'} — ${CHECK_REJECTION[crm.provider]}`,
    );
  process.exit(1);
}

/**
 * Create the HubSpot properties `fieldMap`/`trackingFields` name but don't
 * exist yet. Bigin has no property-creation API and Jobber's app-configured
 * custom fields aren't wired up yet (see the module docblock) — both resolve
 * to `blocked`/a manual reminder, matching `ads setup`'s handling of a
 * platform with no verification API.
 */
async function cmdCrmSetup(argv: string[]) {
  const a = parse(argv, { ...SITE_OPTS, dry: { type: 'boolean', default: false } });
  const cfg = await siteConfig(a);
  const crm = cfg.site.crm;
  if (!crm) fail('no site.crm configured — nothing to set up');

  const wanted = configuredProperties(crm);

  if (crm.provider === 'jobber') {
    console.log(
      '· Jobber app-configured custom fields are not wired up yet — fieldMap/trackingFields ' +
        'values render as note-text lines instead, which need no setup. If you do want them as ' +
        "real Jobber custom fields, create them manually in Jobber's Developer Center first.",
    );
    return;
  }

  if (crm.provider === 'bigin') {
    if (wanted.length === 0) {
      console.log('· no fieldMap/trackingFields entries to check against Bigin');
      return;
    }
    console.log(
      `? Bigin has no API to create Contacts fields. Create these manually in Zoho Bigin's ` +
        `field editor, then re-run \`vitops crm check\`:\n` +
        wanted.map((p) => `    - ${p}`).join('\n'),
    );
    return;
  }

  const token = loadHubSpotToken();
  if (!token) fail('set VITOPS_HUBSPOT_ACCESS_TOKEN to create HubSpot properties');
  const known = await hubspotContactProperties(token);
  const missing = wanted.filter((p) => !known.has(p));

  if (missing.length === 0) {
    console.log('✓ every mapped property already exists');
    return;
  }

  if (a.flag('dry')) {
    console.log(
      `would create ${missing.length} HubSpot contact propert${missing.length === 1 ? 'y' : 'ies'}:`,
    );
    for (const p of missing) console.log(`  + ${p}`);
    return;
  }

  for (const p of missing) {
    const res = await fetch('https://api.hubapi.com/crm/v3/properties/contacts', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: p,
        label: p,
        type: 'string',
        fieldType: 'text',
        groupName: 'contactinformation',
      }),
    });
    if (!res.ok) {
      console.error(`✖ ${p}: ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    console.log(`✓ created ${p}`);
  }
}

export async function cmdCrm(argv: string[]) {
  const [sub, ...rest] = argv;
  switch (sub) {
    case 'check':
      return cmdCrmCheck(rest);
    case 'setup':
      return cmdCrmSetup(rest);
    case undefined:
    case '-h':
    case '--help':
      console.log(CRM_HELP);
      return;
    default:
      fail(`unknown "crm" subcommand "${sub}" (expected: check | setup). Try: vitops --help`);
  }
}
