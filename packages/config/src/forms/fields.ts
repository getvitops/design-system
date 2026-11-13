/**
 * Presentation the JSON Schema does not carry: a label, an optional widget, a placeholder.
 *
 * **Why this is not in the schema.** `desc()` text is the one source of help, and it already
 * reaches the docs. A label is presentation, and different surfaces group the same field
 * differently, so it belongs beside the projections that arrange them. The schema stays a contract.
 *
 * Keys are dotted config paths, with `*` standing for "the value of this map" (`locations.*.name`).
 * A field with no entry gets a label humanised from its key, so adding a schema field never leaves a
 * form blank — it leaves it plainly worded.
 */
import type { Widget } from './describe.ts';

export interface FieldMeta {
  /** The visible label. */
  label?: string;
  /** A widget to use instead of the one derived from the schema node. */
  widget?: Widget;
  /** Text shown inside an empty control. Never a substitute for the label. */
  placeholder?: string;
  /** Short help shown under the field, instead of the schema's own `description`. */
  help?: string;
}

export const FIELD_META: Readonly<Record<string, FieldMeta>> = {
  // organization
  'organization.name': { label: 'Business name' },
  'organization.legalName': { label: 'Legal name' },
  'organization.description': { label: 'Short description', widget: 'textarea' },
  'organization.logo': { label: 'Logo' },
  // The schema states this as a pattern, not `format: date`, so the widget is named here.
  'organization.foundingDate': { label: 'Founded', widget: 'date' },
  'organization.taxID': { label: 'Tax ID' },
  'organization.vatID': { label: 'VAT ID' },
  'organization.email': { label: 'Email', placeholder: 'hello@example.com' },
  'organization.phone': { label: 'Phone' },
  'organization.address': { label: 'Registered address' },
  'organization.address.streetAddress': { label: 'Street address' },
  'organization.address.addressLocality': { label: 'City' },
  'organization.address.addressRegion': { label: 'Province or state' },
  'organization.address.postalCode': { label: 'Postal code' },
  'organization.address.addressCountry': { label: 'Country' },
  'organization.sameAs': { label: 'Profile links' },
  'organization.links': { label: 'Online profiles' },
  'organization.links.googleMaps': { label: 'Google Maps' },
  'organization.links.x': { label: 'X' },
  'organization.links.linkedin': { label: 'LinkedIn' },
  'organization.links.youtube': { label: 'YouTube' },
  'organization.links.github': { label: 'GitHub' },
  'organization.primaryLocation': { label: 'Main location' },
  'organization.locations': { label: 'Locations' },
  'organization.locations.*.name': { label: 'Location name' },
  'organization.services': { label: 'Services' },
  'organization.services.*.name': { label: 'Service name' },

  // brand (design system)
  'designSystem.themes.default.colors.palette': { label: 'Brand colours' },
  'designSystem.themes.default.colors.palette.*.seed': { label: 'Colour', widget: 'color' },
  'designSystem.themes.default.typography.families': { label: 'Font families' },

  // site
  'site.defaultLocale': { label: 'Default language' },
  'site.locales': { label: 'Languages' },
  'site.locales.*.name': { label: 'Language name' },
  'site.locales.*.basePath': { label: 'URL prefix' },
  'site.domains.canonical': { label: 'Website address', placeholder: 'https://example.com' },
  'site.accessibility': { label: 'Accessibility target' },
  'site.accessibility.standard': { label: 'WCAG version' },
  'site.accessibility.level': { label: 'Conformance level' },
  'site.accessibility.acceptedRisk': { label: 'Accepted risk', widget: 'textarea' },
  'site.legal.jurisdiction': { label: 'Governing jurisdiction' },
  'site.legal.privacyPolicy.enabled': { label: 'Publish a privacy policy' },
  'site.legal.privacyPolicy.privacyOfficerTitle': { label: 'Privacy officer title' },
  'site.legal.termsOfService.enabled': { label: 'Publish terms of service' },
  'site.legal.cookieConsent.enabled': { label: 'Show a cookie banner' },
  'site.legal.cookieConsent.type': { label: 'Consent model' },
  'site.analytics.googleAnalyticsId': { label: 'Google Analytics ID' },
  'site.analytics.plausibleDomain': { label: 'Plausible domain' },
  'site.analytics.googleTagManagerId': { label: 'Google Tag Manager ID' },
  'site.analytics.clarityId': { label: 'Microsoft Clarity ID' },
  'site.crm.provider': { label: 'CRM' },
};

/** The registry entry for `path`. Map rows are looked up as `*`, which is how describe builds them. */
export const metaFor = (path: string): FieldMeta | undefined => FIELD_META[path];

/** `addressLocality` → `Address locality`. The fallback when the registry has no label. */
export function humanize(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
