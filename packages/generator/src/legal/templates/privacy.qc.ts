/**
 * Privacy policy — Quebec (Act respecting the protection of personal information
 * in the private sector, as amended by Law 25).
 *
 * Written fresh rather than adapted from `privacy.ca.ts`: the Quebec regime asks
 * for things PIPEDA does not — a published person in charge, a stated position on
 * technologies that identify or profile, a privacy impact assessment before
 * information leaves Quebec, portability, de-indexing, the right to be told about
 * automated decisions — and frames "abroad" as outside Quebec rather than outside
 * Canada. Reusing the `ca` prose would assert PIPEDA's framing under Law 25's name.
 *
 * Same rule as everywhere: the config records facts, this file owns prose, and a
 * fact the config cannot know is never asserted. So the assessment assurance
 * renders only when `impactAssessments` is attested, the profiling assurance only
 * under an opt-in consent model, and the person in charge is named only when the
 * config names one. What remains is the statute's own wording of the visitor's
 * rights, which holds regardless of how the business operates.
 */
import { list, type PolicyVars } from '../derive.ts';
import { caslSection } from './casl.ts';
import { bullets, QC_REVIEW_NOTICE, REVIEW_NOTICE, updatedLine } from './shared.ts';

export function privacyQc(v: PolicyVars): string {
  return `# Privacy Policy
${updatedLine(v)}
${REVIEW_NOTICE}
${QC_REVIEW_NOTICE}

This is the privacy policy of ${v.businessName} ("we", "us"). It explains what personal information we collect through ${v.url || 'our website'} (the "Site"), why, how it is used and shared, how long it is kept, and the rights you have over it under Quebec's Act respecting the protection of personal information in the private sector (the "Act").

We may update this policy. The version published on the Site is the one that applies, and we will state the date of the latest revision at the top of it.

**Summary.**

${bullets([
  'The person in charge of the protection of personal information',
  'What we collect, and why',
  'Technologies that can identify, locate or profile you',
  'Who receives your information, and transfers outside Quebec',
  'How long we keep it',
  'Your rights, and how to exercise them',
])}

## The Person in Charge of the Protection of Personal Information

${responsible(v)}

## What We Collect, and Why

Personal information is information that relates to a natural person and allows that person to be identified. We collect only the personal information we need for a specific purpose that we have identified, and we tell you that purpose at or before the time we collect it. We ask for your consent to use or communicate it for that purpose; where the Act requires it, your consent is requested separately from any other information, in clear and simple terms. We collect personal information when you:

${bullets(v.collectionReasons)}

Depending on what you ask of us, this may include:

${bullets(v.piiCollected)}

When you visit the Site, your browser also sends us certain technical information automatically:

${bullets(v.techInfo)}

We use it to:

${bullets(v.techInfoPurposes)}

Cookies and similar technologies on the Site may record:

${bullets(v.cookieTracked)}

We use them to:

${bullets(v.cookiePurposes)}

Our Cookie Notice lists them in detail.${v.cookieTool ? ` ${v.cookieTool}` : ''}

${trackingSection(v)}## How We Use and Share Personal Information

We use personal information for the purposes for which it was collected, as described in this policy, or for another purpose to which you consent. For example, we may use it to:

${bullets(v.usePurposes)}

${providersSection(v)}

We may also communicate personal information where the Act permits or requires it without your consent, for example in response to a lawful order.
${transferSection(v)}
## How Long We Keep Personal Information

We keep personal information only for as long as it is needed for the purposes for which it was collected, or as the law requires. When it is no longer needed, we destroy it or anonymize it for serious and legitimate purposes, as the Act provides.${v.retention ? ` In general, we keep personal information for ${v.retention}.` : ''}

## How We Protect Personal Information

We protect personal information with security measures appropriate to its sensitivity, the purposes for which it is used, its quantity and distribution, and the medium on which it is held. Access is limited to the people who need it to carry out these purposes. No measure is absolute, and we cannot guarantee the security of information you send us.

If a confidentiality incident involving your personal information presents a risk of serious injury, the Act requires us to notify the Commission d'accès à l'information du Québec and the people concerned, and to take measures to reduce the risk of harm.

## Your Rights

Subject to the limits the Act provides, you have the right to:

${bullets([
  'be informed of the personal information we hold about you, and to obtain a copy of it (access)',
  'have inaccurate, incomplete or equivocal information corrected, or information collected or held unlawfully deleted (rectification)',
  'receive your computerized personal information in a structured, commonly used technological format, or have it sent to another organization you name (portability)',
  'withdraw your consent to our use or communication of your personal information at any time, subject to legal and contractual restrictions',
  'ask us to stop disseminating your personal information, or to de-index any hyperlink attached to your name that gives access to it, where the dissemination contravenes the law or a court order',
  'be informed if a decision about you is made exclusively through automated processing of your personal information, to be told what information and main factors were used, and to have the decision reviewed by a person',
])}

To exercise any of these rights, write to the person in charge at the address below. We may ask you to verify your identity first. The Act requires us to respond to a request within 30 days of receiving it, and if we refuse it, to tell you why and what recourse you have.
${caslSection(v)}
## Complaints

If you are not satisfied with our response, you may file a complaint with the Commission d'accès à l'information du Québec (www.cai.gouv.qc.ca).

## How to Contact Us

Questions, requests and complaints about this policy or your personal information can be sent to ${v.mailingAddress}.
`;
}

