/**
 * Privacy policy — Canada (PIPEDA).
 *
 * Ported from the pandoc prototype at `packages/core/legal-templates/`. Two
 * things changed in the port and both are load-bearing:
 *
 *  1. `${var}` is now real TypeScript interpolation rather than a pandoc Lua
 *     filter, so an unresolved variable is a compile error. The filter left
 *     unknown keys as the literal text `${key}` — which would ship a live
 *     privacy policy containing `${countries}`.
 *  2. Lists are built from arrays, not by splicing a string into a fixed bullet.
 *     An empty derived value used to produce a stray `- ; and` bullet.
 *
 * The prose is jurisdiction-specific: it names the Office of the Privacy
 * Commissioner of Canada and frames transfers as "outside of Canada". Do not
 * reuse it for another jurisdiction — add a sibling template instead.
 */
// `list` is a formatting helper, the same class as `bullets` — the connectives
// ("including", "in the case of") stay in the prose below, where they belong.
import { list, type PolicyVars } from '../derive.ts';
import { bullets, REVIEW_NOTICE, updatedLine } from './shared.ts';

export function privacyCa(v: PolicyVars): string {
  return `# Privacy Policy
${updatedLine(v)}
${REVIEW_NOTICE}

This is the privacy policy of ${v.businessName} ("Business"). It summarizes what personal information we collect and how we use and disclose this information.

By using our website (the "Site"), you signify your consent to the terms of our Privacy Policy. If you do not agree with any terms of this Privacy Policy, please do not use this Site or submit any personal information to us, or use the preference tools we provide to adjust your settings. This Privacy Policy also describes certain choices you have on how we use your personal information.

We reserve the right to modify this Privacy Policy at any time. We will reflect any such modifications to this Privacy Policy on our Site. We suggest that you periodically consult this Privacy Policy. Your continued use of the Site after any such changes constitutes your acceptance of this Privacy Policy, as revised.

**Privacy Policy Summary.**

${bullets([
  'What Personal Information We Collect',
  'How We Use Personal Information',
  'How We Share Personal Information',
  'Your Choices',
])}

## Full Privacy Policy

### What Personal Information We Collect and How We Collect It

Personal information is information about an identifiable individual. We collect personal information only for purposes that a reasonable person would consider appropriate in the circumstances and only with your knowledge and consent, except where otherwise required or permitted by law. Business collects personal information when you voluntarily provide it through our Site or when you provide it to us through other means. For example, we may collect personal information when you:

${bullets(v.collectionReasons)}

The personal information we may collect will depend on the service you request and may include:

${bullets(v.piiCollected)}

### How Business Collects Information Through Technological Means

When you visit our Site, we may collect information that is automatically sent to us by your web browser. This information may include:

${bullets(v.techInfo)}

We use this information to:

${bullets(v.techInfoPurposes)}

The amount of information that is sent by your web browser depends on the browser and settings you use. Please refer to the instructions provided by your browser if you want to learn more about what information it sends to websites you visit or how you may change or restrict this.

Business may use cookies and other similar devices on this Site to enhance functionality. These devices may track information which includes:

${bullets(v.cookieTracked)}

We use this information to:

${bullets(v.cookiePurposes)}

If you wish to disable cookies, refer to your browser help menu to learn how.${v.cookieTool ? ` ${v.cookieTool}` : ''}

### How Business Uses and Discloses Personal Information

The personal information we collect may be used by Business for the purposes for which it was collected, as provided in this Privacy Policy, or for other purposes that are disclosed to you and to which you consent.

For example, we may use your personal information to:

${bullets(v.usePurposes)}

${providersSection(v)}

Business reserves the right to transfer personal information in the event that we merge with or are acquired by a third party. We also may disclose your personal information for any other purpose required or permitted by law or to which you consent.

### Your Choices

${bullets(v.optOutOptions)}

### How We Protect Personal Information

The security of your personal information is important to us. We protect your personal information in our control through appropriate security safeguards against loss, theft, unauthorized access, disclosure, copying, use or modification. These safeguards include physical measures (such as locked filing cabinets), organizational measures (such as employee training and restricted access), and technological measures (such as encryption and passwords). Personal information may be accessed by persons within our organization who require such access to carry out the purposes described in this Privacy Policy, or such other purposes as permitted or required by law. Personal information we collect is maintained with the source of the information at ${v.url}.

We retain personal information that we collect only as long as necessary for the purposes for which it was collected or to meet legal requirements. We destroy personal information when it is no longer needed for such purposes.${v.retention ? ` In general, we keep personal information for ${v.retention}.` : ''}

It is important to understand that no security measures are absolute. We cannot guarantee the safety of any information you provide to us.
${transferSection(v)}
### Accessing and Correcting Your Personal Information

You have a right to access your personal information and to request a correction to it if you believe it is inaccurate. If you have submitted personal information and would like to have access to it, or if you would like to have it corrected, please contact us using the contact information provided below. We may require you verify your identity before allowing you to access your personal information.

### How to Contact Us

If you have any questions regarding this Privacy Policy, to submit a complaint, or to access or correct your information, please contact our Privacy Officer at ${v.mailingAddress}. If you are not satisfied with our response to your privacy concerns, you may contact the Office of the Privacy Commissioner of Canada at www.priv.gc.ca or 1-800-282-1376.
`;
}

