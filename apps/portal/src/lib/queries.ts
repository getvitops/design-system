// Read helpers for the dashboard/module pages. EVERY function takes the
// request-scoped runner (locals.scoped) so all reads run as the `authenticated`
// role under RLS — never the owner client. Data volumes are small (≈14 days ×
// sites), so aggregation is done in JS for clarity.
import { asc, desc, eq, inArray } from 'drizzle-orm';
import {
  analyticsDaily,
  licenses,
  provisioningOperations,
  requests,
  rumMetrics,
  sites,
  tickets,
  trafficEvents,
} from './db/schema/index.ts';
import type { ScopedTx } from './db/scope.ts';

export type Scoped = <T>(fn: (tx: ScopedTx) => Promise<T>) => Promise<T>;

export const listSites = (scoped: Scoped) =>
  scoped((tx) => tx.select().from(sites).orderBy(asc(sites.name)));

export const trafficSeries = (scoped: Scoped) =>
  scoped((tx) => tx.select().from(trafficEvents).orderBy(asc(trafficEvents.bucketTs)));

export const analyticsSeries = (scoped: Scoped) =>
  scoped((tx) => tx.select().from(analyticsDaily).orderBy(asc(analyticsDaily.date)));

export const rumSeries = (scoped: Scoped) =>
  scoped((tx) => tx.select().from(rumMetrics).orderBy(asc(rumMetrics.date)));

export const listTickets = (scoped: Scoped) =>
  scoped((tx) => tx.select().from(tickets).orderBy(desc(tickets.remoteModifiedAt)));

export const listLicenses = (scoped: Scoped) =>
  scoped((tx) => tx.select().from(licenses).orderBy(asc(licenses.product)));

export const listProvisioning = (scoped: Scoped) =>
  scoped((tx) => tx.select().from(provisioningOperations).orderBy(desc(provisioningOperations.receivedAt)));

/** Submitted requests from the ingestion outbox, optionally filtered by type. */
export const listRequests = (scoped: Scoped, types?: string[]) =>
  scoped((tx) => {
    const base = tx.select().from(requests);
    const q = types?.length ? base.where(inArray(requests.type, types)) : base;
    return q.orderBy(desc(requests.createdAt));
  });

export interface Summary {
  visitors: { human: number; ai: number; bot: number };
  visits: number;
  conversions: number;
  formSubmissions: number;
  failures: number;
  avgLatencyP95: number | null;
  openTickets: number;
  siteCount: number;
}

export async function dashboardSummary(scoped: Scoped): Promise<Summary> {
  return scoped(async (tx) => {
    const traffic = await tx.select().from(trafficEvents);
    const analytics = await tx.select().from(analyticsDaily);
    const openTix = await tx.select({ status: tickets.status }).from(tickets);
    const siteRows = await tx.select({ id: sites.id }).from(sites);

    const human = sum(traffic, (t) => t.human);
    const ai = sum(traffic, (t) => t.ai);
    const bot = sum(traffic, (t) => t.bot);
    const failures = sum(traffic, (t) => t.failures);
    const p95s = traffic.map((t) => t.latencyP95Ms).filter((n): n is number => n != null);

    return {
      visitors: { human, ai, bot },
      visits: sum(analytics, (a) => a.visits),
      conversions: sum(analytics, (a) => a.conversions),
      formSubmissions: sum(analytics, (a) => a.formSubmissions),
      failures,
      avgLatencyP95: p95s.length ? Math.round(p95s.reduce((x, y) => x + y, 0) / p95s.length) : null,
      openTickets: openTix.filter((t) => (t.status ?? '').toLowerCase() !== 'closed').length,
      siteCount: siteRows.length,
    };
  });
}

function sum<T>(rows: T[], pick: (r: T) => number): number {
  return rows.reduce((acc, r) => acc + Number(pick(r) ?? 0), 0);
}
