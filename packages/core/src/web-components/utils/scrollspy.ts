/**
 * Which section of a table of contents is being read. Pure, so the rule is asserted without a
 * DOM (`scrollspy.test.ts`); `js/scrollspy.ts` is the wiring.
 *
 * `tops` are the targets' distances from the top of the viewport, in document order. The current
 * one is the last whose top has reached `offset` (the pinned masthead's height plus a little
 * slack) — the section the reader is inside. Before the first has reached it, nothing is
 * current, except at the very bottom of the page where the last is: a short final section can
 * never otherwise reach the offset.
 */
export function currentIndex(tops: readonly number[], offset: number, atBottom = false): number {
  if (tops.length === 0) return -1;
  if (atBottom) return tops.length - 1;
  let current = -1;
  for (let i = 0; i < tops.length; i++) if (tops[i]! <= offset) current = i;
  return current;
}
