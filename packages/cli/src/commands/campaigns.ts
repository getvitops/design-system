/**
 * `vitops campaigns` — the drift guard for `site.campaigns`.
 *
 * `check` fetches the account's live lists and reports every configured `listKey`/`listId` that
 * does not exist there. A subscribe to a missing list is rejected (Zoho answers 200 with an error
 * body) or misfiled, and the config cannot say which, so only asking the provider can. This is
 * what `vitops crm check` is for the CRM. Read-only, and there is no `setup`: neither provider
 * is asked to create lists, because a list is a marketing decision, not a build step.
 */
import {
  fetchSendFoxLists,
  fetchZohoCampaignsLists,
  missingLists,
  type LiveList,
} from '@getvitops/utils/campaigns';
import { parse } from '../args.ts';
import { loadSendFoxToken, loadZohoCampaignsOAuth } from '../credentials.ts';
import { CAMPAIGNS_HELP } from '../help.ts';
import { fail, siteConfig, SITE_OPTS } from './shared.ts';

async function cmdCampaignsCheck(argv: string[]) {
  const a = parse(argv, SITE_OPTS);
  const cfg = await siteConfig(a);
  const campaigns = cfg.site.campaigns;
  if (!campaigns) {
    console.log('· no site.campaigns — nothing to check');
    return;
  }
  if (campaigns.enabled === false) {
    console.log('· site.campaigns.enabled is false — nothing to check');
    return;
  }
  if (Object.keys(campaigns.lists).length === 0) {
    console.log('· site.campaigns has no lists — nothing to check');
    return;
  }

  let live: LiveList[];
  try {
    if (campaigns.provider === 'sendfox') {
      const accessToken = loadSendFoxToken();
      if (!accessToken) fail('set VITOPS_SENDFOX_TOKEN to check the live SendFox lists');
      live = await fetchSendFoxLists({ accessToken });
    } else {
      const oauth = loadZohoCampaignsOAuth();
      if (!oauth)
        fail(
          'set VITOPS_ZOHO_CAMPAIGNS_CLIENT_ID / VITOPS_ZOHO_CAMPAIGNS_CLIENT_SECRET / VITOPS_ZOHO_CAMPAIGNS_REFRESH_TOKEN to check the live Zoho Campaigns lists',
        );
      if (!campaigns.zohoCampaigns)
        fail(
          'site.campaigns.provider is "zoho-campaigns" but site.campaigns.zohoCampaigns is missing',
        );
      live = await fetchZohoCampaignsLists(oauth, campaigns.zohoCampaigns.dataCenter);
    }
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }

  const problems = missingLists(campaigns, live);
  const total = Object.keys(campaigns.lists).length;
  if (problems.length === 0) {
    console.log(`✓ ${total} configured list${total === 1 ? '' : 's'} exist`);
    return;
  }
  for (const p of problems) console.error(`✖ ${p.message}`);
  process.exit(1);
}

export async function cmdCampaigns(argv: string[]) {
  const [sub, ...rest] = argv;
  switch (sub) {
    case 'check':
      return cmdCampaignsCheck(rest);
    case undefined:
    case '-h':
    case '--help':
      console.log(CAMPAIGNS_HELP);
      return;
    default:
      fail(`unknown "campaigns" subcommand "${sub}" (expected: check). Try: vitops --help`);
  }
}
