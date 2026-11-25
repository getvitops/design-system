import { describe, expect, it } from 'vite-plus/test';
import { clock, dayRange, resolveContact, resolveHours, resolveLogo, safeUrl } from './footer.ts';

describe('safeUrl', () => {
  it('admits a same-site path and an http(s) URL, and nothing else', () => {
    expect(safeUrl('/logo.svg')).toBe('/logo.svg');
    expect(safeUrl('https://acme.ca/a.png')).toBe('https://acme.ca/a.png');
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', '//evil.test/x', '/a\\b', '', 5])
      expect(safeUrl(bad)).toBeNull();
  });
});

describe('resolveLogo', () => {
  it('names a bare path after the organization, and keeps an object’s own alt and size', () => {
    expect(resolveLogo({ name: 'Acme', logo: '/l.svg' })).toEqual({ src: '/l.svg', alt: 'Acme' });
    expect(
      resolveLogo({
        name: 'Acme',
        logo: { src: '/l.svg', alt: 'Acme Landscaping', width: 120, height: 40 },
      }),
    ).toEqual({ src: '/l.svg', alt: 'Acme Landscaping', width: 120, height: 40 });
  });
  it('drops an unsafe or missing logo', () => {
    expect(resolveLogo({ logo: 'javascript:x' })).toBeNull();
    expect(resolveLogo({})).toBeNull();
    expect(resolveLogo(undefined)).toBeNull();
  });
});

describe('hours', () => {
  it('turns 24-hour times into plain ones', () => {
    expect(clock('08:00')).toBe('8 am');
    expect(clock('17:30')).toBe('5:30 pm');
    expect(clock('00:00')).toBe('12 am');
    expect(clock('12:00')).toBe('12 pm');
  });
  it('collapses three or more consecutive days to a range, and lists fewer', () => {
    expect(dayRange(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])).toBe('Mon–Fri');
    expect(dayRange(['Saturday', 'Sunday'])).toBe('Sat, Sun');
    expect(dayRange(['Friday', 'Monday', 'Wednesday'])).toBe('Mon, Wed, Fri');
  });
  it('lists one line per schedule in weekday order, and skips a row it cannot read', () => {
    expect(
      resolveHours([
        { dayOfWeek: ['Saturday'], opens: '09:00', closes: '13:00' },
        { dayOfWeek: ['Monday', 'Tuesday', 'Wednesday'], opens: '08:00', closes: '17:00' },
        { dayOfWeek: ['Sunday'], opens: '', closes: '' },
      ]),
    ).toEqual([
      { days: 'Mon–Wed', time: '8 am–5 pm' },
      { days: 'Sat', time: '9 am–1 pm' },
    ]);
  });
});

describe('resolveContact', () => {
  const org = {
    name: 'Acme',
    email: 'hello@acme.ca',
    phone: '(613) 555-0100',
    address: {
      streetAddress: '1 Main St',
      addressLocality: 'Ottawa',
      addressRegion: 'ON',
      postalCode: 'K1A 0B1',
    },
    links: {
      instagram: 'https://instagram.com/acme',
      facebook: 'javascript:x',
      linkedin: 'https://x.test',
    },
    locations: {
      ottawa: {
        hours: [{ dayOfWeek: ['Monday', 'Tuesday', 'Wednesday'], opens: '08:00', closes: '17:00' }],
      },
    },
  };

  it('reads address, a dialable phone, email, hours and safe profile links', () => {
    const c = resolveContact(org)!;
    expect(c.address).toEqual(['1 Main St', 'Ottawa, ON K1A 0B1']);
    expect(c.phone).toEqual({ display: '(613) 555-0100', href: 'tel:+16135550100' });
    expect(c.email).toBe('hello@acme.ca');
    expect(c.hours).toEqual([{ days: 'Mon–Wed', time: '8 am–5 pm' }]);
    expect(c.links.map((l) => l.label)).toEqual(['Instagram', 'LinkedIn']);
  });
  it('falls back to the location for what the organization does not state', () => {
    const c = resolveContact({
      locations: { shop: { phone: '613-555-0111', address: { streetAddress: '9 Elm' } } },
    })!;
    expect(c.phone?.href).toBe('tel:+16135550111');
    expect(c.address).toEqual(['9 Elm']);
  });
  it('lets `organization.contact` or a named location choose the hours', () => {
    const two = {
      contact: 'b',
      locations: {
        a: { hours: [{ dayOfWeek: ['Monday'], opens: '08:00', closes: '09:00' }] },
        b: { hours: [{ dayOfWeek: ['Tuesday'], opens: '10:00', closes: '11:00' }] },
      },
    };
    expect(resolveContact(two)!.hours[0]!.days).toBe('Tue');
    expect(resolveContact(two, 'a')!.hours[0]!.days).toBe('Mon');
  });
  it('rejects a malformed email and answers null when nothing at all is stated', () => {
    expect(resolveContact({ email: 'not an email', phone: '613-555-0100' })!.email).toBeUndefined();
    expect(resolveContact({ name: 'Acme' })).toBeNull();
    expect(resolveContact(undefined)).toBeNull();
  });
});
