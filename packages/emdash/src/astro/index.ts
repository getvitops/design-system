/**
 * componentsEntry for the vitops EmDash plugin. EmDash merges this map into
 * <PortableText> automatically — the export name MUST be `blockComponents`
 * and keys MUST match the block `type`s declared in ../blocks.ts.
 *
 * `blockTypeComponents` is the OTHER map: renderers for the schema-level block TYPES in
 * `../block-types.ts` (a `blocks` field entry, keyed by slug), for a site to pass to
 * `defineBlockComponents` / `<Blocks components={…}>`. EmDash does not merge it.
 */
import Badges from './blocks/Badges.astro';
import { resolveTheme } from './blocks/tone.ts';
import WidgetArea from './blocks/WidgetArea.astro';
import Accordion from './blocks/Accordion.astro';
import ActionLink from './blocks/ActionLink.astro';
import Band from './blocks/Band.astro';
import Banner from './blocks/Banner.astro';
import Callout from './blocks/Callout.astro';
import Cards from './blocks/Cards.astro';
import Carousel from './blocks/Carousel.astro';
import CopyButton from './blocks/CopyButton.astro';
import Details from './blocks/Details.astro';
import Embed from './blocks/Embed.astro';
import Entries from './blocks/Entries.astro';
import Form from './blocks/Form.astro';
import Gallery from './blocks/Gallery.astro';
import Hero from './blocks/Hero.astro';
import ImageCompare from './blocks/ImageCompare.astro';
import Location from './blocks/Location.astro';
import Logos from './blocks/Logos.astro';
import Marquee from './blocks/Marquee.astro';
import Nav from './blocks/Nav.astro';
import Pricing from './blocks/Pricing.astro';
import Reviews from './blocks/Reviews.astro';
import Section from './blocks/Section.astro';
import Stats from './blocks/Stats.astro';
import Steps from './blocks/Steps.astro';
import Testimonial from './blocks/Testimonial.astro';
import Tabs from './blocks/Tabs.astro';
import Tree from './blocks/Tree.astro';

export const blockComponents = {
  vitops_actionLink: ActionLink,
  vitops_imageCompare: ImageCompare,
  vitops_copyButton: CopyButton,
  vitops_band: Band,
  vitops_banner: Banner,
  vitops_details: Details,
  vitops_carousel: Carousel,
  vitops_gallery: Gallery,
  vitops_cards: Cards,
  vitops_accordion: Accordion,
  vitops_tabs: Tabs,
  vitops_testimonial: Testimonial,
  vitops_tree: Tree,
  vitops_hero: Hero,
  vitops_marquee: Marquee,
  vitops_location: Location,
  vitops_logos: Logos,
  vitops_steps: Steps,
  vitops_stats: Stats,
  vitops_callout: Callout,
  vitops_entries: Entries,
  vitops_pricing: Pricing,
  vitops_embed: Embed,
  vitops_form: Form,
  vitops_reviews: Reviews,
  vitops_nav: Nav,
  vitops_badges: Badges,
  vitops_widgetArea: WidgetArea,
};

/** Keyed by block-type slug (see `SECTION_SLUG`), not by Portable Text `_type`. */
export const blockTypeComponents = {
  vitops_section: Section,
};

/** Renders a `portableText` field and turns `vitops_band` markers into sections around the blocks after them. */
export { default as VitopsContent } from './VitopsContent.astro';

/** The framework-styled widget area, for a site layout (the block form is `vitops_widgetArea`). */
export { default as VitopsWidgetArea } from './WidgetArea.astro';

/** A mega-menu panel's extra column from a widget area, for `<SiteNav megaPanel={VitopsMegaPanel} />`. */
export { default as VitopsMegaPanel } from './MegaPanel.astro';

/**
 * `themeAttrs('surface')` → `{ class, style }` for the layout's `<body>` (or any element a site owns):
 * the same backdrop-and-readable-text every block's `theme` field gives, from the site's own roles.
 *
 * An element with its own `class` must not also spread this: two `class` attributes keep only the
 * first, and the backdrop silently disappears. Pass the element's classes as the second argument,
 * so the one `class` that comes back carries both:
 *
 *     <section {...themeAttrs('brand-primary', 'centered region')}>
 *
 * (or `class:list={['centered region', t.class]} style={t.style}`).
 */
export function themeAttrs(
  theme: string | undefined,
  className?: string,
): { class?: string; style?: string } {
  const t = resolveTheme(theme);
  const cls = [className, t?.className].filter(Boolean).join(' ');
  return {
    ...(cls ? { class: cls } : {}),
    ...(t?.style ? { style: t.style } : {}),
  };
}
