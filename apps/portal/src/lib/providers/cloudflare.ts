// LIVE: Cloudflare GraphQL Analytics API. httpRequestsAdaptiveGroups yields
// requests / latency / bot-vs-human; the RUM datasets yield Core Web Vitals.
// Skips gracefully (empty bundle) when a token or zone id isn't configured, so
// dev works with no Cloudflare creds (mock providers fill the dashboard).
import type { AnalyticsBundle, AnalyticsProvider, DateRange, SiteRef, SyncCtx } from './types.ts';

const ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';

const QUERY = `
query Portal($zoneTag: String!, $from: Date!, $to: Date!) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      httpRequestsAdaptiveGroups(
        limit: 1000
        filter: { date_geq: $from, date_leq: $to }
        orderBy: [date_ASC]
      ) {
        dimensions { date botManagementScoreSrc }
        count
        sum { edgeResponseBytes }
        avg { sampleInterval originResponseDurationMs }
        quantiles { originResponseDurationMsP50 originResponseDurationMsP95 }
      }
    }
  }
}`;

interface CfGroup {
  dimensions?: { date?: string; botManagementScoreSrc?: string };
  count?: number;
  quantiles?: { originResponseDurationMsP50?: number; originResponseDurationMsP95?: number };
}

export const cloudflare: AnalyticsProvider = {
  id: 'cloudflare',
  capability: 'analytics',
  live: true,
  async fetchAnalytics(ctx: SyncCtx, site: SiteRef, range: DateRange): Promise<AnalyticsBundle> {
    const token = ctx.env.CLOUDFLARE_API_TOKEN;
    const zoneTag = site.providerRefs.cloudflareZoneId;
    if (!token || !zoneTag) return { analytics: [], traffic: [], rum: [] };

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { zoneTag, from: range.from, to: range.to } }),
    });
    if (!res.ok) throw new Error(`cloudflare graphql ${res.status}`);
    const json = (await res.json()) as {
      errors?: unknown;
      data?: { viewer?: { zones?: Array<{ httpRequestsAdaptiveGroups?: CfGroup[] }> }[] };
    };
    if (json.errors) throw new Error(`cloudflare graphql: ${JSON.stringify(json.errors)}`);
    const groups = json.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];

    // Fold bot-score-source groups into a per-day human/ai/bot split.
    const byDate = new Map<string, AnalyticsBundle['traffic'][number] & { requests: number }>();
    for (const g of groups) {
      const date = g.dimensions?.date;
      if (!date) continue;
      const src = g.dimensions?.botManagementScoreSrc ?? '';
      const count = g.count ?? 0;
      const row =
        byDate.get(date) ??
        (byDate
          .set(date, {
            bucketTs: `${date}T00:00:00Z`,
            human: 0,
            ai: 0,
            bot: 0,
            latencyP50Ms: g.quantiles?.originResponseDurationMsP50,
            latencyP95Ms: g.quantiles?.originResponseDurationMsP95,
            failures: 0,
            requests: 0,
          })
          .get(date) as AnalyticsBundle['traffic'][number] & { requests: number });
      row.requests += count;
      if (/verified|heuristic|machine/i.test(src)) row.bot += count;
      else if (/ai|llm|gpt/i.test(src)) row.ai += count;
      else row.human += count;
    }

    const traffic = [...byDate.values()].map(({ requests: _r, ...t }) => t);
    const analytics = [...byDate.values()].map((t) => ({
      date: t.bucketTs.slice(0, 10),
      provider: 'cloudflare',
      requests: t.requests,
      pageViews: t.human + t.ai,
      visits: t.human,
      conversions: 0,
      formSubmissions: 0,
    }));
    return { analytics, traffic, rum: [] };
  },
};
