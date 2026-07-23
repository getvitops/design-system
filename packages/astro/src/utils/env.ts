import { SITE_ENV } from 'astro:env/server';
import siteConfig from '#site-config';
import type { EnvironmentConfig } from '@getvitops/utils';

export const envConfig = (siteConfig as any).environments[SITE_ENV] as EnvironmentConfig;
export const analyticsEnabled: boolean = envConfig?.analytics === true;
export const robotsDirective: string = envConfig?.robots || 'index, follow';
export const siteVariant: string | undefined = envConfig?.variant;
export { SITE_ENV };

export { sitePlan, isProPlan, hasFeature } from './plan-features';
export type { PlanTier, Feature } from './plan-features';
