import * as z from '@zod/mini';
import { desc } from './desc.ts';

/**
 * `site.accessibility` — the accessibility **target** a site has chosen to be held to.
 *
 * This records a decision; it is not a claim of conformance and nothing here can make one. Automated
 * checks (axe, the generator's contrast gate) see only part of WCAG — keyboard flows, meaningful alt
 * text, caption accuracy, reading order and PDF tagging need a person — so "the build passes" never
 * means "the site conforms".
 *
 * Why it exists: clients differ. Some are bound by a statute that names a WCAG version and level
 * (Ontario's AODA is WCAG 2.0 AA); others knowingly run below it until something forces the issue,
 * e.g. a designer's mocks that miss contrast. The toolchain should enforce the first and report,
 * without blocking, the second — and the choice should be written down rather than implied by
 * whichever flag someone passed to `--warn` once.
 *
 * Which statute applies to which client is deliberately NOT encoded here (the laws change, and this
 * file would silently go stale). The `vitops-compliance` skills carry that, dated, and tell the
 * reader to re-check the primary source.
 */

export const WCAG_STANDARDS = ['wcag20', 'wcag21', 'wcag22'] as const;
export const WCAG_LEVELS = ['none', 'A', 'AA', 'AAA'] as const;

export type WcagStandard = (typeof WCAG_STANDARDS)[number];
export type WcagLevel = (typeof WCAG_LEVELS)[number];

export const AccessibilitySchema = z.strictObject({
  standard: desc(
    z.optional(z.enum(WCAG_STANDARDS)),
    'The WCAG version the target is measured against: `wcag20`, `wcag21` or `wcag22`. Default `wcag21`. Pick the version a statute or contract names (Ontario AODA names 2.0); a later version is a superset, so a higher choice is stricter, not different.',
  ),
  level: desc(
    z.optional(z.enum(WCAG_LEVELS)),
    'The minimum conformance level the site is held to: `none`, `A`, `AA` or `AAA`. Unset, `AA` and `AAA` make a WCAG 2 contrast-ratio miss fail the build; `A` and `none` only warn (contrast is an AA criterion). `vitops audit` runs the axe tags for the chosen standard and level and fails on violations, except at `none`, where they are reported and never fail the run. This records a target, not a claim of conformance.',
  ),
  contrastToggle: desc(
    z.optional(z.boolean()),
    'Set `true` when the site ships the high-contrast toggle (`<ContrastToggle />` / `.contrast-toggle`), WCAG technique G174: a visible control that switches to a conforming version. A baseline WCAG 2 contrast miss then only warns, provided the generated high-contrast layer (`prefers-contrast: more` / `data-contrast="more"`) itself reaches 4.5:1 text and 3:1 non-text. `vitops audit` checks the toggle is actually present. Default `false`: a miss fails the build at AA.',
  ),
  acceptedRisk: desc(
    z.optional(z.string().check(z.minLength(1))),
    'Free text recording who accepted a target below what applies to this site, when, and why (e.g. "Client accepted below AA until rebrand, per J. Smith, 2026-11-11"). Printed in the audit report header. Never read for logic.',
  ),
});

export type AccessibilityConfig = z.infer<typeof AccessibilitySchema>;

/** The default when `site.accessibility` is absent or omits `standard`. */
export const DEFAULT_WCAG_STANDARD: WcagStandard = 'wcag21';
