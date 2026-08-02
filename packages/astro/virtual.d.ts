/** Types for the virtual module the getvitops() integration provides to <Head />. */
declare module 'virtual:getvitops/head' {
  interface FaviconLink {
    rel: string;
    href: string;
    type?: string;
    sizes?: string;
  }
  // Keep these keys in step with `HeadData` in src/integration.ts — the two are
  // hand-duplicated (an ambient `declare module` in a shipped .d.ts cannot import
  // from src), and `head.test.ts` asserts the key sets match.
  interface HeadData {
    favicons: boolean;
    faviconLinks: FaviconLink[];
    themeColor: string | null;
    webComponents: boolean;
    wcBase: string;
    editor: boolean;
    sitemap: string | null;
    site: string | null;
    // Structurally `GetvitopsSeoOptions` (src/seo.ts). Left loose here because
    // this file can't import from src, and <Seo /> re-types it on the way into
    // `resolveSeo`, which is where the real contract is enforced.
    seo: Record<string, unknown>;
    // Likewise `GetvitopsAnalyticsOptions` (src/analytics.ts) — re-typed by
    // <Analytics /> on the way into `resolveAnalytics`.
    analytics: Record<string, unknown>;
    consent: boolean;
    consentCategories: string[];
    consentPolicyUrl: string | null;
    consentRuntime: boolean;
  }
  const data: HeadData;
  export default data;
}
