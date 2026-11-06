/**
 * Content-Security-Policy helpers for the inline scripts `<Head />` emits.
 *
 * `<Head />` writes up to two inline `<script>`s into every page: the pre-paint
 * colour-scheme bootstrap and the consent-gate stub. A policy without
 * `'unsafe-inline'` blocks both unless each is named by hash, and both are
 * constants (`inline-scripts.ts`), so their hashes are fixed per package version
 * and can sit in a static `_headers` file — which is exactly what the scaffolded
 * templates do, in `Content-Security-Policy-Report-Only` mode.
 *
 * Why hashes and not nonces: a nonce is per response, so it needs the page to be
 * rendered by a Worker on every request. The templates' pages are prerendered
 * static assets, which have no request to attach a nonce to. Hashes also survive
 * being cached.
 *
 * What this does NOT cover, and the policy says so rather than hiding it: scripts
 * the page gets from elsewhere (EmDash's own head tags, a server-island loader,
 * an editor's HTML block, the consent gate activating a third-party tag). Those
 * are what Report-Only is for — see the template's AGENTS.md.
 *
 * Node-only (`node:crypto`), so it is exported from the package root — a build
 * time import — and never from a Worker entry.
 */
import { createHash } from 'node:crypto';
import { CONSENT_STUB, THEME_SCRIPT } from './inline-scripts.ts';

/** The CSP source expression for one inline script: `'sha256-<base64>'`. */
export function cspScriptHash(script: string): string {
  return `'sha256-${createHash('sha256').update(script, 'utf8').digest('base64')}'`;
}

export interface InlineScriptOptions {
  /** `<Head />` emits the colour-scheme bootstrap (its `webComponents` prop). Default true. */
  webComponents?: boolean;
  /** `<Head />` emits the consent-gate stub (a site with the gate on). Default true. */
  consent?: boolean;
}

/**
 * CSP hash sources for every inline script `<Head />` can emit.
 *
 * Defaults to ALL of them: listing a hash for a script the page doesn't emit is
 * harmless, while omitting one a page does emit is a violation.
 */
export function inlineScriptHashes(opts: InlineScriptOptions = {}): string[] {
  const out: string[] = [];
  if (opts.webComponents !== false) out.push(cspScriptHash(THEME_SCRIPT));
  if (opts.consent !== false) out.push(cspScriptHash(CONSENT_STUB));
  return out;
}

export interface ContentSecurityPolicyOptions {
  /** Extra `script-src` sources, e.g. a hash for your own inline script or an origin. */
  scriptSrc?: string[];
  /** Origins for `connect-src` beyond `'self'` (analytics endpoints, a form API). */
  connectSrc?: string[];
  /** Origins for `img-src` beyond `'self'`, `data:` and `https:`. */
  imgSrc?: string[];
  /** Origins for `frame-src` (embeds). Default none. */
  frameSrc?: string[];
  /** A `report-uri` endpoint. Omit to rely on the browser console. */
  reportUri?: string;
  /** Which `<Head />` inline scripts to allow. Default all. */
  inline?: InlineScriptOptions;
}

/**
 * A strict starting policy for a prerendered site.
 *
 * `script-src` is `'self'` plus the `<Head />` hashes — no `'unsafe-inline'`.
 * `style-src` keeps `'unsafe-inline'` because Astro inlines scoped `<style>` and
 * components set `style=""` attributes; a style injection is far less dangerous
 * than a script one, and hashing every stylesheet would break on any edit.
 * `img-src` allows `https:` because editors paste images from anywhere.
 */
export function contentSecurityPolicy(opts: ContentSecurityPolicyOptions = {}): string {
  const list = (name: string, ...sources: (string[] | undefined)[]) =>
    `${name} ${sources.flatMap((s) => s ?? []).join(' ')}`.trim();
  const directives = [
    "default-src 'self'",
    list('script-src', ["'self'"], inlineScriptHashes(opts.inline), opts.scriptSrc),
    "style-src 'self' 'unsafe-inline'",
    list('img-src', ["'self'", 'data:', 'https:'], opts.imgSrc),
    "font-src 'self'",
    list('connect-src', ["'self'"], opts.connectSrc),
    list('frame-src', opts.frameSrc?.length ? opts.frameSrc : ["'none'"]),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ];
  if (opts.reportUri) directives.push(`report-uri ${opts.reportUri}`);
  return directives.join('; ');
}
