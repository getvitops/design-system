// LIVE: Zoho Desk. OAuth2 refresh-token flow (access token ~1h) → GET /tickets.
// Skips gracefully when app creds / a per-org connection aren't configured.
// Zoho access tokens rotate every call; the refresh token normally does not — if
// a rotated refresh token is ever returned, persist it (sealed) in the sync step.
import type { HelpdeskProvider, RequestProvider, SubmittedRequest, SyncCtx, TicketRow } from './types.ts';
import { seedFrom } from './types.ts';

const TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';
const TICKETS_URL = 'https://desk.zoho.com/api/v1/tickets?limit=100&sortBy=-modifiedTime';

async function accessTokenFrom(ctx: SyncCtx): Promise<string | null> {
  const { env, secret } = ctx;
  const refreshToken = secret?.refreshToken;
  if (!env.ZOHO_CLIENT_ID || !env.ZOHO_CLIENT_SECRET || !refreshToken) return null;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: env.ZOHO_CLIENT_ID,
    client_secret: env.ZOHO_CLIENT_SECRET,
    refresh_token: refreshToken,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`zoho token ${res.status}`);
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

interface ZohoTicket {
  id: string;
  subject?: string;
  status?: string;
  priority?: string;
  assignee?: { name?: string };
  createdTime?: string;
  modifiedTime?: string;
}

export const zoho: HelpdeskProvider = {
  id: 'zoho',
  capability: 'helpdesk',
  live: true,
  async fetchTickets(ctx: SyncCtx): Promise<TicketRow[]> {
    const orgId = ctx.externalOrgId;
    if (!orgId) return [];
    const token = await accessTokenFrom(ctx);
    if (!token) return [];

    const res = await fetch(TICKETS_URL, {
      headers: { orgId, Authorization: `Zoho-oauthtoken ${token}` },
    });
    if (res.status === 204) return [];
    if (!res.ok) throw new Error(`zoho tickets ${res.status}`);
    const json = (await res.json()) as { data?: ZohoTicket[] };
    return (json.data ?? []).map((t) => ({
      externalId: String(t.id),
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      assignee: t.assignee?.name,
      remoteCreatedAt: t.createdTime,
      remoteModifiedAt: t.modifiedTime,
    }));
  },
};

// WRITE adapter: create a Zoho Desk ticket from a submitted request. Falls back
// to a deterministic stub ref when Zoho isn't configured / departmentId missing,
// so the ingestion round-trip works in dev without live creds.
export const zohoTicketWrite: RequestProvider = {
  id: 'zoho-ticket',
  handles: ['ticket'],
  live: true,
  async submit(ctx: SyncCtx, req: SubmittedRequest): Promise<{ externalRef: string }> {
    const p = req.payload as { subject?: string; description?: string; departmentId?: string; priority?: string };
    const token = await accessTokenFrom(ctx);
    const departmentId = p.departmentId ?? (ctx.secret?.departmentId as string | undefined);
    if (!ctx.externalOrgId || !token || !departmentId) {
      // Not fully configured → stub (demo path).
      return { externalRef: `ZD-STUB-${Math.floor(seedFrom('zw', req.id) * 100000)}` };
    }
    const res = await fetch('https://desk.zoho.com/api/v1/tickets', {
      method: 'POST',
      headers: {
        orgId: ctx.externalOrgId,
        Authorization: `Zoho-oauthtoken ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        subject: p.subject ?? 'Portal request',
        description: p.description ?? '',
        departmentId,
        priority: p.priority ?? 'Medium',
      }),
    });
    if (!res.ok) throw new Error(`zoho createTicket ${res.status}`);
    const json = (await res.json()) as { id?: string | number };
    return { externalRef: String(json.id ?? '') };
  },
};
