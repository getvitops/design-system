/**
 * The onboarding sequence: which projections a new client fills in, in what order.
 *
 * A step lists projection ids, not paths, so the arrangement lives in one place
 * (`projections.ts`) and a settings page can show the same projection without the step.
 */
export interface OnboardingStep {
  id: string;
  title: string;
  /** One sentence shown above the step's fields. */
  intro: string;
  projections: readonly string[];
  /** An optional step may be skipped, and an untouched one is not "incomplete". */
  optional?: boolean;
  /** The final step has no fields of its own: it summarises and publishes. */
  review?: boolean;
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: 'identity',
    title: 'Your business',
    intro: 'What your business is called and how it should be described.',
    projections: ['organization.identity'],
  },
  {
    id: 'contact',
    title: 'Contact details',
    intro: 'How customers reach you, and where you are online.',
    projections: ['organization.contact'],
  },
  {
    id: 'locations',
    title: 'Locations and services',
    intro: 'Where you operate and what you offer. You can add these later.',
    projections: ['organization.locations', 'organization.services'],
    optional: true,
  },
  {
    id: 'brand',
    title: 'Brand',
    intro: 'Your colours and fonts. The theme editor covers everything finer.',
    projections: ['brand.basics', 'brand.shape'],
  },
  {
    id: 'accessibility',
    title: 'Accessibility',
    intro: 'The accessibility standard your site is held to.',
    projections: ['site.accessibility'],
  },
  {
    id: 'site',
    title: 'Languages and address',
    intro: 'The languages you publish in and the address your site lives at.',
    projections: ['site.locales', 'site.domains'],
  },
  {
    id: 'privacy',
    title: 'Privacy and legal',
    intro: 'Where you are governed, and which legal documents to publish.',
    projections: ['site.privacy'],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    intro: 'Analytics, notifications and your CRM. All optional.',
    projections: ['site.analytics', 'site.notifications', 'site.crm'],
    optional: true,
  },
  {
    id: 'review',
    title: 'Review',
    intro: 'Check everything, then publish.',
    projections: [],
    review: true,
  },
];

export function stepById(id: string): OnboardingStep | undefined {
  return ONBOARDING_STEPS.find((step) => step.id === id);
}