/**
 * Named separately because a site with no third parties at all should not claim
 * to have service providers, and one with them owes the reader their identity —
 * "we may share with service providers" without naming them is the vaguest and
 * least useful sentence a policy can contain.
 */
function providersSection(v: PolicyVars): string {
  if (v.processors.length === 0)
    return 'We do not transfer personal information to third party service providers.';
  return `We may transfer personal information to third party service providers that assist us with carrying out these purposes. When we transfer personal information to service providers, we require them to protect the information in a manner consistent with our privacy practices and applicable privacy laws. These service providers are:

${bullets(
  v.processors.map(
    (p) => `${p.name}, for ${p.purpose}${p.privacyUrl ? ` (privacy policy: ${p.privacyUrl})` : ''}`,
  ),
)}

We remain responsible for personal information in the possession of our service providers.`;
}

/**
 * Omitted entirely when nothing leaves the country — a false claim otherwise.
 *
 * Two clauses, because storage and legal reach are two facts and the OPC's concern
 * is foreign **access**, not merely foreign storage. A provider can hold data in
 * Canada and still be compellable abroad (Azure in a Canadian region), and a
 * provider can hold only one category of data abroad (a Canadian tenant whose
 * identity data sits in the US). One sentence could state neither.
 *
 * The closer is shared: it is true of whichever clauses appear.
 */
function transferSection(v: PolicyVars): string {
  const clauses = [storageClause(v), operatorClause(v)].filter(Boolean);
  if (clauses.length === 0) return '';
  return `
### We May Transfer Personal Information to Other Countries

${clauses.join('\n\n')}

As a result, this information may be subject to access requests from governments, courts or law enforcement in those jurisdictions according to laws in those jurisdictions.
`;
}

/**
 * Where the information rests.
 *
 * A scoped location gets its own sentence rather than joining the "including …"
 * list: folded in, a reader would take it to cover everything the provider holds,
 * which is a broader claim than the config made.
 */
function storageClause(v: PolicyVars): string {
  const scoped = list(v.scopedStorage.map((s) => `${s.country}, in the case of ${s.scope}`));
  if (v.storageCountries)
    return `Some or all of the personal information we collect may be stored or processed in jurisdictions outside of Canada, including ${v.storageCountries}.${
      scoped
        ? ` Certain categories of personal information are held outside of Canada even where the rest is not: ${scoped}.`
        : ''
    }`;
  if (scoped)
    return `Certain categories of the personal information we collect are stored or processed outside of Canada: ${scoped}.`;
  return '';
}

/** The Azure-in-Canada case: the information never moves, and foreign law still reaches it. */
function operatorClause(v: PolicyVars): string {
  if (!v.operatorCountries) return '';
  return `Some of the service providers we use are established in, or controlled from, jurisdictions outside of Canada, including ${v.operatorCountries}. Personal information those providers handle on our behalf may be subject to the laws of those jurisdictions even when it is stored in Canada.`;
}
