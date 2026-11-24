/**
 * Accessibility statement.
 *
 * Adapted from the agency's AODA statement template, with three differences that are deliberate:
 *
 *  1. **Nothing is asserted that the config did not declare.** The hand-filled template had
 *     `[fully / partially]` and `[DATE]` placeholders; here the conformance sentence exists only when
 *     `conformance` is set, the test sentence only when `testedOn` is, the AODA wording only when
 *     `law: 'aoda'` is, and so on. There is no default "we tested with NVDA and JAWS": the template
 *     said to adjust that to what was tested, and a build tool cannot know.
 *  2. **The author notes are not output.** The "Note:" lines and the headcount table were guidance
 *     for a person filling in the template. They live in the `vitops-accessibility` skill.
 *  3. **It is written to the Level AAA content criteria, because the page that explains a site's
 *     accessibility has to be the most accessible page on it.** Plain language (WCAG 3.1.5, held by
 *     a reading-grade test), every abbreviation spelled out where first used (3.1.4), unusual words
 *     explained where they appear (3.1.3), links that say where they go (2.4.9), real headings and
 *     lists in order (2.4.10), and no tables. `accessibility-statement.test.ts` enforces all of it
 *     over every combination of optional sections, so a later edit cannot quietly lose it.
 *
 * Jurisdiction-independent: both `ca` and `qc` register this one function. AODA wording is gated on
 * `law`, not on the jurisdiction (which is the privacy regime and says nothing about accessibility
 * law).
 */
import { list, type PolicyVars } from '../derive.ts';
import { bullets, link, REVIEW_NOTICE, updatedLine } from './shared.ts';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** `2026-11-12` → `November 12, 2026`. A reader should not have to parse ISO 8601. */
function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return y && m && d ? `${MONTHS[m - 1]} ${d}, ${y}` : iso;
}

/**
 * Config text lands inside markdown that has no escaping, so strip what the renderer would read as
 * structure (emphasis, code, link brackets) and flatten line breaks. Prose passes through unchanged.
 */
