import siteConfig from '#site-config';

// ---------------------------------------------------------------------------
// Primary location resolution (centralizes logic duplicated across consumers)
// ---------------------------------------------------------------------------

/** Resolve the primary location key from config */
export function resolvePrimaryLocationKey(): string | null {
  const locationsRecord = ((siteConfig as any).locations as Record<string, Location>) || {};
  const locationEntries = Object.entries(locationsRecord);
  return (siteConfig as any).primaryLocation
    || (locationEntries.length === 1 ? locationEntries[0][0] : null);
}

/** Resolve the primary Location object from config */
export function resolvePrimaryLocation(): Location | null {
  const locationsRecord = ((siteConfig as any).locations as Record<string, Location>) || {};
  const key = resolvePrimaryLocationKey();
  return key ? locationsRecord[key] ?? null : null;
}

// ---------------------------------------------------------------------------
// Contact resolution
// ---------------------------------------------------------------------------

/**
 * Resolve company-level contact info.
 *
 * Resolution chain (per-field fallthrough):
 *   1. `contact` (inline object or resolved from location key reference)
 *   2. `primaryLocation`
 *   3. First location
 *
 * The `name` field does NOT fall through — location names serve a different
 * purpose than the contact display name (e.g. "Customer Support").
 */
export function resolveContact(): Contact {
  const contactConfig = (siteConfig as any).contact as ContactConfig | undefined;
  const locationsRecord = ((siteConfig as any).locations as Record<string, Location>) || {};
  const primaryLocation = resolvePrimaryLocation();
  const firstLocation = Object.values(locationsRecord)[0] ?? null;

  // Step 1: resolve contactConfig to a Contact object
  let contactBase: Contact = {};
  if (typeof contactConfig === 'string') {
    const loc = locationsRecord[contactConfig];
    if (loc) {
      contactBase = { email: loc.email, phone: loc.phone, address: loc.address };
    }
  } else if (contactConfig && typeof contactConfig === 'object') {
    contactBase = { ...contactConfig };
  }

  // Step 2: fill missing fields from primaryLocation, then first location
  const fallback = primaryLocation ?? firstLocation;

  return {
    name: contactBase.name ?? undefined,
    email: contactBase.email ?? fallback?.email ?? undefined,
    phone: contactBase.phone ?? fallback?.phone ?? undefined,
    address: contactBase.address ?? fallback?.address ?? undefined,
  };
}
