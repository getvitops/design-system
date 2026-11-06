/**
 * Turning a `ConversionEvent` into something a person reads.
 *
 * Pure, and separate from both the plan and the sender, because rendering is the
 * part that differs per channel: an SMS channel will render the same event in 160
 * characters, a portal log as a row. The event stays the fact; only this file has
 * an opinion about prose.
 *
 * The layout is three sections — who got in touch, which ad sent them, and what
 * the request looked like — because that is the order the reader needs them in.
 * The contact details are the point; attribution is why it matters; the visitor
 * context is for when something looks wrong.
 */
import { identifySubmitter } from '../tracking/identity.ts';
import { getPrimaryClickId, identifyPlatform } from '../tracking/platform.ts';
import type { ConversionEvent } from '../tracking/types.ts';
import type { RenderedMessage } from './types.ts';

/**
 * Fields never worth putting in a notification.
 *
 * A honeypot is not visitor-supplied — it is bait, and reporting it as something
 * they submitted is untrue. The same rule `legal/derive.ts` applies when deriving
 * `piiCollected`, and for the same reason. Callers may strip more.
 */
const OMIT_FIELDS = new Set(['website', '_honeypot', 'honeypot', 'cf-turnstile-response']);

function label(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/[_-]/g, ' ');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** One section: a heading and its lines. Empty sections are dropped by the caller. */
interface Section {
  heading: string;
  lines: [string, string][];
}

/**
 * One line, already rendered both ways — a plain fact (`html` is just the
 * escaped `text`) or a link (`html` an anchor, `text` the bare href). Built at
 * the point each line is known rather than carried as a union and branched on
 * later: `describeEvent`'s lines are always plain `[label, value]` pairs (see
 * `Section` above, which `render.test.ts` destructures as such), and the one
 * line shape `renderEmail` adds itself — the "Actions" link — is turned into
 * this same rendered shape immediately, so the two renderers below share one
 * line format instead of branching on what kind of line each one is.
 */
interface RenderedLine {
  label: string;
  text: string;
  html: string;
}

/** A section as `renderEmail` assembles it — `describeEvent`'s output plus its own additions. */
interface RenderSection {
  heading: string;
  lines: RenderedLine[];
}

function factLine([label, value]: readonly [string, string]): RenderedLine {
  return { label, text: value, html: escapeHtml(value) };
}

function linkLine(label: string, href: string): RenderedLine {
  return { label, text: href, html: `<a href="${escapeHtml(href)}">${escapeHtml(href)}</a>` };
}

function toRenderSection(section: Section): RenderSection {
  return { heading: section.heading, lines: section.lines.map(factLine) };
}

/**
 * Who submitted the form, for the subject line.
 *
 * `formData['name']` alone is the shape a form has when someone writes it that
 * way, and most don't: a downstream site had `first_name`/`last_name` on five of
 * six forms, so every notification read "from Unknown" and the renderer could
 * not be adopted at all. The cascade is ordered most-specific first, and falls
 * back to the email rather than to nothing — an address identifies the person
 * even when no name field exists.
 */
function submitterName(formData: Record<string, string>): string {
  return identifySubmitter(formData).fullName;
}

/**
 * The event as sections — the shared structure behind both renderings.
 *
 * Extracted so the text and HTML versions cannot disagree about content. They
 * differ only in markup; a field added here appears in both.
 */
