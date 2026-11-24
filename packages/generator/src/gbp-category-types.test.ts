import { GBP_CATEGORY_TYPES } from '@getvitops/utils/schema';
import { describe, expect, it } from 'vite-plus/test';
import { validateConfig } from './config.ts';
import { defaultSiteConfig } from './index.ts';

/**
 * `GBP_CATEGORY_TYPES` lives in `@getvitops/utils` (Worker-safe, no schema dependency) but its values
 * are what `organization.locations.<key>.type` accepts, an enum owned here. This is the one place both
 * can be seen, so a subtype added to the table and not to the schema fails here rather than at a
 * consumer's `validateConfig`.
 */
describe('GBP category map', () => {
  const base = defaultSiteConfig();

  it.each([...new Set(Object.values(GBP_CATEGORY_TYPES))])(
    '%s is a LocalBusiness type a location accepts',
    (type) => {
      const result = validateConfig({
        ...base,
        organization: { ...base.organization, locations: { main: { name: 'Main', type } } },
      });
      expect(result.ok, JSON.stringify(result)).toBe(true);
    },
  );
});
