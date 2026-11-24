import { describe, expect, it } from 'vite-plus/test';
import type { ConversionEvent } from '../tracking/types.ts';
import { deriveLastName, mapSubmission } from './map.ts';
import type { CrmConfig } from './types.ts';

const config: CrmConfig = {
  provider: 'hubspot',
  hubspot: { portalId: '1', formGuid: 'g' },
  fieldMap: { message: 'message', service: 'service_interest' },
  trackingFields: { gclid: 'google_click_id', utm_campaign: 'campaign' },
};

describe('deriveLastName', () => {
  it('uses an explicit last name first', () => {
    expect(deriveLastName({ lastName: 'Smith', fullName: 'Dana Smith' })).toEqual({
      lastName: 'Smith',
    });
  });

  it('falls back to the last token of a full name', () => {
    expect(deriveLastName({ fullName: 'Dana Smith' })).toEqual({ lastName: 'Smith' });
  });

  it('falls back to the email local-part when the name has no space', () => {
    expect(deriveLastName({ fullName: 'Dana', email: 'dana@example.com' })).toEqual({
      lastName: 'dana',
    });
  });

  it('refuses rather than fabricate a name from nothing', () => {
    const result = deriveLastName({ fullName: 'Dana' });
    expect('refusal' in result).toBe(true);
  });
});

describe('mapSubmission', () => {
  it('maps identity, tracking-null yields no attribution', () => {
    const event: ConversionEvent = {
      type: 'form',
      formData: {
        first_name: 'Dana',
        last_name: 'Smith',
        email: 'dana@example.com',
        message: 'Hi',
      },
      tracking: null,
      at: 0,
    };
    const record = mapSubmission(event, config);
    expect(record.firstName).toBe('Dana');
    expect(record.lastName).toBe('Smith');
    expect(record.email).toBe('dana@example.com');
    expect(record.attribution).toEqual({});
  });

  it('maps trackingFields when tracking data is present', () => {
    const event: ConversionEvent = {
      type: 'form',
      formData: { name: 'Dana' },
      tracking: { gclid: 'G1', utm_campaign: 'spring' },
      at: 0,
    };
    const record = mapSubmission(event, config);
    expect(record.attribution).toEqual({ google_click_id: 'G1', campaign: 'spring' });
  });

  it('drops fields with no fieldMap entry', () => {
    const event: ConversionEvent = {
      type: 'form',
      formData: { name: 'Dana', unmapped_field: 'should not appear' },
      tracking: null,
      at: 0,
    };
    const record = mapSubmission(event, config);
    expect(record.extra).not.toHaveProperty('unmapped_field');
  });

  it('maps configured extra fields', () => {
    const event: ConversionEvent = {
      type: 'form',
      formData: { name: 'Dana', service: 'Consulting' },
      tracking: null,
      at: 0,
    };
    const record = mapSubmission(event, config);
    expect(record.extra).toEqual({ service_interest: 'Consulting' });
  });
});
