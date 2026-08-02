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
  }
  const data: HeadData;
  export default data;
}
