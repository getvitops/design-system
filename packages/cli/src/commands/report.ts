/**
 * `vitops report` — draft (and, only when told to, file) an issue against the toolchain.
 *
 * The pure half is `../report.ts`; this file gathers facts, runs `gh`, and prints. The default
 * is a **draft**: it prints the redacted body, what was redacted, and a prefilled new-issue URL,
 * and files nothing. `--submit` files it, and still asks on a TTY — `--yes` is for an agent that
 * has already been told "yes" by the person, because the tracker is public and a client's repo is
 * not.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parse } from '../args.ts';
import {
  REPORT_PACKAGES,
  REPORT_REPO,
  REPORT_TYPES,
  issueLabels,
  prefilledIssueUrl,
  redact,
  renderIssueBody,
  sensitiveTerms,
  type ReportFacts,
  type ReportType,
} from '../report.ts';
import { fail, readJsonOrFail } from './shared.ts';

function gatherFacts(cwd: string): ReportFacts {
  const require = createRequire(join(cwd, 'package.json'));
  const versions: Record<string, string> = {};
  for (const name of REPORT_PACKAGES) {
    try {
      const manifest = require.resolve(`@getvitops/${name}/package.json`);
      versions[name] = (JSON.parse(readFileSync(manifest, 'utf8')) as { version: string }).version;
    } catch {
      // Not installed here, or its exports map hides package.json: simply absent.
    }
  }
  let dependencies: string[] = [];
  const pkgPath = join(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, Record<string, string>>;
    dependencies = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  }
  return {
    versions,
    node: process.versions.node,
    os: `${process.platform} ${process.arch}`,
    dependencies,
  };
}

function gh(args: string[]): string {
  try {
    return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: string };
    if (e.code === 'ENOENT') fail('report: the GitHub CLI (`gh`) is not installed or not on PATH');
    fail(`report: gh ${args[0]} failed: ${(e.stderr || e.message).trim()}`);
  }
}

function searchDuplicates(title: string): void {
  const out = gh([
    'search',
    'issues',
    '--repo',
    REPORT_REPO,
    '--limit',
    '8',
    '--json',
    'number,title,state,url',
    '--',
    title,
  ]);
  const hits = JSON.parse(out) as Array<{
    number: number;
    title: string;
    state: string;
    url: string;
  }>;
  if (hits.length === 0) {
    console.log('Possible duplicates: none found.\n');
    return;
  }
  console.log('Possible duplicates (check before filing):');
  for (const h of hits)
    console.log(`  #${h.number} [${h.state.toLowerCase()}] ${h.title}\n    ${h.url}`);
  console.log();
}

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await rl.question(`${question} [y/N] `)).trim());
  } finally {
    rl.close();
  }
}

export async function cmdReport(argv: string[]) {
  const a = parse(argv, {
    type: { type: 'string' },
    title: { type: 'string' },
    'body-file': { type: 'string' },
    package: { type: 'string' },
    format: { type: 'string' },
    platform: { type: 'string' },
    input: { type: 'string', short: 'i', default: 'site.json' },
    search: { type: 'boolean', default: false },
    submit: { type: 'boolean', default: false },
    yes: { type: 'boolean', default: false },
    'reported-by': { type: 'string' },
  });

  const type = a.opt('type') as ReportType | undefined;
  if (!type || !REPORT_TYPES.includes(type))
    fail(`report: --type must be ${REPORT_TYPES.join(' | ')}`);
  const title = a.opt('title')?.trim();
  if (!title) fail('report: --title is required');
  const bodyFile = a.opt('body-file');
  if (!bodyFile) fail('report: --body-file is required (the draft, in your own words)');
  if (!existsSync(bodyFile)) fail(`report: body file not found: ${bodyFile}`);
  const pkg = a.opt('package');
  if (pkg && !(REPORT_PACKAGES as readonly string[]).includes(pkg))
    fail(`report: --package must be one of ${REPORT_PACKAGES.join(', ')}`);

  // Redaction reads the site config if there is one; a project without one just gets the
  // generic patterns. A config that fails to parse is a reason to say so, not to skip silently.
  const input = a.str('input');
  const terms = existsSync(input) ? sensitiveTerms(readJsonOrFail(input, 'site config')) : [];

  const facts = gatherFacts(process.cwd());
  const draft = renderIssueBody({
    type,
    text: readFileSync(bodyFile, 'utf8'),
    facts,
    pkg,
    format: a.opt('format'),
    platform: a.opt('platform'),
    reportedBy: a.opt('reported-by'),
  });
  const cleanBody = redact(draft, terms);
  const cleanTitle = redact(title, terms);

  if (a.flag('search')) searchDuplicates(cleanTitle.text);

  console.log(`Title: ${cleanTitle.text}\nLabels: ${issueLabels(type).join(', ')}\n`);
  console.log(cleanBody.text);
  const replaced = [...cleanBody.replaced, ...cleanTitle.replaced];
  if (replaced.length > 0) {
    console.log(
      `Redacted: ${replaced.map((r) => `${r.count}× ${r.placeholder}`).join(', ')}. Read the draft above — redaction is a net, not a guarantee.\n`,
    );
  }

  if (!a.flag('submit')) {
    const { url, bodyIncluded } = prefilledIssueUrl(type, cleanTitle.text, cleanBody.text);
    console.log(`Nothing was filed. Open this to review and submit:\n${url}`);
    if (!bodyIncluded) console.log('\nThe body is too long to prefill; paste the draft above.');
    return;
  }

  if (!a.flag('yes') && !(await confirm(`File this publicly on ${REPORT_REPO}?`))) {
    fail(
      'report: not filed (confirm on a TTY, or pass --yes once the user has approved the draft)',
    );
  }
  const dir = mkdtempSync(join(tmpdir(), 'vitops-report-'));
  try {
    const file = join(dir, 'body.md');
    writeFileSync(file, cleanBody.text);
    const url = gh([
      'issue',
      'create',
      '--repo',
      REPORT_REPO,
      '--title',
      cleanTitle.text,
      '--body-file',
      file,
      '--label',
      issueLabels(type).join(','),
    ]).trim();
    console.log(`Filed: ${url}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
