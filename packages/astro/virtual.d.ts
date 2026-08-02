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
  }
  const data: HeadData;
  export default data;
}

/** Types for the virtual module the getvitops() integration provides to <Icon />. */
declare module 'virtual:getvitops/icons' {
  // Keep these keys in step with `IconsData` in src/integration.ts, for the same
  // reason as HeadData above; `icons.test.ts` asserts the key sets match.
  //
  // Note what is NOT here: a resolver function. The module is JSON.stringify'd,
  // so only data crosses. <Icon /> imports the pure `resolveIcon` from
  // @getvitops/utils and feeds it these values.
  interface IconsData {
    engine: 'astro-icon' | 'astro-iconset' | 'sprite' | 'none';
    ui: string;
    brand: string;
    weight: string | null;
    /** Consumer aliases applied before the semantic map (legacy names, content values). */
    overrides: Record<string, string>;
    /** Public href of the sprite, or null when none is emitted. */
    sprite: string | null;
  }
  const data: IconsData;
  export default data;
}
