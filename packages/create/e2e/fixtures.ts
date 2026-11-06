/**
 * One realistic, valid value per `@getvitops/emdash` Portable Text block, keyed by block
 * `type` — the content of the end-to-end page (`scripts/e2e-audit.mjs`).
 *
 * TEST-ONLY. This lives under `packages/create/e2e/`, outside `templates/` and outside the
 * package's published `files`, on purpose: a freshly scaffolded site must not carry a dump of
 * every block (`templates.test.ts` fails if any of this reaches either). The e2e script merges
 * it over the scaffold's seed in a temp copy only.
 *
 * `fixtures.test.ts` is the drift guard: every entry of `BLOCKS` needs a fixture here or an
 * entry in `EXEMPT` saying why not, so adding a block fails a test until the page covers it.
 *
 * Images are the placeholder wireframes the overlay copies to `/e2e/` in the scaffold's
 * `public/`, so every `src` below is same-origin and the report-only CSP stays quiet.
 */

const IMG = {
  wide: '/e2e/wireframe-600x400.png',
  tall: '/e2e/wireframe-400x600.png',
  square: '/e2e/wireframe-400x400.png',
};

/** The block's own fields; `_type`/`_key` are added when the page is assembled. */
export type BlockFixture = Record<string, unknown>;

export const FIXTURES: Record<string, BlockFixture> = {
  'vitops.actionLink': {
    label: 'Book a consultation',
    href: '/contact',
    variant: 'cta',
    endIcon: 'arrow-right',
    role: '',
    newTab: false,
  },
  'vitops.imageCompare': {
    before: IMG.wide,
    beforeAlt: 'Wireframe of the lawn before treatment',
    beforeLabel: 'Before',
    after: IMG.wide,
    afterAlt: 'Wireframe of the lawn after treatment',
    afterLabel: 'After',
  },
  'vitops.copyButton': {
    text: 'npm install @getvitops/astro',
    label: 'Copy command',
    display: 'code-block',
  },
  'vitops.banner': {
    message: 'Spring booking is open. Reserve a visit before the end of the month.',
    tone: 'info',
    dismissible: true,
  },
  'vitops.details': {
    summary: 'What is included in a visit?',
    body: 'An assessment of the site, a written quote and a follow-up call. There is no charge for the first visit.',
    open: false,
  },
  'vitops.carousel': {
    slides: [
      { src: IMG.wide, alt: 'Wireframe slide one, a wide landscape' },
      { src: IMG.wide, alt: 'Wireframe slide two, a wide landscape' },
      { src: IMG.wide, alt: 'Wireframe slide three, a wide landscape' },
    ],
    label: 'Recent projects',
    autoplay: 0,
    loop: true,
    aspect: '3/2',
  },
  'vitops.gallery': {
    label: 'Project gallery',
    images: [
      { src: IMG.wide, alt: 'Wide wireframe, front garden', caption: 'Front garden' },
      { src: IMG.tall, alt: 'Tall wireframe, side path', caption: 'Side path' },
      { src: IMG.square, alt: 'Square wireframe, patio', caption: 'Patio' },
    ],
    aspect: '3/2',
    loop: false,
  },
  'vitops.cards': {
    variant: 'default',
    level: '3',
    tone: '',
    columns: '3',
    cards: [
      {
        title: 'Design',
        body: 'A plan drawn to the site and the budget.',
        image: IMG.wide,
        imageAlt: 'Wireframe of a garden plan',
        href: '/contact',
        linkLabel: 'Ask about design',
      },
      {
        title: 'Build',
        body: 'Installed by our own crew, on schedule.',
        href: '/contact',
        linkLabel: 'Ask about building',
      },
      { title: 'Care', body: 'Seasonal visits to keep it looking right.' },
    ],
  },
  'vitops.accordion': {
    exclusive: true,
    items: [
      {
        summary: 'How long does a project take?',
        body: 'Most take two to four weeks from the signed quote.',
        open: true,
      },
      {
        summary: 'Do you work in winter?',
        body: 'Planning and design, yes. Building resumes in spring.',
      },
      { summary: 'Is the quote binding?', body: 'It is fixed unless the scope changes.' },
    ],
  },
  'vitops.hero': {
    eyebrow: 'Ottawa and area',
    heading: 'Landscapes that last',
    level: '2',
    body: 'Design, build and seasonal care from one local team.',
    primaryLabel: 'Get a quote',
    primaryHref: '/contact',
    secondaryLabel: 'See our work',
    secondaryHref: '#gallery',
    image: IMG.wide,
    imageAlt: 'Wireframe of a finished landscape',
    layout: 'split',
    tone: '',
  },
  'vitops.marquee': {
    items: [
      { text: 'Licensed and insured' },
      { text: 'Locally owned' },
      { image: IMG.square, alt: 'Wireframe badge' },
      { text: 'Free estimates' },
    ],
    pauseOnHover: true,
    reverse: false,
  },
  'vitops.logos': {
    label: 'Trusted by',
    logos: [
      { image: IMG.square, alt: 'Example Client One', href: 'https://example.com' },
      { image: IMG.square, alt: 'Example Client Two' },
      { image: IMG.square, alt: 'Example Client Three' },
    ],
    grayscale: true,
    size: 'md',
  },
  'vitops.steps': {
    level: '3',
    layout: 'row',
    tone: '',
    steps: [
      { title: 'Visit', text: 'We walk the site and listen to what you want.' },
      { title: 'Quote', text: 'A written, itemised quote within three days.' },
      { title: 'Build', text: 'The crew arrives on the agreed date.' },
    ],
  },
  'vitops.stats': {
    variant: 'tiles',
    animate: false,
    tone: '',
    stats: [
      { value: '15', label: 'Years in business', group: 'Company' },
      { value: '400+', label: 'Projects delivered', group: 'Company' },
      { value: '4.9', label: 'Average review', delta: '+0.2', state: 'up' },
    ],
  },
  'vitops.callout': {
    heading: 'Ready when you are',
    level: '2',
    body: 'Tell us about the space and we will reply within one business day.',
    primaryLabel: 'Contact us',
    primaryHref: '/contact',
    secondaryLabel: 'Read the privacy policy',
    secondaryHref: '/privacy',
    align: 'center',
    solid: false,
    tone: '',
  },
  'vitops.entries': {
    level: '3',
    entries: [
      { heading: 'Lawn renewal', pairs: 'Duration | 2 days\nCrew | 3\nFrom | $1,800' },
      { heading: 'Patio build', pairs: 'Duration | 1 week\nCrew | 4\nFrom | $6,500' },
    ],
  },
  'vitops.pricing': {
    level: '3',
    plans: [
      {
        name: 'Essential',
        price: '$99',
        period: 'per visit',
        features: 'Mowing\nEdging\nClean-up',
        ctaLabel: 'Choose Essential',
        ctaHref: '/contact',
        featured: false,
      },
      {
        name: 'Complete',
        price: '$179',
        period: 'per visit',
        features: 'Everything in Essential\nFertilising\nSeasonal planting',
        ctaLabel: 'Choose Complete',
        ctaHref: '/contact',
        featured: true,
      },
    ],
  },
  'vitops.embed': {
    provider: 'map',
    url: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2800!2d-75.69!3d45.42!2m3!1f0!2f0!3f0',
    title: 'Map of our Ottawa office',
    category: 'marketing',
    ratio: '16/9',
  },
  // Reads the sample `.vitops/reviews.json` the overlay writes (REVIEWS_CACHE in overlay.ts).
  'vitops.reviews': {
    label: 'What clients say',
    location: 'ottawa',
    layout: 'grid',
    columns: '3',
    limit: 3,
    minRating: '4',
    sort: 'recent',
    avatars: false,
  },
  'vitops.nav': {
    menu: 'footer-sitemap',
    label: 'Page links',
    heading: 'Explore',
    level: '2',
    variant: 'columns',
    depth: '1',
  },
};

/**
 * Blocks deliberately without a fixture, with the reason. Empty today: every block is
 * exercised. Add one only when a block cannot render in a static build with no secrets.
 */
export const EXEMPT: Record<string, string> = {};
