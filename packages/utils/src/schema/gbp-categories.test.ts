import { describe, expect, it } from 'vite-plus/test';
import { GBP_CATEGORY_TYPES, localBusinessTypeForCategory } from './gbp-categories.ts';

describe('localBusinessTypeForCategory', () => {
  it('maps a known category to its subtype', () => {
    expect(localBusinessTypeForCategory('gcid:plumber')).toBe('HomeAndConstructionBusiness');
    expect(localBusinessTypeForCategory('gcid:lawyer')).toBe('LegalService');
  });
  it('is undefined for an unmapped, empty or missing id, never an error', () => {
    expect(localBusinessTypeForCategory('gcid:astronaut')).toBeUndefined();
    expect(localBusinessTypeForCategory('')).toBeUndefined();
    expect(localBusinessTypeForCategory(undefined)).toBeUndefined();
  });
  it('does not resolve through the prototype', () => {
    expect(localBusinessTypeForCategory('constructor')).toBeUndefined();
    expect(localBusinessTypeForCategory('__proto__')).toBeUndefined();
  });
  it('keys every entry as a gcid', () => {
    for (const id of Object.keys(GBP_CATEGORY_TYPES)) expect(id).toMatch(/^gcid:[a-z0-9_]+$/);
  });
});
