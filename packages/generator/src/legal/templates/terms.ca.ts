/**
 * Terms of service — Canada.
 *
 * Unlike the privacy policy, this has no prototype in the repo to port: the
 * prose is new. It is written as **generic website terms** — the clauses almost
 * every informational site needs (acceptable use, intellectual property,
 * disclaimer, limitation of liability, governing law) and nothing more.
 *
 * It deliberately does NOT cover the things that actually vary between
 * businesses and carry the most risk: sales and refunds, subscriptions and
 * renewals, user-generated content and its moderation, accounts and
 * termination, professional advice, or anything sector-regulated. A site doing
 * any of those needs clauses drafted for it — the review banner says so, and
 * this file should not grow them, because a template that half-covers payments
 * is more dangerous than one that visibly omits them.
 */
import type { PolicyVars } from '../derive.ts';
import { bullets, REVIEW_NOTICE, updatedLine } from './shared.ts';

export function termsCa(v: PolicyVars): string {
  return `# Terms of Service
${updatedLine(v)}
${REVIEW_NOTICE}

These terms govern your use of ${v.url} (the "Site"), operated by ${v.businessName} ("we", "us"). By accessing or using the Site, you agree to these terms. If you do not agree to them, please do not use the Site.

We may change these terms from time to time. The version published on the Site is the one that applies, and your continued use of the Site after a change means you accept the revised terms.

## Use of the Site

You may use the Site for lawful purposes only. You agree not to:

${bullets([
  'use the Site in any way that breaches any applicable law or regulation',
  'attempt to gain unauthorized access to the Site, its servers, or any connected system',
  'interfere with or disrupt the operation of the Site, including by introducing malicious code',
  'collect or harvest information about other users of the Site',
  'reproduce, duplicate, or resell any part of the Site except as these terms permit',
])}

We may suspend or withdraw access to the Site, in whole or in part, at any time and without notice.

## Intellectual Property

Unless stated otherwise, the content of the Site — including text, graphics, logos, and layout — is owned by or licensed to us and is protected by copyright and other intellectual property laws. You may view, download, and print content from the Site for your own personal, non-commercial use. Any other use requires our prior written permission.

## Accuracy of Information

We take reasonable care to keep the Site accurate and current, but we make no representation or warranty that the content is complete, accurate, or up to date. Content on the Site is provided for general information only and should not be relied on as advice for your particular circumstances.

## Third Party Links and Services

The Site may link to, or rely on, websites and services operated by others. We do not control those sites and services and are not responsible for their content, availability, or practices. A link is not an endorsement.

## Disclaimer

**The Site is provided "as is" and "as available", without warranty of any kind, whether express or implied.** To the fullest extent permitted by law, we disclaim all warranties, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Site will be uninterrupted, secure, or error free.

## Limitation of Liability

**To the fullest extent permitted by law, we will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, revenue, data, or goodwill, arising out of or in connection with your use of the Site** — whether the claim is based in contract, tort, or any other legal theory, and whether or not we were advised of the possibility of such damages.

Nothing in these terms excludes or limits liability that cannot be excluded or limited under applicable law.

## Privacy

Our handling of personal information is described in our Privacy Policy, which forms part of these terms.

## Governing Law

These terms are governed by the laws of ${governingLaw(v)}. You agree to the exclusive jurisdiction of the courts of that jurisdiction for any dispute arising out of or in connection with these terms or the Site.

## Contact

If you have questions about these terms, please contact us at ${v.mailingAddress}.
`;
}

/**
 * Canadian law is split between the provinces and the federal Parliament, so the
 * conventional clause names both. Without a province we can only name the
 * country — better a broader clause than one asserting a province we guessed.
 */
function governingLaw(v: PolicyVars): string {
  if (v.governingLaw) return v.governingLaw;
  return v.governingProvince
    ? `${v.governingProvince} and the federal laws of ${v.governingCountry} applicable therein`
    : v.governingCountry;
}
