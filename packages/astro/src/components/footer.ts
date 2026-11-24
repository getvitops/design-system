/**
 * What `<SiteFooter>` and `<Masthead>` read off `organization`: the logo, the contact facts
 * (address, phone, email, hours) and the public profile links. Pure, so each rule is asserted
 * without rendering.
 *
 * The config is read loosely (see `ChromeSource`): a plain `import site from './site.json'` types
 * every enum as `string`, which a strict `Config` rejects, so these are structural and each value
 * is checked at runtime instead. Anything that lands in an `href` or `src` is checked to be a safe
 * URL first: a config is edited by a person, and sometimes by a portal's form.
 */
import { telUri } from '@getvitops/utils/tracking';

export interface OrganizationLike {
  name?: unknown;
  logo?: unknown;
  email?: unknown;
  phone?: unknown;
  address?: Record<string, unknown>;
  /** A `locations` key, or an inline contact object. */
  contact?: unknown;
  locations?: Record<string, LocationLike | undefined>;
  links?: Record<string, unknown>;
}

export interface LocationLike {
  phone?: unknown;
  email?: unknown;
  address?: Record<string, unknown>;
  hours?: { dayOfWeek?: unknown; opens?: unknown; closes?: unknown }[];
}

export interface Logo {
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface FooterContact {
  /** Postal address, one line per entry; empty when none is stated. */
  address: string[];
  phone?: { display: string; href: string };
  email?: string;
  /** Opening hours, one line per distinct schedule. */
  hours: { days: string; time: string }[];
  links: { label: string; href: string }[];
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** A same-site path or an http(s) URL. Not `javascript:`, `data:`, or a protocol-relative `//host`. */
export function safeUrl(value: unknown): string | null {
  const v = text(value);
  if (!v) return null;
  if (v.startsWith('/') && !v.startsWith('//') && !v.includes('\\')) return v;
  return /^https?:\/\/[^\s]+$/i.test(v) ? v : null;
}

/** The logo, with an `alt` that names the organization when the config gives a bare path. */
export function resolveLogo(org: OrganizationLike | undefined): Logo | null {
  const raw = org?.logo;
  const fallbackAlt = text(org?.name);
  if (typeof raw === 'string') {
    const src = safeUrl(raw);
    return src ? { src, alt: fallbackAlt } : null;
  }
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    const src = safeUrl(r['src']);
    if (!src) return null;
    const dim = (v: unknown) => (typeof v === 'number' && v > 0 ? v : undefined);
    return {
      src,
      alt: typeof r['alt'] === 'string' ? r['alt'] : fallbackAlt,
      ...(dim(r['width']) ? { width: dim(r['width'])! } : {}),
      ...(dim(r['height']) ? { height: dim(r['height'])! } : {}),
    };
  }
  return null;
}

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;
const SHORT: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

/** `08:00` to `8 am`, `17:30` to `5:30 pm`, `00:00` to `12 am`. Anything else is left as written. */
export function clock(value: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return value;
  const h = Number(m[1]);
  const min = m[2];
  const suffix = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return min === '00' ? `${hour} ${suffix}` : `${hour}:${min} ${suffix}`;
}

/** `Mon–Fri`, `Mon, Wed`, `Sat`: consecutive days collapse to a range. */
export function dayRange(days: string[]): string {
  const idx = [...new Set(days.map((d) => DAYS.indexOf(d as (typeof DAYS)[number])))]
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1] === idx[j]! + 1) j++;
    const first = SHORT[DAYS[idx[i]!]!]!;
    const last = SHORT[DAYS[idx[j]!]!]!;
    parts.push(
      j - i >= 2
        ? `${first}–${last}`
        : idx
            .slice(i, j + 1)
            .map((k) => SHORT[DAYS[k]!])
            .join(', '),
    );
    i = j + 1;
  }
  return parts.join(', ');
}

export function resolveHours(hours: LocationLike['hours']): FooterContact['hours'] {
  const rows: { first: number; days: string; time: string }[] = [];
  for (const h of hours ?? []) {
    const days = Array.isArray(h.dayOfWeek) ? h.dayOfWeek.filter((d) => typeof d === 'string') : [];
    const opens = text(h.opens);
    const closes = text(h.closes);
    const label = dayRange(days as string[]);
    if (!label || !opens || !closes) continue;
    const first = Math.min(
      ...(days as string[]).map((d) => DAYS.indexOf(d as (typeof DAYS)[number])),
    );
    rows.push({ first, days: label, time: `${clock(opens)}–${clock(closes)}` });
  }
  return rows.sort((a, b) => a.first - b.first).map(({ days, time }) => ({ days, time }));
}

function addressLines(a: Record<string, unknown> | undefined): string[] {
  if (!a) return [];
  const street = text(a['streetAddress']);
  const place = [text(a['addressLocality']), text(a['addressRegion'])].filter(Boolean).join(', ');
  const tail = [place, text(a['postalCode'])].filter(Boolean).join(' ');
  return [street, tail].filter(Boolean);
}

const LINK_LABELS: Record<string, string> = {
  googleMaps: 'Google Maps',
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  github: 'GitHub',
};

/**
 * Which location speaks for the footer: `location` if named, else the one `organization.contact`
 * references, else the first. Contact facts on the organization itself win over the location's.
 */
function pickLocation(org: OrganizationLike, location?: string): LocationLike | undefined {
  const locs = org.locations ?? {};
  const key =
    (location && locs[location] ? location : undefined) ??
    (typeof org.contact === 'string' && locs[org.contact] ? org.contact : undefined) ??
    Object.keys(locs)[0];
  return key ? locs[key] : undefined;
}

/** The contact column's content, or `null` when the config states none of it. */
export function resolveContact(
  org: OrganizationLike | undefined,
  location?: string,
): FooterContact | null {
  if (!org) return null;
  const loc = pickLocation(org, location);
  const phoneText = text(org.phone) || text(loc?.phone);
  const email = text(org.email) || text(loc?.email);
  const address = addressLines(org.address).length
    ? addressLines(org.address)
    : addressLines(loc?.address);
  const hours = resolveHours(loc?.hours);
  const links = Object.entries(org.links ?? {}).flatMap(([key, value]) => {
    const href = safeUrl(value);
    const label = LINK_LABELS[key];
    return href && href.startsWith('http') && label ? [{ label, href }] : [];
  });
  const contact: FooterContact = {
    address,
    ...(phoneText ? { phone: { display: phoneText, href: telUri(phoneText) } } : {}),
    ...(/^[^\s@<>"]+@[^\s@<>"]+$/.test(email) ? { email } : {}),
    hours,
    links,
  };
  const any =
    address.length > 0 || contact.phone || contact.email || hours.length > 0 || links.length > 0;
  return any ? contact : null;
}