const clean = (s: string): string =>
  s
    .replace(/[*`[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** A complete sentence: config values are fragments, and a missing full stop reads as a typo. */
const sentence = (s: string): string => {
  const t = clean(s);
  return /[.!?]$/.test(t) ? t : `${t}.`;
};

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const days = (n: number): string => `${n} business day${n === 1 ? '' : 's'}`;

export function accessibilityStatement(v: PolicyVars): string {
  const a = v.accessibility;
  const aoda = a.law === 'aoda';
  const number = a.standardLabel.replace(/^WCAG /, '');

  // "Screen reader" is explained once, where it first appears, in plain words (WCAG 3.1.3).
  let srExplained = false;
  const screenReader = (plural = false): string => {
    const noun = plural ? 'screen readers' : 'screen reader';
    if (srExplained) return noun;
    srExplained = true;
    return `${noun} (software that reads the screen aloud)`;
  };

  // ── Standard and status ──────────────────────────────────────────────────────
  const methods = a.testing.map((m) => {
    if (m === 'automated') return 'automated testing';
    if (m === 'keyboard') return 'testing with a keyboard only';
    if (m === 'screen-reader') return `testing with a ${screenReader()}`;
    return a.auditor ? `an outside audit by ${clean(a.auditor)}` : 'an outside audit';
  });
  const level = a.level === 'none' ? '' : `, Level ${a.level}`;
  const status = [
    `This website aims to meet the Web Content Accessibility Guidelines (WCAG) ${number}${level}. WCAG is a set of international rules that make web content easier to use for people with disabilities.`,
    a.mandatory
      ? aoda
        ? 'The AODA requires our organization to meet WCAG 2.0 Level AA.'
        : 'The law requires our organization to meet this standard.'
      : undefined,
    a.conformance === 'full' ? 'The website fully meets this standard.' : undefined,
    a.conformance === 'partial'
      ? 'The website partly meets this standard. This means some content does not meet it yet. You can read about those problems under "Known problems" below.'
      : undefined,
    a.testedOn
      ? sentence(
          `We last tested the website on ${longDate(a.testedOn)}${methods.length ? `, using ${list(methods)}` : ''}`,
        )
      : undefined,
    a.contrastToggle
      ? 'This website has a "High contrast" option. It switches to colours with more contrast, and it starts on if your device asks for more contrast. Look for it on every page.'
      : undefined,
  ]
    .filter((p): p is string => p != null)
    .join('\n\n');

  // ── Browsers and assistive technology ────────────────────────────────────────
  const browsers = a.testedBrowsers.length
    ? `We tested the website in ${list(a.testedBrowsers.map(clean))}.`
    : 'We build the website to work in the current and previous major versions of Chrome, Edge, Firefox and Safari, on computers and phones.';
  const tech = a.testedAssistiveTech.length
    ? `We tested the website with these assistive technologies:\n\n${bullets(a.testedAssistiveTech.map(clean))}`
    : 'We build the website to work with assistive technology.';

  // ── Known problems ───────────────────────────────────────────────────────────
  const problems = a.limitations.length
    ? `We know about these problems. For each one, we say how to get what you need another way, and when we plan to fix it.\n\n${bullets(
        a.limitations.map(
          (l) =>
            `**${clean(l.content)}**: ${sentence(l.issue)}${
              l.alternative ? ` Another way: ${sentence(l.alternative)}` : ''
            }${l.plannedFix ? ` Planned fix: ${sentence(l.plannedFix)}` : ''}`,
        ),
      )}`
    : 'We are not aware of any current accessibility problems. If you find one, please tell us.';

  // ── Contact ──────────────────────────────────────────────────────────────────
  const contact = [
    a.contact.email ? `Email: ${link(a.contact.email, `mailto:${a.contact.email}`)}` : undefined,
    a.contact.phone
      ? `Phone: ${link(a.contact.phone, `tel:${a.contact.phone.replace(/[^+\d]/g, '')}`)}`
      : undefined,
    a.contact.address ? `Mail: ${clean(a.contact.address)}` : undefined,
    a.inPerson ? `In person: ${clean(a.inPerson)}` : undefined,
  ].filter((c): c is string => c != null);
  const contactBlock = contact.length
    ? `To ask, contact us in any of these ways:\n\n${bullets(contact)}`
    : 'To ask, contact us using the details on this website.';
  const reply = (what: string): string =>
    a.responseDays
      ? `We will ${what} within ${days(a.responseDays)}`
      : `We will ${what} as soon as we can`;

  const formats = [
    'You can ask for information in a format that works for you, at no extra cost.',
    a.formats.length ? `For example, we can provide ${list(a.formats.map(clean))}.` : undefined,
    a.supports.length
      ? `We can also arrange communication supports, such as ${list(a.supports.map(clean))}.`
      : undefined,
    aoda
      ? 'Under the AODA, we must tell you that accessible formats and communication supports are available. This section is that notice.'
      : undefined,
  ]
    .filter((p): p is string => p != null)
    .join(' ');

  // ── Feedback ─────────────────────────────────────────────────────────────────
  const feedback = [
    `We welcome feedback about the accessibility of this website and our services. To report a barrier or share a suggestion, use any contact method above${
      a.feedbackUrl ? `, or use our ${link('accessibility feedback form', a.feedbackUrl)}` : ''
    }.`,
    'Please tell us the page address, what you were trying to do, and the browser or assistive technology you use, if you know it. You do not have to tell us all of this.',
    `${reply('reply to your feedback')} and tell you what we plan to do about it.${
      a.feedbackOwner ? ` ${cap(clean(a.feedbackOwner))} reads all feedback.` : ''
    }`,
  ].join('\n\n');

  // ── Policies ─────────────────────────────────────────────────────────────────
  const policies = a.policies.length
    ? `## Accessibility policies and plans

Our accessibility documents are listed here. They are also available in an accessible format on request.

${bullets(
  a.policies.map((p) =>
    p.url ? link(p.title, p.url) : `${clean(p.title)} (available on request)`,
  ),
)}

`
    : a.policiesOnRequest
      ? `## Accessibility policies and plans

Our accessibility policies are available on request. Contact us in any of the ways listed above.

`
      : '';

  // ── About this statement ─────────────────────────────────────────────────────
  const cadence =
    a.reviewCadence === 'annually'
      ? 'We review this statement at least once a year, and whenever the website changes in a big way.'
      : a.reviewCadence === 'semi-annually'
        ? 'We review this statement every six months, and whenever the website changes in a big way.'
        : a.reviewCadence === 'quarterly'
          ? 'We review this statement every three months, and whenever the website changes in a big way.'
          : 'We review this statement whenever the website changes in a big way.';
  const about = [
    a.lastUpdated ? `This statement was last updated on ${longDate(a.lastUpdated)}.` : undefined,
    cadence,
  ]
    .filter((p): p is string => p != null)
    .join(' ');

  return `# Accessibility Statement
${updatedLine({ lastUpdated: a.lastUpdated ? longDate(a.lastUpdated) : undefined })}
${REVIEW_NOTICE}

## Our commitment

${v.businessName} is committed to making this website easy to use for everyone, including people with disabilities. ${
    aoda
      ? 'We follow the Accessibility for Ontarians with Disabilities Act (AODA) and work to remove barriers wherever we find them.'
      : 'We work to remove barriers wherever we find them.'
  }

If something on this website is hard to use, tell us. We will work with you to get you the information or service you need.

## The standard we follow

${status}

## Browsers and assistive technology

Assistive technology is software or equipment that helps people use a computer, such as ${screenReader(true)}, screen magnifiers and voice control.

${browsers}

${tech}

The website also responds to your device settings for high contrast, reduced motion and larger text. We design it so you can make the text up to twice as large without losing content or features.

The website may work in older browsers, but some features may look or act differently. The main tasks stay available. If you cannot update your browser or device and something does not work, contact us and we will help another way.

## Known problems

${problems}

## Asking for an accessible format or support

${formats}

${contactBlock}

${reply('reply')} and work with you to find a format that suits you. If we cannot give you the format you asked for, we will tell you why and offer another option.

## Feedback

${feedback}

${policies}## About this statement

${about}
`;
}