/**
 * Law 25 requires the title and contact details of the person in charge to be
 * published. The name and title are printed only if the config states them; the
 * contact is always the resolved privacy contact. Nothing here asserts that the
 * business "designated" anyone — whether someone was is for the owner to confirm,
 * which the banner asks of them.
 */
function responsible(v: PolicyVars): string {
  const who = [v.privacyOfficerName, v.privacyOfficerTitle && `(${v.privacyOfficerTitle})`]
    .filter(Boolean)
    .join(' ');
  const role = `The person in charge of the protection of personal information at ${v.businessName}`;
  return who
    ? `${role} is ${who}, who can be reached at ${v.mailingAddress}.`
    : `${role} can be reached at ${v.mailingAddress}.`;
}

/**
 * Section 8.1: where a technology can identify, locate or profile you, the Act
 * requires telling you and, for the profiling functions, that they be off until
 * you turn them on. We say "off until you choose" only under an opt-in consent
 * model, which is the one configuration where that is true.
 */
function trackingSection(v: PolicyVars): string {
  if (v.trackingTechnologies.length === 0) return '';
  const assurance =
    v.consentModel === 'opt-in'
      ? 'None of these is activated until you choose to allow it using the consent controls on the Site, and you can change your choice at any time.'
      : v.consentModel === 'opt-out'
        ? 'You can deactivate them at any time using the consent controls on the Site.'
        : 'You can block them through your browser settings.';
  return `### Technologies That Can Identify, Locate or Profile You

The Site uses technologies that can identify you, or collect information about your behaviour in order to profile you:

${bullets(v.trackingTechnologies)}

${assurance}

`;
}

function providersSection(v: PolicyVars): string {
  if (v.processors.length === 0)
    return 'We do not communicate personal information to third-party service providers.';
  return `We may entrust personal information to service providers who carry out a mandate or service contract on our behalf. We provide them only the information they need, require them to use it only for that mandate and not keep it afterwards, and we remain responsible for it. They are:

${bullets(
  v.processors.map(
    (p) => `${p.name}, for ${p.purpose}${p.privacyUrl ? ` (privacy policy: ${p.privacyUrl})` : ''}`,
  ),
)}`;
}

/**
 * Law 25 s. 17: before communicating personal information outside Quebec, an
 * organization must assess the privacy factors and, in broad terms, that the
 * information would receive adequate protection. Two kinds of fact feed this
 * section — where information rests, and which foreign law can reach it — and
 * the assessment assurance is a third that only `impactAssessments` can supply.
 *
 * "Canada" is rewritten because for this template set "outside Quebec" includes
 * the rest of Canada, and a bare "including Canada" would read as a contradiction.
 */
function transferSection(v: PolicyVars): string {
  const where = (s: string) => s.replace(/\bCanada\b/g, 'elsewhere in Canada');
  const clauses: string[] = [];
  const scoped = list(v.scopedStorage.map((s) => `${where(s.country)}, in the case of ${s.scope}`));
  if (v.storageCountries)
    clauses.push(
      `Some or all of the personal information we collect may be stored or processed outside Quebec, including in ${where(v.storageCountries)}.${
        scoped
          ? ` Certain categories are also held outside Quebec even where the rest is not: ${scoped}.`
          : ''
      }`,
    );
  else if (scoped)
    clauses.push(
      `Certain categories of the personal information we collect are stored or processed outside Quebec: ${scoped}.`,
    );
  if (v.operatorCountries)
    clauses.push(
      `Some of our service providers are established in, or controlled from, ${where(v.operatorCountries)}, so information they handle for us may be subject to the laws of those places even when it is stored in Quebec.`,
    );
  if (clauses.length === 0) return '';
  return `
### Transfers Outside Quebec

${clauses.join('\n\n')}
${
  v.transferAssessment
    ? '\nBefore we communicate personal information outside Quebec, we carry out a privacy impact assessment that takes into account, among other things, the sensitivity of the information, the purposes for which it is used, the safeguards that apply, and the legal framework of the place where it will be held.\n'
    : ''
}`;
}
