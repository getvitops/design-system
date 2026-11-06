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

/**
 * The second banner the `qc` documents carry, after `REVIEW_NOTICE`.
 *
 * Quebec adds obligations a generic review prompt does not name, and each is a
 * thing this generator cannot check: that a person in charge of privacy has been
 * designated and is published, that a privacy impact assessment precedes any
 * communication outside Quebec, that consent mechanics match the Act, and — easy
 * to miss — that content directed at Quebec consumers is available in French. It
 * is a second blockquote (a second `vitops.banner` in Portable Text) so it cannot
 * be skimmed past as part of the first.
 */
export const QC_REVIEW_NOTICE =
  '> Quebec (Law 25): this document is written for the Quebec privacy regime and has NOT been reviewed by counsel. Before publishing, have a lawyer confirm that a person in charge of the protection of personal information is designated, that any transfer of information outside Quebec is preceded by a privacy impact assessment, that your consent and cookie mechanisms match the Act, and whether a French version is required for your audience. It is not legal advice.';

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
