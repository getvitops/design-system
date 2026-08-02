/**
 * Generate a site's legal documents from its config.
 *
 * Shaped after `generateDocs` rather than after a `generate()` format, and the
 * reason is structural: `generate()` is keyed to a **`DesignSystem`**, while a
 * privacy policy renders from a **`SiteConfig`**. Bolting it on as a `Format`
 * would mean a format that ignores its own input. So this is a sibling public
 * function that returns a `{ relPath: content }` map and lets each caller write
 * it where it belongs — the CLI to stdout or a directory, the bricks build into
 * `dist/legal/`, the Astro integration into a content collection.
 *
 * Pure: no filesystem, no clock, no shared state.
 */
import { derivePolicyVars, type PolicyVars } from './derive.ts';
import { parseMarkdown, toContentNodes, toHtmlFragment, toPortableText } from './render.ts';
import { DOC_ORDER, DOC_SLUGS, TEMPLATES, type LegalDoc } from './templates/index.ts';
import type { SiteConfig } from '../site.ts';
import type { ContentNode } from '@getvitops/utils';

export type LegalOutput = 'md' | 'html' | 'portable-text';

export interface GenerateLegalOptions {
  /** Which documents to render. Defaults to those enabled in the config. */
  docs?: LegalDoc[];
  /** Output format. Default `md`. */
  output?: LegalOutput;
}

const EXT: Record<LegalOutput, string> = {
  md: 'md',
  html: 'html',
  'portable-text': 'json',
};

/** Which documents the config asks for, in a stable order. */
export function enabledDocs(site: SiteConfig): LegalDoc[] {
  const legal = site.legal;
  const on: Record<LegalDoc, boolean> = {
    privacy: !!legal?.privacyPolicy?.enabled,
    terms: !!legal?.termsOfService?.enabled,
    cookies: !!legal?.cookieConsent?.enabled,
  };
  return DOC_ORDER.filter((d) => on[d]);
}

/** Render one document to markdown. The other outputs derive from this. */
export function renderMarkdown(site: SiteConfig, doc: LegalDoc, vars?: PolicyVars): string {
  const jurisdiction = site.legal?.jurisdiction ?? 'ca';
  // `validateSite` rejects an unregistered jurisdiction, so this is a guard for
  // callers that skipped validation rather than an expected path.
  const set = TEMPLATES[jurisdiction];
  if (!set) throw new Error(`no legal templates for jurisdiction "${jurisdiction}"`);
  return set[doc](vars ?? derivePolicyVars(site));
}

/**
 * Render one document as a `ContentNode` tree — the framework-agnostic shape the
 * site config already uses for `templates` of type `nodes`, so an Astro consumer
 * can hand it to `NodeRenderer` instead of injecting a string of HTML.
 */
export function renderNodes(site: SiteConfig, doc: LegalDoc): ContentNode[] {
  return toContentNodes(parseMarkdown(renderMarkdown(site, doc)));
}

/**
 * Every enabled legal document, keyed by output path.
 *
 * Documents are keyed by filename (`privacy-policy.md`) rather than by document
 * id so a caller can write the map verbatim.
 */
export function generateLegal(
  site: SiteConfig,
  opts: GenerateLegalOptions = {},
): Record<string, string> {
  const output = opts.output ?? 'md';
  const docs = opts.docs ?? enabledDocs(site);
  // Derived once: every document asserts the same facts, and re-deriving per
  // document would let them disagree if the derivation ever stopped being pure.
  const vars = derivePolicyVars(site);

  const out: Record<string, string> = {};
  for (const doc of docs) {
    const md = renderMarkdown(site, doc, vars);
    const slug = DOC_SLUGS[doc];
    const content =
      output === 'md'
        ? md
        : output === 'html'
          ? toHtmlFragment(parseMarkdown(md))
          : JSON.stringify(toPortableText(parseMarkdown(md), slug), null, 2) + '\n';
    out[`${slug}.${EXT[output]}`] = content;
  }
  return out;
}

export { derivePolicyVars, type PolicyVars } from './derive.ts';
export { detectProcessorKeys, KNOWN_PROCESSORS, resolveProcessors } from './providers.ts';
export type { KnownProcessorKey, Processor } from './providers.ts';
export { parseMarkdown, toContentNodes, toHtmlFragment, toPortableText } from './render.ts';
export type { Block, Span } from './render.ts';
export { DOC_ORDER, DOC_SLUGS, TEMPLATES } from './templates/index.ts';
export type { DocSet, LegalDoc } from './templates/index.ts';
