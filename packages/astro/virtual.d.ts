/** Types for the virtual module the getvitops() integration provides to <Head />. */
declare module 'virtual:getvitops/head' {
  interface FaviconLink {
    rel: string;
    href: string;
    type?: string;
    sizes?: string;
  }
  interface HeadData {
    favicons: boolean;
    faviconLinks: FaviconLink[];
    themeColor: string | null;
    webComponents: boolean;
    wcBase: string;
  }
  const data: HeadData;
  export default data;
}
