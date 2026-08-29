/**
 * The end-of-run summary table shared by `onboarding/plan.ts`'s and `ads/plan.ts`'s
 * `formatSummary` — same header row, same column padding, same "Reminders
 * (manual — no API):" tail. Their `StepAction`/`StepPlan`/`formatPlan` glyph
 * renderers stay separate: onboarding's steps are `create | update | skip`
 * with no `blocked` state, ads' are `create | skip | blocked` with a `needs`
 * field, and collapsing those two shapes into one would blur a real
 * difference rather than remove duplication.
 */
const pad = (s: string, n: number) => s.padEnd(n);

/** Render a fixed-width table, then a "Reminders" section if any were passed. */
export function table(headers: string[], rows: string[][], reminders: string[]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => row[i]?.length ?? 0)),
  );
  const line = (cells: string[]) =>
    cells
      .map((c, i) => pad(c, widths[i] ?? 0))
      .join('  ')
      .trimEnd();

  const out = [line(headers), widths.map((w) => '─'.repeat(w)).join('  ')];
  for (const row of rows) out.push(line(row));
  if (reminders.length) out.push('', 'Reminders (manual — no API):', ...reminders);
  return out.join('\n');
}
