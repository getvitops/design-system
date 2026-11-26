/**
 * `vitops report` — the pure half: what an issue against the toolchain says, and what it must not.
 *
 * Downstream agents work inside a client's repo; the issue tracker they report to is public. So
 * the load-bearing job here is **redaction**: a draft written beside a client's `vitops.json` can
 * carry that client's name, domains, contact details, or a token pasted from an error. Nothing in
 * this file touches the network, the filesystem or `gh` (see `commands/report.ts`), so what a run
 * would publish can be asserted exactly.
 *
 * The headings in `FORM_FIELDS` mirror the labels in `.github/ISSUE_TEMPLATE/*.yml` field for
 * field (`report.test.ts` reads the forms and fails on drift), so the triage bot parses one shape
 * whether an issue came from the web form or from this command.
 */

export const REPORT_TYPES = ['bug', 'deprecation', 'improvement'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_PACKAGES = [
  'core',
  'generator',
  'utils',
  'cli',
  'vite',
  'astro',
  'config',
  'create',
  'skills',
  'emdash',
] as const;

export const REPORT_REPO = 'getvitops/design-system';

/** The GitHub label each type carries, beside `agent-report` and `triage:new`. */
export const TYPE_LABEL: Record<ReportType, string> = {
  bug: 'bug',
  deprecation: 'deprecation',
  improvement: 'enhancement',
};

const NO_RESPONSE = '_No response_';

const COMMON_FIELDS = ['Toolchain version', 'Affected package', 'Output format', 'Platform'];

/** Issue-form field labels per type, in render order. `Reported by` always closes the body. */
export const FORM_FIELDS: Record<ReportType, readonly string[]> = {
  bug: [...COMMON_FIELDS, 'What happened', 'Expected behaviour', 'Reproduction', 'Reported by'],
  deprecation: [
    ...COMMON_FIELDS,
    'What is deprecated',
    'What should replace it',
    'Reproduction',
    'Reported by',
  ],
  improvement: [...COMMON_FIELDS, 'Problem or opportunity', 'Proposal', 'Reported by'],
};

/** The field the `--body-file` text fills when it carries no `###` headings of its own. */
export const PRIMARY_FIELD: Record<ReportType, string> = {
  bug: 'What happened',
  deprecation: 'What is deprecated',
  improvement: 'Problem or opportunity',
};

// ── redaction ───────────────────────────────────────────────────────────────────────────────

export interface RedactTerm {
  /** Literal text to find, case-insensitively. */
  term: string;
  /** What it becomes. */
  placeholder: string;
}

export interface Replacement {
  placeholder: string;
  count: number;
}

export interface Redacted {
  text: string;
  replaced: Replacement[];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Generic shapes that are sensitive wherever they appear, config or not. Order matters. */
const GENERIC: ReadonlyArray<{ re: RegExp; placeholder: string }> = [
  { re: /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, placeholder: 'Bearer <token>' },
  { re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, placeholder: '<jwt>' },
  { re: /\bsk-[A-Za-z0-9_-]{16,}/g, placeholder: '<token>' },
  { re: /\bgh[pousr]_[A-Za-z0-9]{20,}/g, placeholder: '<token>' },
  { re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+\b/g, placeholder: '<email>' },
  { re: /\/(?:home|Users)\/[^/\s'"`:]+\//g, placeholder: '~/' },
  { re: /[A-Za-z]:\\Users\\[^\\\s'"`:]+\\/g, placeholder: '~\\' },
  { re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, placeholder: '<ip>' },
];

/**
 * Replace config-derived terms first (longest first, so `acme.ca/about` goes before `acme.ca`),
 * then the generic shapes. Returns what changed so the human can see it before anything is
 * published — a silent redaction is one nobody can check.
 */
export function redact(text: string, terms: readonly RedactTerm[] = []): Redacted {
  const counts = new Map<string, number>();
  const bump = (placeholder: string, n: number) =>
    counts.set(placeholder, (counts.get(placeholder) ?? 0) + n);
  let out = text;

  const ordered = [...terms]
    .filter((t) => t.term.length > 0)
    .sort((a, b) => b.term.length - a.term.length);
  for (const { term, placeholder } of ordered) {
    out = out.replace(new RegExp(escapeRe(term), 'gi'), () => {
      bump(placeholder, 1);
      return placeholder;
    });
  }
  for (const { re, placeholder } of GENERIC) {
    out = out.replace(re, () => {
      bump(placeholder, 1);
      return placeholder;
    });
  }
  return {
    text: out,
    replaced: [...counts].map(([placeholder, count]) => ({ placeholder, count })),
  };
}

/** Keys under `organization` whose values are vocabulary, not identity — redacting them mangles a report. */
const VOCABULARY_KEYS = new Set([
  'type',
  'country',
  'region',
  'currency',
  'language',
  'locale',
  'locales',
  'platform',
  'provider',
  'kind',
  'enabled',
]);

const MIN_TERM = 4;

function collectStrings(value: unknown, out: string[], skipKeys: ReadonlySet<string>): void {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out, skipKeys);
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) {
      if (!skipKeys.has(k)) collectStrings(v, out, skipKeys);
    }
}

/** A URL contributes its bare host as well, since a report quotes the host as often as the URL. */
function withHost(s: string): string[] {
  try {
    const u = new URL(s);
    return u.host ? [s, u.host] : [s];
  } catch {
    return [s];
  }
}

/**
 * The client-identifying strings in a site config, read **loosely from the raw object** — not
 * through `resolveConfig`, because a report is most often written when the config is the thing
 * that is broken, and a loader that exits on an invalid config would make redaction unavailable
 * exactly then. Over-redacting is the safe direction (the replacement list shows what changed).
 */
export function sensitiveTerms(config: unknown): RedactTerm[] {
  if (!config || typeof config !== 'object') return [];
  const root = config as Record<string, unknown>;
  const site = (root.site && typeof root.site === 'object' ? root.site : {}) as Record<
    string,
    unknown
  >;

  const buckets: Array<[unknown, string, ReadonlySet<string>]> = [
    [root.organization, '<organization>', VOCABULARY_KEYS],
    [site.domains, '<domain>', new Set()],
    [site.environments, '<env-url>', VOCABULARY_KEYS],
  ];

  const terms: RedactTerm[] = [];
  const seen = new Set<string>();
  for (const [value, placeholder, skip] of buckets) {
    const strings: string[] = [];
    collectStrings(value, strings, skip);
    for (const s of strings.flatMap(withHost)) {
      const term = s.trim();
      const key = term.toLowerCase();
      if (term.length < MIN_TERM || seen.has(key)) continue;
      seen.add(key);
      terms.push({ term, placeholder });
    }
  }
  return terms;
}

// ── facts ───────────────────────────────────────────────────────────────────────────────────

export interface ReportFacts {
  /** `@getvitops/<name>` → installed version, for those that resolved. */
  versions: Record<string, string>;
  node: string;
  os: string;
  /** Dependency names found in the project's package.json. */
  dependencies: readonly string[];
}

export function detectPlatform(deps: readonly string[]): string {
  if (deps.includes('emdash') || deps.includes('@getvitops/emdash')) return 'EmDash';
  if (deps.includes('astro')) return 'Static Astro';
  return 'Other';
}

export function formatVersions(facts: ReportFacts): string {
  const names = Object.keys(facts.versions).sort();
  if (names.length === 0) return `${NO_RESPONSE} (no @getvitops/* package resolved from here)`;
  return names.map((n) => `- @getvitops/${n} ${facts.versions[n]}`).join('\n');
}

// ── rendering ───────────────────────────────────────────────────────────────────────────────

export interface BodyInput {
  type: ReportType;
  /** The reporter's text. With no `###` headings it becomes the type's primary field. */
  text: string;
  facts: ReportFacts;
  pkg?: string | undefined;
  format?: string | undefined;
  platform?: string | undefined;
  reportedBy?: string | undefined;
}

/** Split `### Heading` sections out of free text; anything before the first heading is `lead`. */
export function parseSections(text: string): { lead: string; sections: Map<string, string> } {
  const sections = new Map<string, string>();
  const parts = text.split(/^###\s+(.+?)\s*$/m);
  const lead = (parts[0] ?? '').trim();
  for (let i = 1; i < parts.length; i += 2) sections.set(parts[i]!, (parts[i + 1] ?? '').trim());
  return { lead, sections };
}

/**
 * Render the issue body with exactly the `### <label>` headings the issue form produces. A field
 * the reporter left empty reads `_No response_`, GitHub's own convention for an empty form field.
 */
export function renderIssueBody(input: BodyInput): string {
  const { type, facts } = input;
  const { lead, sections } = parseSections(input.text);
  const fields = FORM_FIELDS[type];

  const values = new Map<string, string>(sections);
  if (lead) {
    const primary = PRIMARY_FIELD[type];
    values.set(primary, values.has(primary) ? `${lead}\n\n${values.get(primary)}` : lead);
  }
  // Facts we can gather win over a guess, but never over what the reporter wrote.
  const fact = (label: string, v: string | undefined) => {
    if (v && !values.get(label)) values.set(label, v);
  };
  fact('Toolchain version', formatVersions(facts));
  fact('Affected package', input.pkg);
  fact('Output format', input.format);
  fact('Platform', input.platform ?? detectPlatform(facts.dependencies));
  fact('Reported by', input.reportedBy ?? 'agent');

  const env = `Node ${facts.node} on ${facts.os}`;
  const blocks = fields.map((label) => `### ${label}\n\n${values.get(label) || NO_RESPONSE}`);
  blocks.splice(1, 0, `### Environment\n\n${env}`);
  return `${blocks.join('\n\n')}\n`;
}

// ── submission ──────────────────────────────────────────────────────────────────────────────

export function issueLabels(type: ReportType): string[] {
  return ['agent-report', 'triage:new', TYPE_LABEL[type]];
}

/** Past this, a prefilled URL risks a 414 from GitHub or a browser, so the body travels separately. */
export const MAX_URL_BODY = 6000;

export interface PrefilledUrl {
  url: string;
  /** False when the body was too long to prefill: the reader must paste it. */
  bodyIncluded: boolean;
}

export function prefilledIssueUrl(type: ReportType, title: string, body: string): PrefilledUrl {
  const base = `https://github.com/${REPORT_REPO}/issues/new`;
  const q = (extra: Record<string, string>) =>
    `${base}?${new URLSearchParams({ title, labels: issueLabels(type).join(','), ...extra })}`;
  const encoded = encodeURIComponent(body);
  return encoded.length > MAX_URL_BODY
    ? { url: q({}), bodyIncluded: false }
    : { url: q({ body }), bodyIncluded: true };
}
