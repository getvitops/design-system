/**
 * Pieces every legal template shares.
 *
 * Kept deliberately tiny: anything that grows here is prose leaking out of the
 * jurisdiction-specific templates into a shared file, which is how a document
 * ends up asserting something that isn't true of the body of law it claims to
 * follow. Formatting helpers belong here; sentences almost never do.
 */
import type { PolicyVars } from '../derive.ts';

/**
 * The banner every generated document opens with.
 *
 * Not optional and not configurable. These documents are rendered from a
 * template by a build tool, not drafted for a specific business by someone who
 * can be asked follow-up questions — and the one failure mode with real
 * consequences is a consumer publishing one as-is. It is a blockquote so it
 * renders as a callout in HTML and as a warning banner in EmDash.
 */
export const REVIEW_NOTICE =
  "> Generated from this site's configuration. It is a starting point, not legal advice — have it reviewed before you publish it, and make sure it matches what your site actually does.";

/** A markdown bullet list. Empty in, empty out — never a stray `-`. */
export function bullets(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

/**
 * Taken from config rather than the clock, so a rebuild of an unchanged config
 * produces a byte-identical document.
 */
export function updatedLine(v: Pick<PolicyVars, 'lastUpdated'>): string {
  return v.lastUpdated ? `\nLast updated: ${v.lastUpdated}\n` : '';
}
