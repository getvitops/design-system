/**
 * `vitops emdash schema diff|apply` — replay one EmDash instance's content model onto another's.
 *
 * A separate subpath (`@getvitops/utils/emdash-schema`), like `./hosting`: it is the only module
 * here that talks to a CMS's REST API. The layering is the usual one — `plan.ts` decides
 * everything and touches nothing, `client.ts` executes and decides nothing.
 */
export {
  diffSchema,
  formatPlan,
  formatPlanMarkdown,
  hasChanges,
  hasDrift,
  needsReview,
} from './plan.ts';
export type {
  DiffOptions,
  SchemaCollection,
  SchemaExport,
  SchemaField,
  SchemaNote,
  SchemaOp,
  SchemaPlan,
} from './plan.ts';

export { applyOps, checkTarget, fetchBlockTypeSlugs, fetchSchema } from './client.ts';
export type { ApiResult, ApiTarget, OpResult } from './client.ts';
