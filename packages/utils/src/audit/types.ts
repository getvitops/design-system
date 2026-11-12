/** Shapes shared by the audit planner, the executor and the report renderers. */

export type AxeImpact = 'minor' | 'moderate' | 'serious' | 'critical';

export interface AuditBudgets {
  /** Largest Contentful Paint ceiling, ms. */
  lcpMs: number;
  /** Cumulative Layout Shift ceiling (unitless). */
  cls: number;
  /** Total Blocking Time ceiling, ms — the lab proxy for INP. */
  tbtMs: number;
  /** axe impacts that fail the page. Default: serious + critical. */
  blockingImpacts: AxeImpact[];
}

export interface AxeViolation {
  id: string;
  /** axe reports `null` impact for some incomplete rules; normalised to `moderate`. */
  impact: AxeImpact;
  help: string;
  helpUrl: string;
  /** Total nodes the rule failed on. */
  nodeCount: number;
  /** First few CSS selectors, for the report. */
  targets: string[];
}

export interface PageMetrics {
  /** `undefined` when Lighthouse could not compute it — which fails the page, not passes it. */
  lcpMs?: number | undefined;
  cls?: number | undefined;
  tbtMs?: number | undefined;
  /** Lighthouse category scores, 0-100. */
  scores: {
    performance?: number | undefined;
    seo?: number | undefined;
    bestPractices?: number | undefined;
  };
}

export interface BudgetFailure {
  kind: 'lcp' | 'cls' | 'tbt' | 'axe' | 'metric-missing' | 'page-error' | 'required-page-missing';
  message: string;
}

export type PageStatus = 'audited' | 'skipped' | 'error';

export interface PageResult {
  path: string;
  url: string;
  status: PageStatus;
  httpStatus?: number;
  /** Why a page was skipped or errored. */
  reason?: string;
  metrics?: PageMetrics;
  violations?: AxeViolation[];
  failures: BudgetFailure[];
}

/**
 * The accessibility target the audit was judged against (`site.accessibility`). Absent when the
 * site declared none, in which case the legacy default tags and gate apply. A recorded target is
 * a decision, never a conformance claim.
 */
export interface AuditTarget {
  standard: 'wcag20' | 'wcag21' | 'wcag22';
  level: 'none' | 'A' | 'AA' | 'AAA';
  /** Who accepted a lower target, when and why. Printed, never read for logic. */
  acceptedRisk?: string | undefined;
}

export type FormFactor = 'mobile' | 'desktop';

export interface AuditReport {
  generatedAt: string;
  baseUrl: string;
  formFactor: FormFactor;
  budgets: AuditBudgets;
  axeTags: string[];
  /** The declared target, when the site has one. */
  target?: AuditTarget | undefined;
  pages: PageResult[];
  /** True when no page has a failure. */
  passed: boolean;
  /** Always present: what a pass does and does not mean. */
  disclaimer: string;
  manualChecks: string[];
}
