/**
 * Config → the facts the accessibility statement asserts.
 *
 * Same division as `derive.ts`: **the config records facts, the template owns prose.** What lives
 * here is selection and normalisation, never a sentence a reviewer would read. And the same rule that
 * governs the rest of `legal/`: a fact the config cannot know is never asserted. So every field below
 * is `undefined`, empty or `false` unless the config said otherwise, and the template prints a
 * sentence only for a fact that is present. That is why nothing here has a default for
 * `conformance`, `testedOn`, `testedWith` or the policy documents: a default would be a claim.
 *
 * `site.accessibility.acceptedRisk` is read by no one in this module. It records who accepted a
 * lower target and why; it is internal, and publishing it would be a leak.
 */
import { resolveAccessibilityContact, type Config } from '../config.ts';

export type StatementLevel = 'none' | 'A' | 'AA' | 'AAA';

export interface AccessibilityVars {
  /** `WCAG 2.1`, from `site.accessibility.standard` (default `wcag21`). */
  standardLabel: string;
  /** `site.accessibility.level`, default `AA`. `none` means no formal target. */
  level: StatementLevel;
  /** Names the statute; undefined prints no statutory wording. */
  law: 'aoda' | undefined;
  /** Legally required to conform. */
  mandatory: boolean;
  /** Undefined means no conformance claim is made. */
  conformance: 'full' | 'partial' | undefined;
  testedOn: string | undefined;
  /** Methods, as `ACCESSIBILITY_TESTING` keys, in a stable order. */
  testing: string[];
  auditor: string | undefined;
  limitations: { content: string; issue: string; alternative?: string; plannedFix?: string }[];
  /** Present only when the config states what was tested. */
  testedBrowsers: string[];
  testedAssistiveTech: string[];
  formats: string[];
  supports: string[];
  inPerson: string | undefined;
  responseDays: number | undefined;
  contact: { email?: string; phone?: string; address?: string };
  feedbackUrl: string | undefined;
  feedbackOwner: string | undefined;
  policies: { title: string; url?: string }[];
  policiesOnRequest: boolean;
  reviewCadence: 'annually' | 'semi-annually' | 'quarterly' | undefined;
  /** `site.accessibility.contrastToggle`: the site ships the high-contrast control. */
  contrastToggle: boolean;
  lastUpdated: string | undefined;
}

const STANDARD_LABEL = { wcag20: 'WCAG 2.0', wcag21: 'WCAG 2.1', wcag22: 'WCAG 2.2' } as const;

/** One line, for a mailing-address bullet. */
function oneLineAddress(
  a:
    | {
        streetAddress?: string | undefined;
        addressLocality: string;
        addressRegion?: string | undefined;
        postalCode?: string | undefined;
        addressCountry: string;
      }
    | undefined,
): string | undefined {
  if (!a) return undefined;
  return [
    a.streetAddress,
    a.addressLocality,
    [a.addressRegion, a.postalCode].filter(Boolean).join(' '),
    a.addressCountry,
  ]
    .filter(Boolean)
    .join(', ');
}

/** Facts for the statement. Pure; reads only `site.accessibility`, the statement block and the org. */
export function deriveAccessibilityVars(cfg: Config): AccessibilityVars {
  const st = cfg.site.legal?.accessibilityStatement;
  const target = cfg.site.accessibility;
  const contact = resolveAccessibilityContact(cfg);
  const order = ['automated', 'keyboard', 'screen-reader', 'external-audit'];

  return {
    standardLabel: STANDARD_LABEL[target?.standard ?? 'wcag21'],
    level: target?.level ?? 'AA',
    law: st?.law,
    mandatory: st?.mandatory === true,
    conformance: st?.conformance,
    testedOn: st?.testedOn,
    testing: [...(st?.testing ?? [])].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    auditor: st?.auditor,
    limitations: (st?.limitations ?? []).map((l) => ({
      content: l.content,
      issue: l.issue,
      ...(l.alternative != null ? { alternative: l.alternative } : {}),
      ...(l.plannedFix != null ? { plannedFix: l.plannedFix } : {}),
    })),
    testedBrowsers: st?.testedWith?.browsers ?? [],
    testedAssistiveTech: st?.testedWith?.assistiveTech ?? [],
    formats: st?.formats ?? [],
    supports: st?.supports ?? [],
    inPerson: st?.inPerson,
    responseDays: st?.responseDays,
    contact: {
      ...(contact?.email != null ? { email: contact.email } : {}),
      ...(contact?.phone != null ? { phone: contact.phone } : {}),
      ...(oneLineAddress(contact?.address) != null
        ? { address: oneLineAddress(contact?.address)! }
        : {}),
    },
    feedbackUrl: st?.feedbackUrl,
    feedbackOwner: st?.feedbackOwner,
    policies: (st?.policies ?? []).map((p) => ({
      title: p.title,
      ...(p.url != null ? { url: p.url } : {}),
    })),
    policiesOnRequest: st?.policiesOnRequest === true,
    reviewCadence: st?.reviewCadence,
    contrastToggle: target?.contrastToggle === true,
    lastUpdated: st?.lastUpdated,
  };
}
