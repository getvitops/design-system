/**
 * Which onboarding steps a draft has finished, derived from the draft itself.
 *
 * Nothing is stored. Progress that lived in its own column could say "done" about a draft since
 * edited into something invalid; validating the step's own paths on every read cannot disagree with
 * the document.
 */
import { pathsOf, projectionById } from './projections.ts';
import { pickSchema, setPath, valueAt, type JsonObject, type JsonSchema } from './json-schema.ts';
import type { OnboardingStep } from './steps.ts';
import { validateAgainstSchema, type ValidationIssue } from './validate.ts';

/**
 * - `complete`: every required field of the step is present and valid.
 * - `incomplete`: nothing is wrong, but a required field is missing.
 * - `invalid`: a value breaks the schema.
 * - `empty`: an optional step with nothing entered. Not a problem, and not "complete" either.
 */
export type StepStatus = 'complete' | 'incomplete' | 'invalid' | 'empty';

export interface StepReport {
  step: string;
  status: StepStatus;
  issues: ValidationIssue[];
}

/** The config paths a step reads. */
export function stepPaths(step: OnboardingStep): string[] {
  return step.projections.flatMap((id) => {
    const projection = projectionById(id);
    return projection ? pathsOf(projection) : [];
  });
}

/** The part of `draft` that sits under `paths`. */
function pickValue(draft: unknown, paths: readonly string[]): JsonObject {
  const out: JsonObject = {};
  for (const path of paths) {
    const value = valueAt(draft, path);
    if (value !== undefined) setPath(out, path, value as never);
  }
  return out;
}

export function stepStatus(step: OnboardingStep, draft: unknown, schema: JsonSchema): StepReport {
  if (step.review) return { step: step.id, status: 'complete', issues: [] };
  const paths = stepPaths(step);
  const picked = pickValue(draft, paths);
  const issues = validateAgainstSchema(pickSchema(schema, paths), picked, { root: schema });

  if (Object.keys(picked).length === 0 && step.optional) {
    return { step: step.id, status: 'empty', issues: [] };
  }
  if (issues.length === 0) {
    // Nothing broke, but a step that asks for something and got nothing is not finished.
    const status = Object.keys(picked).length === 0 && !step.optional ? 'incomplete' : 'complete';
    return { step: step.id, status, issues };
  }
  const onlyMissing = issues.every((issue) => issue.message === 'Required.');
  return { step: step.id, status: onlyMissing ? 'incomplete' : 'invalid', issues };
}

export function allStepStatuses(
  steps: readonly OnboardingStep[],
  draft: unknown,
  schema: JsonSchema,
): StepReport[] {
  return steps.map((step) => stepStatus(step, draft, schema));
}