export function describeEvent(event: ConversionEvent): { subject: string; sections: Section[] } {
  const t = event.tracking;
  const platform = t ? identifyPlatform(t) : null;
  const clickId = t ? getPrimaryClickId(t) : null;

  const contact: [string, string][] = [];
  let subject: string;

  if (event.type === 'form' && event.formData) {
    const name = submitterName(event.formData);
    subject = `[Contact Form] New submission from ${name}`;
    for (const [key, value] of Object.entries(event.formData)) {
      if (!OMIT_FIELDS.has(key) && value) contact.push([label(key), value]);
    }
  } else if (event.type === 'email') {
    const email = event.email ?? 'unknown';
    subject = `[Email Click] Visitor emailing ${email}`;
    contact.push(['Email', email]);
  } else {
    const phone = event.phone ?? 'unknown';
    subject = `[Phone Call] Visitor calling ${phone}`;
    contact.push(['Phone', phone]);
  }

  const attribution: [string, string][] = [];
  if (t) {
    if (platform) attribution.push(['Platform', platform]);
    if (clickId) attribution.push([`Click ID (${clickId.param})`, clickId.value]);
    for (const key of ['utm_campaign', 'utm_source', 'utm_medium', 'utm_content', 'utm_term']) {
      const value = t[key];
      if (value) attribution.push([label(key.replace('utm_', '')), String(value)]);
    }
    if (t.ab_variant) attribution.push(['A/B variant', t.ab_variant]);
  }

  const context: [string, string][] = [];
  if (t?.landingPage) context.push(['Landing page', t.landingPage]);
  if (t?.referrer) context.push(['Referrer', t.referrer]);
  if (t?.ts) context.push(['First visit', new Date(t.ts).toISOString()]);
  context.push(['Received', new Date(event.at).toISOString()]);
  if (event.userAgent) context.push(['User agent', event.userAgent]);
  if (event.ip) context.push(['IP', event.ip]);

  const sections: Section[] = [
    { heading: 'Contact details', lines: contact },
    // Stated rather than omitted: "we don't know where this came from" is a
    // useful answer, and a silently missing section reads as a bug in the tool.
    {
      heading: 'Ad attribution',
      lines: attribution.length
        ? attribution
        : [['Source', 'None — visitor arrived without ad tracking']],
    },
    { heading: 'Visitor context', lines: context },
  ];

  return { subject, sections: sections.filter((s) => s.lines.length) };
}

/** Render for e-mail. Both halves, always — see `RenderedMessage`. */
export function renderEmail(
  event: ConversionEvent,
  extra: { notes?: string[] | undefined; actionUrl?: string | undefined } = {},
): RenderedMessage {
  const { subject, sections: eventSections } = describeEvent(event);

  // `{clickId}` is the only placeholder — an event has no durable id nothing
  // in this toolchain could look back up (there's no store), so interpolating
  // one would be decorative. Omitted entirely when there's no click ID to
  // interpolate, rather than emailing a link with a literal `{clickId}` in it.
  const clickId = event.tracking ? getPrimaryClickId(event.tracking) : null;
  const actionSection: RenderSection | null =
    extra.actionUrl && clickId
      ? {
          heading: 'Actions',
          lines: [
            linkLine(
              'View in ad platform',
              extra.actionUrl.replace(/\{clickId\}/g, encodeURIComponent(clickId.value)),
            ),
          ],
        }
      : null;

  // Deliberately a channel-neutral `string[]` rather than a typed CRM result —
  // this module gains no dependency on `crm`, and the seam serves any future
  // sink the same way.
  const sections: RenderSection[] = [
    ...eventSections.map(toRenderSection),
    ...(actionSection ? [actionSection] : []),
    ...(extra.notes && extra.notes.length
      ? [{ heading: 'Delivery', lines: extra.notes.map((n) => factLine(['CRM', n])) }]
      : []),
  ];

  const text = sections
    .map((s) => [`--- ${s.heading} ---`, ...s.lines.map((l) => `${l.label}: ${l.text}`)].join('\n'))
    .join('\n\n');

  const html = sections
    .map(
      (s) =>
        `<h2 style="font:600 14px system-ui;margin:24px 0 8px">${escapeHtml(s.heading)}</h2>` +
        `<table style="font:14px system-ui;border-collapse:collapse">${s.lines
          .map(
            (l) =>
              `<tr><td style="padding:2px 12px 2px 0;color:#666;vertical-align:top">${escapeHtml(l.label)}</td>` +
              `<td style="padding:2px 0">${l.html}</td></tr>`,
          )
          .join('')}</table>`,
    )
    .join('');

  return { subject, text, html };
}
