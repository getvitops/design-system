/**
 * Cookie notice — Quebec.
 *
 * The cookie list itself is the same derived fact as in the `ca` notice, so the
 * "which cookies, from whom" blocks are shared with it (`providersSection`,
 * `categoriesSection`) — that part carries no jurisdiction. What is Quebec's own
 * is the frame around it: section 8.1 of the Act requires telling a visitor when
 * a technology can identify, locate or profile them, and offering to activate the
 * profiling functions rather than activating them by default.
 */
import type { PolicyVars } from '../derive.ts';
import { categoriesSection, providersSection } from './cookies.ca.ts';
import { bullets, QC_REVIEW_NOTICE, REVIEW_NOTICE, updatedLine } from './shared.ts';

export function cookiesQc(v: PolicyVars): string {
  return `# Cookie Notice
${updatedLine(v)}
${REVIEW_NOTICE}
${QC_REVIEW_NOTICE}

This notice explains how ${v.businessName} uses cookies and similar technologies on ${v.url || 'this website'} (the "Site"). It supplements our Privacy Policy, which sets out your rights under Quebec's Act respecting the protection of personal information in the private sector.

## What Cookies Are

A cookie is a small text file that a website asks your browser to store. Cookies let a site remember things between pages and visits. Similar technologies, such as local storage, do the same.

## What We Use Them For

${bullets(v.cookiePurposes)}

They may record:

${bullets(v.cookieTracked)}

${consentSection(v)}${providersSection(v)}${categoriesSection(v)}
## Your Choices

${bullets(v.cookieOptOutOptions)}

Most browsers let you see the cookies stored, delete them one by one or all at once, and block them. Blocking every cookie will stop parts of the Site from working as intended.

## Contact

Questions about cookies, or a request concerning your personal information, can be sent to ${v.mailingAddress}. If you are not satisfied with our response you may contact the Commission d'accès à l'information du Québec (www.cai.gouv.qc.ca).
`;
}

/**
 * Only when something on the Site can actually identify or profile a visitor —
 * a notice that announced profiling technology the config does not enable would
 * be a false statement in the other direction.
 */
function consentSection(v: PolicyVars): string {
  if (v.trackingTechnologies.length === 0) return '';
  const assurance =
    v.consentModel === 'opt-in'
      ? 'These are not activated until you choose to allow them using the consent controls on the Site. You can change your choice at any time.'
      : v.consentModel === 'opt-out'
        ? 'You can deactivate them at any time using the consent controls on the Site.'
        : 'You can block them through your browser settings.';
  return `## Technologies That Can Identify, Locate or Profile You

Some technologies on this Site can identify you, or collect information about your behaviour in order to profile you:

${bullets(v.trackingTechnologies)}

${assurance}

`;
}
