import { SITE_PLAN } from 'astro:env/server';

export type PlanTier = 'free' | 'pro';
export type Feature = 'contact-form' | 'conversion-tracking' | 'legal-docs' | 'ab-testing';

const PLAN_FEATURES: Record<PlanTier, readonly Feature[]> = {
  free: ['contact-form'],
  pro: ['contact-form', 'conversion-tracking', 'legal-docs', 'ab-testing'],
};

export const sitePlan: PlanTier = SITE_PLAN === 'pro' ? 'pro' : 'free';
export const isProPlan: boolean = sitePlan === 'pro';

export function hasFeature(feature: Feature): boolean {
  return (PLAN_FEATURES[sitePlan] as readonly string[]).includes(feature);
}
