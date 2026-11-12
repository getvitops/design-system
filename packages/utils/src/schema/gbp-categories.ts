/**
 * Google Business Profile category → schema.org `LocalBusiness` subtype, for seeding a location's
 * `type` from the category its profile already has.
 *
 * Keyed by the GBP `categoryId` (`gcid:plumber`), which is stable across renames where the display
 * name is not. The values are the subtypes `organization.locations.<key>.type` accepts, which is a
 * short list on purpose, so most trades land on the nearest umbrella
 * (`HomeAndConstructionBusiness`) rather than the narrower schema.org type (`Plumber`).
 *
 * **Incomplete by design, and the ids are not yet checked against Google's own list.** Google
 * publishes ~4,000 categories; this holds the ones service businesses in the markets we serve
 * actually use, and grows only when a real client's category doesn't map. The authoritative source
 * is the Business Information API's `categories.list`, which needs the same agency-wide API access
 * request as `vitops reviews` (see SETUP.html); until it is in hand, treat an unknown id as
 * "unmapped", never as an error: `localBusinessTypeForCategory` returns `undefined` and the caller
 * keeps the generic `LocalBusiness`.
 *
 * Pure data and one lookup, so it is Worker-safe like the rest of `./schema`.
 */
export type LocalBusinessSubtype =
  | 'LocalBusiness'
  | 'Store'
  | 'Restaurant'
  | 'CafeOrCoffeeShop'
  | 'ProfessionalService'
  | 'MedicalBusiness'
  | 'HealthAndBeautyBusiness'
  | 'HomeAndConstructionBusiness'
  | 'AutomotiveBusiness'
  | 'FinancialService'
  | 'LegalService'
  | 'RealEstateAgent';

export const GBP_CATEGORY_TYPES: Readonly<Record<string, LocalBusinessSubtype>> = {
  // Home and construction
  'gcid:plumber': 'HomeAndConstructionBusiness',
  'gcid:electrician': 'HomeAndConstructionBusiness',
  'gcid:hvac_contractor': 'HomeAndConstructionBusiness',
  'gcid:roofing_contractor': 'HomeAndConstructionBusiness',
  'gcid:general_contractor': 'HomeAndConstructionBusiness',
  'gcid:painter': 'HomeAndConstructionBusiness',
  'gcid:landscaper': 'HomeAndConstructionBusiness',
  'gcid:locksmith': 'HomeAndConstructionBusiness',
  // Professional and financial
  'gcid:lawyer': 'LegalService',
  'gcid:law_firm': 'LegalService',
  'gcid:accountant': 'FinancialService',
  'gcid:insurance_agency': 'FinancialService',
  'gcid:real_estate_agent': 'RealEstateAgent',
  'gcid:marketing_agency': 'ProfessionalService',
  'gcid:sign_shop': 'ProfessionalService',
  // Health and beauty
  'gcid:dentist': 'MedicalBusiness',
  'gcid:physiotherapist': 'MedicalBusiness',
  'gcid:chiropractor': 'MedicalBusiness',
  'gcid:hair_salon': 'HealthAndBeautyBusiness',
  // Automotive and food
  'gcid:auto_repair_shop': 'AutomotiveBusiness',
  'gcid:car_dealer': 'AutomotiveBusiness',
  'gcid:restaurant': 'Restaurant',
  'gcid:cafe': 'CafeOrCoffeeShop',
};

/** The `LocalBusiness` subtype for a GBP category id, or `undefined` when it isn't mapped (yet). */
export function localBusinessTypeForCategory(
  categoryId: string | undefined,
): LocalBusinessSubtype | undefined {
  if (!categoryId) return undefined;
  return Object.hasOwn(GBP_CATEGORY_TYPES, categoryId) ? GBP_CATEGORY_TYPES[categoryId] : undefined;
}
