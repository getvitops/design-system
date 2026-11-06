/**
 * Terms of use — Quebec.
 *
 * Generic website terms, like `terms.ca.ts`, and with the same deliberate
 * omissions (sales, subscriptions, user content, accounts, regulated advice).
 * Written separately because the Quebec framing is not a find-and-replace of the
 * common-law one: Quebec is a civil-law jurisdiction, where a limitation of
 * liability cannot reach intentional or gross fault or bodily or moral injury
 * (Civil Code of Québec, art. 1474), and consumer contracts carry non-waivable
 * protections under the Consumer Protection Act. A clause that said "to the
 * fullest extent permitted by law" and left it there would invite a reader to
 * assume more than the law allows us to claim; this one names the carve-outs.
 */
import type { PolicyVars } from '../derive.ts';
import { bullets, QC_REVIEW_NOTICE, REVIEW_NOTICE, updatedLine } from './shared.ts';

export function termsQc(v: PolicyVars): string {
  return `# Terms of Use
${updatedLine(v)}
${REVIEW_NOTICE}
${QC_REVIEW_NOTICE}

These terms govern your use of ${v.url || 'this website'} (the "Site"), operated by ${v.businessName} ("we", "us"). By using the Site you accept them. If you do not accept them, please do not use the Site.

We may revise these terms. The version published on the Site is the one that applies, and using the Site after a revision means you accept it.

## Using the Site

You may use the Site only for lawful purposes. You agree not to:

${bullets([
  'use the Site in a way that contravenes any law or regulation that applies to you or to us',
  'try to gain unauthorized access to the Site, its servers or any system connected to it',
  'interfere with the Site or disrupt it, including by introducing malicious code',
  'collect or harvest personal information about other visitors',
  'copy, redistribute or resell any part of the Site, except as these terms allow',
])}

We may suspend or restrict access to the Site, in whole or in part, at any time.

## Intellectual Property

Unless otherwise indicated, the content of the Site — its text, graphics, logos and layout — belongs to us or is used under licence, and is protected by copyright and other laws. You may view, download and print content for your own personal, non-commercial use. Any other use requires our prior written permission.

## Information on the Site

We take reasonable care to keep the Site accurate and current, but we do not guarantee that its content is complete or up to date. It is provided for general information and is not advice suited to your particular situation.

## Other Websites and Services

The Site may link to or depend on websites and services run by others. We do not control them and are not responsible for their content, availability or practices. A link is not an endorsement.

## Warranty and Liability

The Site is provided "as is" and "as available". Subject to the next paragraph, we give no warranty that it will be uninterrupted, secure or free of errors, and we are not liable for indirect or consequential damages arising from your use of the Site.

**Nothing in these terms excludes or limits our liability for our intentional or gross fault, for bodily or moral injury, or for anything else that the law of Quebec does not allow us to exclude or limit.** If you are a consumer, nothing in these terms deprives you of the rights and recourses the Consumer Protection Act gives you.

## Personal Information

How we handle personal information is described in our Privacy Policy, which is part of these terms.

## Governing Law

These terms are governed by the laws of ${governingLaw(v)}. Any dispute arising from them or from your use of the Site is subject to the jurisdiction of the courts of that jurisdiction, subject to any mandatory rule that gives you the right to bring a proceeding elsewhere.

## Contact

Questions about these terms can be sent to ${v.mailingAddress}.
`;
}

/**
 * The address decides, as in the `ca` terms, because that is the one fact the
 * config holds — but with no province to go on this falls back to Quebec rather
 * than to the country, since these are the Quebec terms.
 */
function governingLaw(v: PolicyVars): string {
  if (v.governingLaw) return v.governingLaw;
  const province = v.governingProvince ?? 'Quebec';
  return `${province} and the federal laws of Canada applicable therein`;
}
