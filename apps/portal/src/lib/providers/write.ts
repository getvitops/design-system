// Write-adapter registry: request type → the provider that forwards it to the
// underlying vendor. Mirrors the read registry.
import type { RequestProvider, SubmittedRequest, SyncCtx } from './types.ts';
import { zohoTicketWrite } from './zoho.ts';

// JML / PTO / HRIS: stub for the spike (real SCIM/IdP/HRIS wiring is out of scope).
const jmlHrisStub: RequestProvider = {
  id: 'jml-hris-stub',
  handles: ['jml', 'pto', 'hris'],
  live: false,
  submit(_ctx: SyncCtx, req: SubmittedRequest): Promise<{ externalRef: string }> {
    // In production: call the IdP/SCIM endpoint or the HRIS API here.
    console.log(`[dispatch] stub-forwarding ${req.type} for org ${req.organizationId}`, req.payload);
    return Promise.resolve({ externalRef: `EXT-${req.type.toUpperCase()}-${req.id.slice(0, 8)}` });
  },
};

const WRITE_PROVIDERS: RequestProvider[] = [zohoTicketWrite, jmlHrisStub];

export function getWriteProvider(type: string): RequestProvider | undefined {
  return WRITE_PROVIDERS.find((p) => p.handles.includes(type));
}

/** Which provider_connections row (if any) supplies creds for a request type. */
export function connectionProviderFor(type: string): string | undefined {
  return type === 'ticket' ? 'zoho' : undefined;
}
