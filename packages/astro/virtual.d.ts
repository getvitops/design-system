/**
 * Astro generates the real types for `astro:env/*` into a consumer's
 * `.astro/` on `astro sync`, which never runs for this package — so the
 * import typechecks nowhere but a consumer project. Declared here at the
 * shape `plan-features.ts` actually uses; the runtime value comes from
 * Astro's env schema, and this file cannot import it.
 */
declare module 'astro:env/server' {
  export const SITE_PLAN: string | undefined;
}

/** Types for the virtual module the getvitops() integration provides to <Head />. */
declare module 'virtual:getvitops/head' {
  interface FaviconLink {
    rel: string;
    href: string;
    type?: string;
    sizes?: string;
  }
  /** Mirrors `HeadFont` in src/fonts.ts. `preload` is Astro's `PreloadFilter`. */
  interface HeadFont {
    cssVariable: string;
    preload: boolean | { weight?: string | number; style?: string }[];
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
    /** Families registered by `getvitops({ fonts })`, for `<Font />`. */
    fonts: HeadFont[];
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
    engine: 'inline' | 'sprite' | 'none';
    /** Absolute project root — where `@iconify-json/*` is resolved from. */
    root: string;
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
