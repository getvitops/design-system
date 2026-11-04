/**
 * componentsEntry for the vitops EmDash plugin. EmDash merges this map into
 * <PortableText> automatically — the export name MUST be `blockComponents`
 * and keys MUST match the block `type`s declared in ../blocks.ts.
 */
import Accordion from './blocks/Accordion.astro';
import ActionLink from './blocks/ActionLink.astro';
import Banner from './blocks/Banner.astro';
import Cards from './blocks/Cards.astro';
import Carousel from './blocks/Carousel.astro';
import CopyButton from './blocks/CopyButton.astro';
import Details from './blocks/Details.astro';
import Gallery from './blocks/Gallery.astro';
import Hero from './blocks/Hero.astro';
import ImageCompare from './blocks/ImageCompare.astro';
import Marquee from './blocks/Marquee.astro';

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
};
