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
import Logos from './blocks/Logos.astro';
import Marquee from './blocks/Marquee.astro';
import Nav from './blocks/Nav.astro';
import Pricing from './blocks/Pricing.astro';
import Reviews from './blocks/Reviews.astro';
import Section from './blocks/Section.astro';
import Stats from './blocks/Stats.astro';
import Steps from './blocks/Steps.astro';

export const blockComponents = {
  vitops_actionLink: ActionLink,
  vitops_imageCompare: ImageCompare,
  vitops_copyButton: CopyButton,
  vitops_banner: Banner,
  vitops_details: Details,
  vitops_carousel: Carousel,
  vitops_gallery: Gallery,
  vitops_cards: Cards,
  vitops_accordion: Accordion,
  vitops_hero: Hero,
  vitops_marquee: Marquee,
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

/** The framework-styled widget area, for a site layout (the block form is `vitops_widgetArea`). */
export { default as VitopsWidgetArea } from './WidgetArea.astro';

/**
 * `themeAttrs('surface')` → `{ class, style }` for the layout's `<body>` (or any element a site owns):
 * the same backdrop-and-readable-text every block's `theme` field gives, from the site's own roles.
 */
export function themeAttrs(theme: string | undefined): { class?: string; style?: string } {
  const t = resolveTheme(theme);
  return t ? { class: t.className, style: t.style } : {};
}
