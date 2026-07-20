// Deterministic mock adapters (GA4, Clarity, Matomo, licensing, SCIM/JML). Same
// interface as the live ones; rows are seeded off site + date so the dashboard
// looks alive and stable across reloads. Swap any of these for a live adapter
// without touching the sync worker or UI.
import type {
  AnalyticsBundle,
  AnalyticsProvider,
  DateRange,
  HelpdeskProvider,
  LicenseRow,
  LicensingProvider,
  ProvisioningProvider,
  ProvisioningRow,
  SiteRef,
  SyncCtx,
} from './types.ts';
import { seedFrom } from './types.ts';

function eachDay(range: DateRange): string[] {
  const out: string[] = [];
  const d = new Date(`${range.from}T00:00:00Z`);
  const end = new Date(`${range.to}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function mockBundle(providerId: string, site: SiteRef, range: DateRange): AnalyticsBundle {
  const bundle: AnalyticsBundle = { analytics: [], traffic: [], rum: [] };
  for (const date of eachDay(range)) {
    const r = seedFrom(providerId, site.id, date);
    const visits = Math.round(300 + r * 4000);
    const pageViews = Math.round(visits * (1.8 + r));
    const human = Math.round(visits * (0.55 + r * 0.2));
    const ai = Math.round(visits * (0.1 + r * 0.15)); // AI/LLM crawlers
    const bot = Math.max(0, visits - human - ai);
    bundle.analytics.push({
      date,
      provider: providerId,
      requests: pageViews + bot * 3,
      pageViews,
      visits,
      conversions: Math.round(visits * (0.01 + r * 0.03)),
      formSubmissions: Math.round(visits * (0.02 + r * 0.02)),
    });
    bundle.traffic.push({
      bucketTs: `${date}T00:00:00Z`,
      human,
      ai,
      bot,
      latencyP50Ms: Math.round(40 + r * 60),
      latencyP95Ms: Math.round(180 + r * 320),
      failures: Math.round(bot * r * 0.05),
    });
    bundle.rum.push({
      date,
      lcpMs: Math.round(1200 + r * 1600),
      inpMs: Math.round(80 + r * 220),
      clsX1000: Math.round(r * 120),
      ttfbMs: Math.round(120 + r * 300),
      sampleCount: visits,
    });
  }
  return bundle;
}

function analyticsMock(id: string): AnalyticsProvider {
  return {
    id,
    capability: 'analytics',
    live: false,
    fetchAnalytics: (_ctx: SyncCtx, site: SiteRef, range: DateRange) =>
      Promise.resolve(mockBundle(id, site, range)),
  };
}

export const ga4: AnalyticsProvider = analyticsMock('ga4');
export const matomo: AnalyticsProvider = analyticsMock('matomo');
// Clarity emphasises human/AI/bot split; the sync worker self-throttles it
// (≤ a few pulls/day) to respect the real 10 req/project/day cap.
export const clarity: AnalyticsProvider = analyticsMock('clarity');

export const licensingMock: LicensingProvider = {
  id: 'licensing',
  capability: 'licensing',
  live: false,
  fetchLicenses(ctx: SyncCtx): Promise<LicenseRow[]> {
    const org = ctx.externalOrgId ?? 'org';
    const products = ['Microsoft 365', 'Adobe CC', 'Slack', 'Zoom'];
    const rows: LicenseRow[] = products.map((product, i) => {
      const r = seedFrom('licensing', org, product);
      const seats = 10 + Math.round(r * 90);
      return {
        product,
        seats,
        used: Math.round(seats * (0.4 + r * 0.5)),
        status: r > 0.9 ? 'expiring' : 'active',
        renewalDate: `2026-${String(3 + i).padStart(2, '0')}-15`,
      };
    });
    return Promise.resolve(rows);
  },
};

export const scimMock: ProvisioningProvider = {
  id: 'scim',
  capability: 'scim',
  live: false,
  fetchProvisioning(ctx: SyncCtx): Promise<ProvisioningRow[]> {
    const org = ctx.externalOrgId ?? 'org';
    const ops: ProvisioningRow['op'][] = ['join', 'move', 'leave'];
    const rows: ProvisioningRow[] = Array.from({ length: 6 }, (_, i) => {
      const r = seedFrom('scim', org, String(i));
      return {
        op: ops[i % ops.length] as ProvisioningRow['op'],
        subject: `user${i}@${org}.example`,
        system: ['Okta', 'Google Workspace', 'GitHub'][i % 3],
        status: r > 0.7 ? 'completed' : 'pending',
        receivedAt: `2026-07-${String(10 + i).padStart(2, '0')}T09:00:00Z`,
      };
    });
    return Promise.resolve(rows);
  },
};

// Mock helpdesk fallback when Zoho isn't configured (keeps the dashboard alive).
export const helpdeskMock: HelpdeskProvider = {
  id: 'helpdesk-mock',
  capability: 'helpdesk',
  live: false,
  fetchTickets(ctx: SyncCtx) {
    const org = ctx.externalOrgId ?? 'org';
    const statuses = ['Open', 'On Hold', 'Closed'];
    const priorities = ['High', 'Medium', 'Low'];
    return Promise.resolve(
      Array.from({ length: 8 }, (_, i) => {
        const r = seedFrom('ticket', org, String(i));
        return {
          externalId: `ZD-${1000 + i}`,
          subject: ['Login issue', 'Billing question', 'Feature request', 'Bug report'][i % 4],
          status: statuses[Math.floor(r * statuses.length)],
          priority: priorities[Math.floor(r * priorities.length)],
          assignee: ['Alex', 'Sam', 'Jordan'][i % 3],
          remoteCreatedAt: `2026-07-${String(1 + i).padStart(2, '0')}T12:00:00Z`,
          remoteModifiedAt: `2026-07-${String(10 + i).padStart(2, '0')}T12:00:00Z`,
        };
      }),
    );
  },
};
