/**
 * componentsEntry for the vitops EmDash plugin. EmDash merges this map into
 * <PortableText> automatically — the export name MUST be `blockComponents`
 * and keys MUST match the block `type`s declared in ../blocks.ts.
 *
 * `blockTypeComponents` is the OTHER map: renderers for the schema-level block TYPES in
 * `../block-types.ts` (a `blocks` field entry, keyed by slug), for a site to pass to
 * `defineBlockComponents` / `<Blocks components={…}>`. EmDash does not merge it.
 */
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
  'vitops.actionLink': ActionLink,
  'vitops.imageCompare': ImageCompare,
  'vitops.copyButton': CopyButton,
  'vitops.banner': Banner,
  'vitops.details': Details,
  'vitops.carousel': Carousel,
  'vitops.gallery': Gallery,
  'vitops.cards': Cards,
  'vitops.accordion': Accordion,
  'vitops.hero': Hero,
  'vitops.marquee': Marquee,
  'vitops.logos': Logos,
  'vitops.steps': Steps,
  'vitops.stats': Stats,
  'vitops.callout': Callout,
  'vitops.entries': Entries,
  'vitops.pricing': Pricing,
  'vitops.embed': Embed,
  'vitops.form': Form,
  'vitops.reviews': Reviews,
  'vitops.nav': Nav,
};

/** Keyed by block-type slug (see `SECTION_SLUG`), not by Portable Text `_type`. */
export const blockTypeComponents = {
  vitops_section: Section,
};
