// Provider registry: id → adapter. The sync worker looks providers up by the
// `provider` column on each provider_connections row.
import { cloudflare } from './cloudflare.ts';
import { clarity, ga4, helpdeskMock, licensingMock, matomo, scimMock } from './mocks.ts';
import type { Provider } from './types.ts';
import { zoho } from './zoho.ts';

export const PROVIDERS = {
  // analytics
  cloudflare, // live
  ga4, // mock
  matomo, // mock
  clarity, // mock (self-throttled)
  // helpdesk
  zoho, // live
  'helpdesk-mock': helpdeskMock, // mock fallback
  // licensing / provisioning
  licensing: licensingMock, // mock
  scim: scimMock, // mock
} satisfies Record<string, Provider>;

export type ProviderId = keyof typeof PROVIDERS;

export function getProvider(id: string): Provider | undefined {
  return (PROVIDERS as Record<string, Provider>)[id];
}
