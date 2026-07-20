// Plan → capability gating. The SINGLE source of truth consulted by the server
// middleware (route guards), API/actions, the sync worker (skip work an org
// can't see), and the UI nav. Add a capability here and every layer honors it.

export type Plan = 'starter' | 'growth' | 'enterprise';
export type Capability = 'analytics' | 'helpdesk' | 'licensing' | 'scim';

export const PLANS: readonly Plan[] = ['starter', 'growth', 'enterprise'];

export const PLAN_CAPABILITIES: Record<Plan, ReadonlySet<Capability>> = {
  starter: new Set(['analytics']),
  growth: new Set(['analytics', 'helpdesk']),
  enterprise: new Set(['analytics', 'helpdesk', 'licensing', 'scim']),
};

export function capabilitiesFor(plan: Plan | string | undefined): ReadonlySet<Capability> {
  return PLAN_CAPABILITIES[(plan as Plan) ?? 'starter'] ?? PLAN_CAPABILITIES.starter;
}

export function hasCapability(plan: Plan | string | undefined, cap: Capability): boolean {
  return capabilitiesFor(plan).has(cap);
}

/** Route-prefix → capability required to enter it (enforced in middleware). */
export const ROUTE_CAPABILITY: Record<string, Capability> = {
  '/analytics': 'analytics',
  '/helpdesk': 'helpdesk',
  '/licensing': 'licensing',
  '/provisioning': 'scim',
};

export function requiredCapabilityFor(pathname: string): Capability | undefined {
  const match = Object.keys(ROUTE_CAPABILITY).find(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  return match ? ROUTE_CAPABILITY[match] : undefined;
}
