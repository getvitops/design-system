/**
 * Cookie notice — Canada.
 *
 * The one document here that is almost entirely derived: which cookies a site
 * sets follows from which providers it uses, and the config already knows that.
 * The prose is a frame around `v.processors` and `v.cookieCategories`.
 *
 * Rendered as headings and bullets rather than a table, deliberately — the
 * markdown subset the renderer supports is closed, and a table would widen it
 * for one document. Bullets also survive a narrow viewport, which a four-column
 * cookie table does not.
 */
import { list, type PolicyVars } from '../derive.ts';
import { bullets, REVIEW_NOTICE, updatedLine } from './shared.ts';

export function cookiesCa(v: PolicyVars): string {
  return `# Cookie Notice
${updatedLine(v)}
${REVIEW_NOTICE}

This notice explains how ${v.businessName} uses cookies and similar technologies on ${v.url} (the "Site"). It supplements our Privacy Policy.

## What Cookies Are

A cookie is a small text file that a website asks your browser to store. Cookies let a site remember things between pages and between visits — for example, that you have already dismissed a message. Similar technologies, such as local storage, do much the same thing.

## What We Use Them For

${bullets(v.cookiePurposes)}

Cookies used on this Site may track:

${bullets(v.cookieTracked)}

${providersSection(v)}${categoriesSection(v)}
## Your Choices

${bullets(v.cookieOptOutOptions)}

Most browsers let you see which cookies are stored, delete them individually or in bulk, and block them entirely. Blocking all cookies will stop parts of the Site from working as intended.

## Contact

If you have questions about our use of cookies, please contact us at ${v.mailingAddress}.
`;
}

/**
 * "This site sets no cookies" is a real and increasingly common answer — a
 * cookieless analytics provider is a selling point, not an omission. Saying it
 * plainly beats an empty section that reads as an oversight.
 */
function providersSection(v: PolicyVars): string {
  const setting = v.processors.filter((p) => p.cookies?.length);
  const cookieless = v.processors.filter((p) => p.cookies?.length === 0);

  if (setting.length === 0) {
    const named = cookieless.length
      ? ` The third party ${cookieless.length === 1 ? 'service' : 'services'} we use on this Site — ${list(
          cookieless.map((p) => p.name),
        )} — ${cookieless.length === 1 ? 'does' : 'do'} not set cookies of ${
          cookieless.length === 1 ? 'its' : 'their'
        } own.`
      : '';
    return `## Cookies Set on This Site

Beyond the cookies strictly necessary to serve and secure the Site, we do not set cookies.${named}
`;
  }

  return `## Cookies Set on This Site

${bullets(
  setting.map(
    (p) =>
      // Cookie names go in code spans, not bare: `_ga, _gid` in running markdown
      // is a matched pair of underscores, which a downstream renderer turns into
      // emphasis and eats the names.
      `**${p.name}** (${p.purpose}) — ${(p.cookies ?? []).map((c) => `\`${c}\``).join(', ')}${
        p.privacyUrl ? `. Privacy policy: ${p.privacyUrl}` : ''
      }`,
  ),
)}
${
  cookieless.length
    ? `\nWe also use ${list(cookieless.map((p) => p.name))}, which ${
        cookieless.length === 1 ? 'does' : 'do'
      } not set cookies of ${cookieless.length === 1 ? 'its' : 'their'} own.\n`
    : ''
}`;
}

/** Only meaningful when a consent tool actually offers the categories. */
function categoriesSection(v: PolicyVars): string {
  if (v.consentModel === 'none' || v.cookieCategories.length === 0) return '';
  return `
## Cookie Categories

Our consent controls group cookies into the following categories, which you can accept or decline${
    v.consentModel === 'opt-in'
      ? ' before any non-essential cookie is set'
      : ' at any time after your first visit'
  }:

${bullets(v.cookieCategories)}
`;
}
