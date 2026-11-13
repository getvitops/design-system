/**
 * Which tiers provide each pattern, and which call to make.
 *
 * The toolkit ships three tiers that COMPOSE — CSS framework classes, Lit web
 * components, and the platform wrappers (Astro components, Bricks elements) — and
 * the composition is what a consumer actually needs. For a tree: `.tree` styles it, `<Tree />` generates the
 * markup, `<wc-tree>` enhances it. This file is the single source for that, and
 * `tiers.test.ts` holds it to the files on disk.
 *
 * **Authored, not derived, and that is deliberate.** Name convention carries most
 * of it (`patterns/<name>.css` ↔ `WC<Name>.ts` → `wc-<name>` ↔
 * `bricks/elements/<name>.php`) but breaks where it matters:
 *
 *   - `splitter.css` hosts TWO components (`wc-split-panel`, `wc-image-compare`);
 *   - `anchor-link.css` provides `.link`, whose config pattern is `link`;
 *   - `tag.css` carries parts for THREE config patterns (`badge`, `tag`, `status`);
 *   - `layout.css` (a root partial, not under `patterns/`) provides `.split` and
 *     `.centered`, both of which have Bricks elements;
 *   - `forms.css`, `nav.css`, `navbar.css`, `navshell.css` each serve several tiers.
 *
 * A derivation would need an exceptions table longer than the rule, and a rename
 * would silently drop a link instead of failing. So it is authored, and the guards
 * make omission a build failure rather than a missing docs row.
 *
 * **The composition rule this encodes** (see `AGENTS.md`, tier 3): an Astro
 * component emits the `<wc-*>` tag with the accessible fallback INSIDE it. So
 * `<Tree />` is the whole call — wrapping it in your own `<wc-tree>` nests two
 * elements on one tree. `astro.wraps` records which case each component is, because
 * it varies: `Tree` and `CookieConsent` wrap a web component, while `Details`,
 * `Drawer`, `Popover`, `NavShell` and `Subgrid` emit tier-1 markup with no web
 * component at all. That cannot be inferred from the taxonomy.
 */

/** A pattern's CSS. `generated` means `design-system.json`'s `patterns.items`. */
export interface TierCss {
  /**
   * Hand-written partial, relative to `packages/core/css/` — usually
   * `patterns/<name>.css`, occasionally a root partial such as `layout.css`.
   * Absent when the pattern is generated CSS only.
   */
  partial?: string;
  /** Representative classes. Not exhaustive — the class reference enumerates. */
  classes: string[];
  /**
   * True when the pattern is **config-authored** — its CSS comes from
   * `patterns.items.<name>`, so it gets the token cascade, `states`, role variants
   * and `BASE_HOOK` override vars. False means a purely structural partial with
   * none of those.
   *
   * Note `patterns.items` is CONSUMER-authored: `defaultConfig()` ships only
   * `btn`/`cta`/`card`, and a consumer declares whatever else they need. So this
   * flag records which patterns are *of that kind* — the reference set is this
   * repo's own `src/design-system.json`, which is what the docs render from — not a
   * promise about any particular consumer's config.
   */
  generated: boolean;
}

export interface TierWc {
  tag: string;
  /** In `elements.js`. False = its own bundle, or not shipped at all. */
  registered: boolean;
  /** What JS adds over the fallback. The reason the tier exists for this pattern. */
  adds: string;
  /** Set when the element ships somewhere other than `elements.js`. */
  bundle?: string;
}

export interface TierAstro {
  /** Import specifier, e.g. `@getvitops/astro/components/Tree.astro`. */
  component: string;
  /**
   * `wc` — emits the `<wc-*>` tag with the fallback inside, so this one call is the
   * whole composition. `css` — emits tier-1 markup; there is no web component.
   */
  wraps: 'wc' | 'css';
}

export interface TierEntry {
  css: TierCss;
  wc?: TierWc;
  /**
   * Astro components for this pattern. An array because a pattern can ship more
   * than one — `navshell` has both `NavShell` and `NavShellToggle`, since the
   * toggle must be placeable outside the shell.
   */
  astro?: TierAstro[];
  /** Bricks element `$name`, e.g. `vitops-carousel`. */
  bricks?: string;
  /**
   * `@getvitops/emdash` Portable Text block `_type`s that render this pattern, e.g.
   * `vitops_carousel`. An array because one pattern can have several blocks
   * (`details` has a single disclosure and an accordion group) and one block can span
   * patterns (`vitops_actionLink` is `link`, `btn` and `cta`).
   *
   * Tier 3, a sibling of `astro` and `bricks`: a block is a platform wrapper that an
   * editor drops into a page, and each one is an adapter over this entry's Astro
   * component. `@getvitops/emdash`'s `blocks.test.ts` is the drift guard — it lives
   * there because the generator cannot import the plugin (the plugin imports the
   * generator), so the check runs from the side that can see both.
   */
  emdash?: string[];
  /**
   * Why this pattern's web component deliberately has no `emdash` block. A shipped `wc-*`
   * (in `elements.js` or its own bundle) must set `emdash` OR this — `tiers.test.ts`
   * enforces it — so "no block" is always a decision with a reason on the page, never an
   * omission nobody noticed. Meaningless alongside `emdash`; the guard rejects both.
   */
  emdashExempt?: string;
  /** The one line an agent needs: what to actually write. */
  use: string;
}

const c = (classes: string[], partial?: string, generated = false): TierCss => ({
  ...(partial ? { partial } : {}),
  classes,
  generated,
});

/**
 * Shorthand for the usual `@getvitops/astro/components/<name>.astro` export.
 *
 * Not every component lives under `components/` — `CookieConsent.astro` is exported
 * from the package root — so those are written out in full. The specifier must be
 * one a consumer can actually import: `tiers.test.ts` checks each against
 * `packages/astro/package.json`'s `exports`, because a wrong one is a copy-pasteable
 * import that fails only in the consumer's project.
 */
const a = (name: string, wraps: 'wc' | 'css'): TierAstro[] => [
  { component: `@getvitops/astro/components/${name}.astro`, wraps },
];

export const TIERS: Record<string, TierEntry> = {
  // ── Patterns that span tiers: the composition actually matters here ────────
  tree: {
    css: c(
      ['tree', 'tree__item', 'tree__content', 'tree__summary', 'tree__toggle', 'tree__label'],
      'patterns/tree.css',
      true,
    ),
    wc: {
      tag: 'wc-tree',
      registered: true,
      adds: 'WAI-ARIA tree semantics, roving-tabindex keyboard navigation, filter, expand/collapse all, hash deep-linking',
    },
    astro: a('Tree', 'wc'),
    // Nested data doesn't fit a flat repeater, so the block takes an indented outline instead.
    emdash: ['vitops_tree'],
    use: '`<Tree items={…} />` — it emits `<wc-tree>` itself, so do NOT add your own wrapper. In EmDash, `vitops_tree` takes an indented outline (one node per line, indent to nest, `| badge` for a chip) and builds the tree from it; it never sets `descriptionHtml`.',
  },
  carousel: {
    emdash: ['vitops_carousel'],
    css: c(
      ['carousel', 'carousel__track', 'carousel__slide', 'carousel__media', 'carousel__hint'],
      'patterns/carousel.css',
      true,
    ),
    wc: {
      tag: 'wc-carousel',
      registered: true,
      adds: 'opt-in cloned loop, autoplay, and real prev/next + dot controls where `::scroll-button()`/`::scroll-marker` are missing',
    },
    astro: a('Carousel', 'wc'),
    bricks: 'vitops-carousel',
    use: '`<Carousel slides={…} label="…" />` — it emits `<wc-carousel>` itself, so do NOT add your own wrapper. `.carousel` is the shell and `.carousel__track` the scroller; add `loop` for the cloned infinite strip (`autoplay` implies it).',
  },
  // TODO — no `bricks` element yet (contrast `carousel`, `entries`, `image-compare`
  // above, which all have one). Not in the immediate plan; the css + wc + astro
  // tiers are the complete, self-consistent deliverable on their own, and a
  // `bricks/elements/gallery.php` + `bricks: 'vitops-gallery'` is a self-contained
  // follow-up whenever it's needed — it only adds a field here, nothing above it
  // has to change.
  gallery: {
    emdash: ['vitops_gallery'],
    css: c(
      ['gallery', 'gallery__item', 'gallery__trigger', 'gallery__thumb'],
      'patterns/gallery.css',
      true,
    ),
    wc: {
      tag: 'wc-gallery',
      registered: true,
      adds: 'a real `showModal()` open, neighbour preload and the thumbnail→full-image view-transition morph',
    },
    astro: a('Gallery', 'wc'),
    use: '`<Gallery images={…} label="…" />` — it emits `<wc-gallery>` wrapping a `<Carousel />` (which emits its own `<wc-carousel>`) itself, so do NOT add your own wrapper around either. Each thumbnail is a plain `<a href="#slide-id">` into the carousel\'s own `<li id="slide-id">` inside a single `<dialog class="lightbox-dialog">` (see `lightbox`), so it is a working modal lightbox — WITH prev/next — before any script runs. Stepping between images is the carousel\'s job, not the gallery\'s.',
  },
  entries: {
    emdash: ['vitops_entries'],
    css: c(['entries__table', 'entries__scroll', 'entries__nav'], 'patterns/table.css'),
    wc: {
      tag: 'wc-entries',
      registered: true,
      adds: 'parses heading + `<dl>` pairs into a table above a breakpoint',
    },
    astro: a('Entries', 'wc'),
    bricks: 'vitops-entries',
    use: '`<Entries entries={[{ heading, pairs: [{ term, value }] }]} />` — it emits `<wc-entries>` itself, so do NOT add your own wrapper. By hand: `<wc-entries>` around `<h3>` + `<dl>` pairs. The tier-2 exemplar: semantic pairs with no JS, a table with it.',
  },
  copy: {
    emdash: ['vitops_copyButton'],
    css: c(['copy', 'copy__button', 'copy__icon', 'copy__tooltip'], 'patterns/copy.css'),
    wc: { tag: 'wc-copy', registered: true, adds: 'clipboard write plus success feedback' },
    bricks: 'vitops-copy-button',
    use: '`<wc-copy>` around the content and a `[data-copy]` button.',
  },
  dismissable: {
    // The banner block's `dismissible` toggle wraps it.
    emdash: ['vitops_banner'],
    css: c(['banner__close', 'notification__close'], 'patterns/banner.css'),
    wc: {
      tag: 'wc-dismissable',
      registered: true,
      adds: 'fade-out + removal, optional auto-dismiss',
    },
    bricks: 'vitops-dismissable',
    use: '`<wc-dismissable>` around any banner/notification containing a `[data-dismiss]` control.',
  },
  'split-panel': {
    css: c(['splitter', 'splitter__panel', 'splitter__handle'], 'patterns/splitter.css'),
    emdashExempt:
      'app UI (resizable panes), not editorial content; an editor does not drag-resize a published page',
    wc: { tag: 'wc-split-panel', registered: true, adds: 'draggable divider between two panels' },
    bricks: 'vitops-split-panel',
    use: '`<wc-split-panel>` with two children. Unenhanced they simply stack.',
  },
  'image-compare': {
    emdash: ['vitops_imageCompare'],
    // Same partial as split-panel — one of the reasons this file is authored.
    css: c(
      ['image-compare', 'image-compare__before', 'image-compare__handle'],
      'patterns/splitter.css',
    ),
    wc: {
      tag: 'wc-image-compare',
      registered: true,
      adds: 'drag handle revealing the before/after image',
    },
    bricks: 'vitops-image-compare',
    use: '`<wc-image-compare>` with two images. Both are visible without JS.',
  },
  marquee: {
    emdash: ['vitops_marquee'],
    css: c(['marquee', 'marquee__content', 'marquee__item'], 'patterns/marquee.css'),
    wc: {
      tag: 'wc-marquee',
      registered: true,
      adds: 'fills the track with enough copies to scroll seamlessly',
    },
    astro: a('Marquee', 'wc'),
    use: '`<Marquee>` around one `.marquee__content`, or `<wc-marquee>` by hand. Scrolls via CSS alone; JS only removes the seam.',
  },
  // ── Editorial patterns the EmDash block library adds (tier 1 only: no JS of their own) ──
  //
  // `section`, `steps`, `stats`, `callout`, `logos` and `embed` are structural partials, so
  // `generated: false`. Colour is NOT theirs: it comes from `tone`, one convention shared by
  // every block that colours anything (see its entry).
  tone: {
    css: c(['tone', 'tone--solid', 'accent'], 'patterns/tone.css'),
    use: "Add `.tone` and set `--tone-bg` / `--tone-fg` / `--tone-border` / `--tone-solid` / `--tone-on-solid` as custom properties — never a class built from a value, which Tailwind cannot see. `@getvitops/emdash`'s `resolveTone(tone, color)` writes them: role, then semantic fallbacks, then `neutral`, or a palette `color` escape hatch. `.accent` colours a run inside a heading.",
  },
  section: {
    emdash: ['vitops_section'],
    css: c(
      [
        'section',
        'section__head',
        'section__kicker',
        'section__title',
        'section__sub',
        'section__body',
        'section--split',
        'section--center',
        'block-anchor',
      ],
      'patterns/section.css',
    ),
    use: '`.section.region` > `.centered` > `.section__inner` holding `.section__head` (kicker, heading, sub) and `.section__body`. `.section--split` puts the head beside the body when wide. In EmDash it is a block TYPE (`vitops_section`) with a Portable Text body that accepts any other block — see `vitopsBlockTypes()`.',
  },
  steps: {
    emdash: ['vitops_steps'],
    css: c(
      [
        'steps',
        'steps__item',
        'steps__body',
        'steps__title',
        'steps__text',
        'steps--row',
        'steps--cards',
        'steps--animated',
      ],
      'patterns/steps.css',
      true,
    ),
    use: '`<ol class="steps tone">` of `<li class="steps__item">` each holding a `.steps__body` with a real heading. The number is a CSS counter and the connector line a pseudo-element; `.steps--row` runs it sideways when wide; `.steps--cards` puts each step in a card and `.steps--animated` draws the connector on scroll. The marker size and card geometry are the `steps` entry of `patterns.items` (`--steps-marker-size`, the `content` group tokens).',
  },
  stats: {
    emdash: ['vitops_stats'],
    css: c(
      [
        'stats',
        'stats__item',
        'stats__figure',
        'stats__label',
        'stats__group',
        'stats__delta',
        'stats--tiles',
      ],
      'patterns/stats.css',
    ),
    use: '`<ul class="stats">` of `.stats__item`, each figure a `<Counter>`. `.stats--tiles` adds `.stats__group` and `.stats__delta`; `data-state="up|down"` colours the delta through the success/danger roles.',
  },
  callout: {
    emdash: ['vitops_callout'],
    css: c(
      [
        'callout',
        'callout__body',
        'callout__title',
        'callout__text',
        'callout__actions',
        'callout--center',
      ],
      'patterns/callout.css',
    ),
    use: '`.callout.tone` with a `.callout__body` and `.callout__actions`. A call-to-action band that stays on the page — NOT `banner`, which is a dismissible announcement.',
  },
  logos: {
    emdash: ['vitops_logos'],
    css: c(['logos', 'logos__item', 'logos__name', 'logos--grayscale'], 'patterns/logos.css'),
    use: '`<ul class="logos">` of `.logos__item` images (alt text = the name), or `.logos__name` text when there is no image. A still grid; `marquee` is the scrolling version.',
  },
  embed: {
    emdash: ['vitops_embed'],
    css: c(['embed', 'embed__frame', 'embed__placeholder'], 'patterns/embed.css'),
    use: '`.embed` around an `<iframe class="embed__frame" data-consent="marketing" data-consent-src="…">` with NO `src`, and a `.embed__placeholder`. The consent runtime assigns the address after the grant; the placeholder holds a real link. Never give the iframe a live `src`.',
  },
  // NOT generated: a counter is a bare text figure, not a bordered/padded box —
  // none of the token-cascade groups (label/control/panel/area/content/pull)
  // fit it, so it has no `patterns.items` entry, matching `multi-field` below.
  // No `bricks` element yet either, same reasoning as `gallery` above.
  counter: {
    // Each figure of the stats block is a `<Counter>`.
    emdash: ['vitops_stats'],
    css: c(['counter', 'counter__value', 'counter__presentation'], 'patterns/counter.css'),
    wc: {
      tag: 'wc-counter',
      registered: true,
      adds: 'animates from a start value to the value already in the fallback text, on intersection',
    },
    astro: a('Counter', 'wc'),
    use: '`<Counter value="94%" />` — it emits `<wc-counter>` itself, so do NOT add your own wrapper. The final value is parsed from the fallback text, never passed separately.',
  },
  'multi-field': {
    // NOT generated: the config pattern here is `forms`. This component sits over
    // forms markup, so it has no `patterns.items` entry, no roles and no states.
    emdashExempt:
      'repeats rows a visitor adds at submit time (several phone numbers, guests); `vitops_form` has a fixed, editor-defined field list and no such field type',
    css: c(['form-group', 'input-group', 'fieldset'], 'patterns/forms.css'),
    wc: { tag: 'wc-multi-field', registered: true, adds: 'add/remove repeating field rows' },
    bricks: 'vitops-multi-field',
    use: '`<wc-multi-field>` around a field template. One row submits fine with no JS.',
  },
  turnstile: {
    // Rendered by `vitops_form` when `site.security.turnstile.siteKey` is set; the block
    // emits `<wc-turnstile>` itself, with its no-JS explanation inside.
    emdash: ['vitops_form'],
    css: c(['form-group'], 'patterns/forms.css'),
    wc: {
      tag: 'wc-turnstile',
      registered: true,
      adds: 'loads Cloudflare Turnstile on first interaction with the form and holds a submit until its token arrives',
    },
    use: '`<wc-turnstile sitekey="…">` inside a `<form>`, around a paragraph saying the spam check needs JavaScript. Pair it with `createConversionRoute({ turnstile })`; the `vitops_form` block does both.',
  },
  'color-scheme-toggle': {
    emdashExempt: 'site chrome (header/footer), not page content; belongs in the nav/layout',
    css: c([], 'patterns/icon.css'),
    wc: {
      tag: 'wc-color-scheme-toggle',
      registered: true,
      adds: 'segmented light/dark/system control; persists the choice (consent-gated)',
    },
    bricks: 'vitops-color-scheme-toggle',
    use: '`<wc-color-scheme-toggle></wc-color-scheme-toggle>`. Renamed from `<color-scheme-toggle>` in 4.0. Shadow DOM, so it is absent rather than broken without JS.',
  },
  consent: {
    emdashExempt:
      'site chrome: the layout renders `<CookieConsent />` once; an editor-placed copy would duplicate the gate',
    css: c(
      ['consent', 'consent__body', 'consent__options', 'consent__actions'],
      'patterns/consent.css',
    ),
    wc: {
      tag: 'wc-consent',
      registered: false,
      bundle: '@getvitops/core/consent',
      adds: 'the permission gate itself — activates `type="text/plain"` tags on grant',
    },
    // Exported from the package root, not `components/`.
    astro: [{ component: '@getvitops/astro/CookieConsent.astro', wraps: 'wc' }],
    use: '`<CookieConsent />`. Its own Lit-free bundle so a site needing consent does not download a rendering framework.',
  },
  'theme-editor': {
    emdashExempt:
      'tooling, not content; it is mounted in the EmDash admin by `designSystemEditor`, never in a page',
    css: c(['ed-panel', 'ed-launch', 'ed-input'], 'patterns/theme-editor.css'),
    wc: {
      tag: 'wc-theme-editor',
      registered: false,
      bundle: '@getvitops/core/editor',
      adds: 'live `:root` token overrides, export as CSS or a config patch',
    },
    use: '`<wc-theme-editor manifest="…">`. TOOLING, not a page pattern — the one deliberate tier-2 exception, quarantined in its own opt-in bundle.',
  },

  // ── editor-v2 track: defined, but shipped in no bundle ────────────────────
  //
  // Registered by their own modules and imported by nothing, so nothing can be
  // consuming them. They are listed because the guards require every
  // `customElements.define` to be accounted for — and because "exists but is not
  // shipped" is exactly the kind of thing a reader needs told, rather than
  // discovering the tag does nothing.
  'color-wheel': {
    css: c([]),
    wc: {
      tag: 'wc-color-wheel',
      registered: false,
      adds: 'hue/chroma wheel input',
      bundle: '(none — editor-v2 track, not yet bundled)',
    },
    use: 'Not shipped. Registered but absent from every bundle, so the tag is inert in a consumer project.',
  },
  'oklch-color-picker': {
    css: c([]),
    wc: {
      tag: 'wc-oklch-color-picker',
      registered: false,
      adds: 'OKLCH L/C/H picker',
      bundle: '(none — editor-v2 track, not yet bundled)',
    },
    use: 'Not shipped. See `color-wheel`.',
  },
  'icon-picker': {
    css: c([], 'patterns/icon.css'),
    wc: {
      tag: 'wc-icon-picker',
      registered: false,
      adds: 'browses the semantic icon map for the configured set',
      bundle: '(none — editor-v2 track, not yet bundled)',
    },
    use: 'Not shipped. See `color-wheel`.',
  },
  'typography-config': {
    css: c([]),
    wc: {
      tag: 'wc-typography-config',
      registered: false,
      adds: 'type role editor',
      bundle: '(none — editor-v2 track, not yet bundled)',
    },
    use: 'Not shipped. See `color-wheel`.',
  },

  // ── Astro-only conveniences over tier-1 markup (no web component) ──────────
  details: {
    emdash: ['vitops_details', 'vitops_accordion'],
    css: c(['details', 'details-trigger', 'details-icon'], 'patterns/details.css', true),
    astro: a('Details', 'css'),
    use: '`<Details>` — or hand-write `<details>`. No JS at either tier; `::details-content` animates in CSS.',
  },
  drawer: {
    css: c(['drawer', 'drawer--start', 'drawer--end'], 'patterns/drawer.css', true),
    astro: a('Drawer', 'css'),
    use: '`<Drawer>` — `<dialog class="drawer">` plus an Invoker Commands trigger. No JS.',
  },
  popover: {
    css: c(['popover', 'popover-trigger', 'popover-anchor'], 'patterns/popover.css', true),
    astro: a('Popover', 'css'),
    use: '`<Popover>` — native Popover API + CSS Anchor Positioning. No JS.',
  },
  navshell: {
    css: c(
      ['navshell', 'navshell__bar', 'navshell__panel', 'navshell-toggle'],
      'patterns/navshell.css',
    ),
    astro: [...a('NavShell', 'css'), ...a('NavShellToggle', 'css')],
    use: '`<NavShell>` with a `nav` slot, plus `<NavShellToggle>` if the toggle must live outside the shell.',
  },
  subgrid: {
    emdash: ['vitops_pricing'],
    css: c(['subgrid', 'subgrid-card', 'pricing-grid'], 'patterns/subgrid.css'),
    astro: a('Subgrid', 'css'),
    use: '`<Subgrid>` — emits `<ul class="subgrid" role="list">`; author `<li class="card subgrid-card">` items yourself, so tranches align across the set.',
  },
  card: {
    emdash: ['vitops_cards'],
    css: c(['card', 'card__title'], 'patterns/card.css', true),
    wc: {
      tag: 'wc-cards',
      registered: true,
      adds: 'whole-card click that keeps the card text selectable',
    },
    astro: a('Cards', 'wc'),
    use: '`<Cards>` — it emits `<wc-cards>` itself, so do NOT add your own wrapper. `<Subgrid>` is the same grid without the click enhancement.',
  },
  icon: {
    css: c(['icon', 'icon-button', 'icon-mask'], 'patterns/icon.css'),
    astro: a('Icon', 'css'),
    bricks: 'vitops-icon',
    use: '`<Icon name="menu" />`. Names are semantic and resolve per configured set; a name containing `:` passes through.',
  },

  // ── Bricks + CSS, no web component ────────────────────────────────────────
  split: {
    emdash: ['vitops_hero'],
    css: c(['split', 'split-1-2', 'split-reverse'], 'layout.css'),
    bricks: 'vitops-split',
    use: '`.split` plus a ratio class. Pure CSS; `md-split-1-2` for the responsive form.',
  },
  centered: {
    css: c(['centered', 'spotlight', 'breakout', 'fullbleed'], 'layout.css'),
    bricks: 'vitops-centered',
    use: '`.centered` as a track grid. Children land in `measure` — give it a track child to lay out inside.',
  },
  sitenav: {
    css: c(
      [
        'sitenav',
        'sitenav__link',
        'sitenav--drawer-start',
        'sitenav--panel-dropdown',
        'sitenav--mega',
        'navlist',
        'navlist--columns',
      ],
      'patterns/sitenav.css',
    ),
    astro: [...a('SiteNav', 'css'), ...a('SiteFooter', 'css')],
    emdash: ['vitops_nav'],
    bricks: 'vitops-sitenav',
    use: "`.sitenav` with `--bp-*` and a drawer direction. `<details>` + Invoker Commands, no JS. In Astro: `<SiteNav {...await loadNavMenus(getMenu)} />` renders EmDash menu `primary` (the default: dropdowns from `md`, drawer below) and, if they exist, `primary-mobile` (depth-1 nav below `md`) and `primary-mega` (mega panels from `xl`) — adding the menu in the admin is the whole change. An item's `titleAttr` is its description. Per-site behaviour lives in `site.chrome.nav` — `<SiteNav {...nav} {...resolveNavOptions(site)} />` sets `compact` (`drawer` | `dropdown`: an anchored, columnar panel under the toggle), `drawerSide`, the breakpoints and depths. For a mega panel's featured column pass `megaPanel={VitopsMegaPanel}` (`@getvitops/emdash/astro`): it renders the widget area `mega-<item slug>` (or the item's `mega-area:<name>` class) and nothing when there is none. `<SiteFooter sitemap legal name>` renders `footer-sitemap` + `footer-legal` + the copyright line. For a menu inside page content (a site map, a section's links, footer-style columns) use `.navlist` — plain nested lists, `--inline` / `--columns` — or, in EmDash, the `vitops_nav` block (menu, layout `list|inline|columns|sitenav`, depth 1–3, heading, tone). Name each `<nav>` uniquely: the header is `Primary` and the footer `Site map` / `Legal`, and the block never reuses those.",
  },
  'split-link': {
    css: c(['split-link', 'split-link__toggle', 'split-link__panel'], 'patterns/split-link.css'),
    bricks: 'vitops-split-link',
    use: '`.split-link` — a link plus a disclosure toggle. No JS.',
  },

  // ── CSS-only patterns ─────────────────────────────────────────────────────
  btn: {
    emdash: ['vitops_actionLink'],
    css: c(['btn'], undefined, true),
    use: '`<button>` gets it with no class; `.btn` carries it to other tags. `fill: false`, so states drive `color`.',
  },
  cta: {
    emdash: ['vitops_actionLink'],
    css: c(['cta', 'cta-danger'], undefined, true),
    use: '`.cta` on any element — usually `<a>`, since a CTA navigates. Filled, with role variants.',
  },
  link: {
    emdash: ['vitops_actionLink'],
    css: c(['link', 'skip-link', 'stretched-link', 'raised'], 'patterns/anchor-link.css', true),
    use: '`<a>` gets it at zero specificity; `.link` for other tags. `.stretched-link` makes one link cover its positioned ancestor (whole-card click, no JS — but the card text stops being selectable); `.raised` lifts content back above that overlay.',
  },
  badge: {
    emdash: ['vitops_badges'],
    css: c(['badge', 'badge-indicator'], 'patterns/tag.css', true),
    use: '`.badge` — a STATIC label. Use `tag` if it is dismissable or editable.',
  },
  'widget-area': {
    emdash: ['vitops_widgetArea'],
    css: c(['widget-area', 'widget__title', 'widget__menu'], 'patterns/widget-area.css'),
    use: 'Editor-managed regions: `<VitopsWidgetArea name="footer-columns" />` (`@getvitops/emdash/astro`) renders an area from Widgets in the admin — titled groups, a menu as a labelled `<nav>`, content as Portable Text. In a page, the `vitops_widgetArea` block places one. An area holding a `core:*` component widget falls back to EmDash\'s own renderer, and an area cannot hold another. Prerendered pages show an edit after the next deploy.',
  },
  tag: {
    css: c(['tag', 'tag__remove', 'tag__icon', 'tag-list'], 'patterns/tag.css', true),
    use: '`.tag` — an editable/dismissable label. Its group is `label`, not `tag`.',
  },
  status: {
    css: c(['status', 'status-dot--pulse'], 'patterns/tag.css', true),
    use: '`.status` with a role variant.',
  },
  tooltip: {
    css: c(['tooltip-trigger'], 'patterns/tooltip.css', true),
    use: '`.tooltip-trigger` — CSS only, anchor-positioned.',
  },
  dialog: {
    css: c(['dialog__header', 'dialog__body', 'dialog__footer'], 'patterns/dialog.css', true),
    use: 'Native `<dialog>` plus the `.dialog__*` parts. No JS beyond `showModal()`.',
  },
  dropdown: {
    css: c(['dropdown--show-on-hover'], 'patterns/dropdown.css', true),
    use: 'Not a component: a dropdown is the native Popover API plus anchor positioning. A trigger with `popovertarget`, a `[popover]` panel, and `anchor-name` / `position-anchor` (`<Popover anchorName positionArea>` sets them). Add `.dropdown--show-on-hover` to the wrapper to reveal on hover as well as click. The `.dropdown-trigger` / `.dropdown-menu` / `.dropdown-icon` helpers live in `patterns/nav.css`.',
  },
  notification: {
    css: c(
      ['notification', 'notification__title', 'notification__actions'],
      'patterns/notification.css',
      true,
    ),
    use: '`.notification` with a role variant; wrap in `<wc-dismissable>` to make it dismissable.',
  },
  lightbox: {
    css: c(
      ['lightbox-dialog', 'lightbox-dialog__track', 'lightbox-dialog__close'],
      'patterns/lightbox.css',
      true,
    ),
    use: 'The single `<dialog class="lightbox-dialog">` a gallery opens — it wraps ONE `.carousel` (`lightbox-dialog__track`) of every image, not one dialog per image. Use `gallery` for the thumbnail grid that drives it — `<Gallery />` emits both, and the carousel inside already owns prev/next/dots/keys/swipe.',
  },
  comment: {
    css: c(['comment', 'comment__author', 'comment-thread'], 'patterns/comment.css', true),
    use: '`.comment` inside `.comment-thread`.',
  },
  review: {
    css: c(
      ['review', 'review__stars', 'review__body', 'review__reply', 'review__source'],
      'patterns/review.css',
      true,
    ),
    astro: a('ReviewCard', 'css'),
    emdash: ['vitops_reviews'],
    use: "`<ReviewCard review={…} />` — one card, from `vitops reviews`' `.vitops/reviews.json` cache. Put several inside `<Carousel>` slides or `<Marquee>` items; there is no group component and no `wc-review`. In EmDash, `vitops_reviews` is that whole row: it reads the cache as a build-time import (`virtual:getvitops/reviews`, served by `vitops()`; empty when the file is absent), picks reviews with `selectReviews()`, and lays them out as a grid, carousel or marquee. A new review appears after `vitops reviews` is re-run, committed and the site rebuilt.",
  },
  'location-pages': {
    // No stylesheet: semantic HTML in the framework's existing vocabulary (`rhythm`, `table`, `cluster`).
    css: c([]),
    astro: [...a('LocationPage', 'css'), ...a('ServicePage', 'css')],
    use: "`<LocationPage location={…} defaultLocale>` and `<ServicePage service={…} defaultLocale providerName>`: one `organization.locations` / `organization.services` entry as a page (name, address, hours table, photos, offers) plus its `LocalBusiness` / `Service` JSON-LD, with a slot for your own copy. Nothing scaffolds the route: write `src/pages/locations/[slug].astro` with `getStaticPaths()` over the record and `resolveSlug()` from `@getvitops/astro/schemas/graph-adapters.ts` (the idiom is in LocationPage's docblock). The key of the record, not the `slug`, is the entry's identity.",
  },
  tabs: {
    css: c(
      ['tabs', 'tabs__list', 'tabs__tab', 'tabs__panel', 'tabs--vertical'],
      'patterns/tabs.css',
      true,
    ),
    wc: {
      tag: 'wc-tabs',
      registered: true,
      adds: 'a WAI-ARIA tablist (arrow/Home/End keys, automatic activation, roving tabindex) built from the headings, one panel shown at a time, URL-fragment deep links',
    },
    astro: a('Tabs', 'wc'),
    emdash: ['vitops_tabs'],
    use: '`<Tabs items={[{ label, body }]} />`, or `<Tabs>` around your own `<section><h3>…</h3>…</section>` panels. With no JS every panel is readable under its heading. `orientation="vertical"` runs the list down the side; `hash` writes the selected panel into the URL; `selected` sets the first tab. Do NOT wrap it in `<wc-tabs>`: it emits its own. By hand: `<wc-tabs class="tabs">` around `<section>`s that each open with a heading.',
  },
  nav: {
    css: c(
      [
        'menu',
        'navbar',
        'nav-collapse',
        'drawer-nav',
        'dropdown-trigger',
        'dropdown-menu',
        'dropdown-icon',
      ],
      'patterns/nav.css',
      true,
    ),
    use: '`.menu` / `.navbar`. See `navbar` and `navshell` for the newer shells.',
  },
  masthead: {
    css: c(
      ['masthead', 'masthead--sticky', 'masthead--glass', 'masthead--floating'],
      'patterns/masthead.css',
    ),
    astro: a('Masthead', 'css'),
    use: '`<Masthead config={site}>` from `site.chrome.masthead` (position `static|sticky|fixed`, behavior `always|hide-on-scroll`, surface `solid|glass|transparent|transparent-until-scrolled`, layout `full|inset|floating`, `inset` and `height` lengths — fluid ones like `clamp(3.5rem, 8cqi, 4.5rem)` are fine — elevation shadow/border, `onScroll`); a prop overrides one field for a layout. Slots `brand`, default (the `<SiteNav>`), `actions`. Pure CSS — hide-on-scroll and the *-on-scroll states are `scroll-state()` queries that only subtract from a settled bar, so a browser without them (Firefox today) shows a visible, solid, elevated one. It never takes `role="banner"`: a body-level `<header>` already is the landmark, and `.banner` means the announcement bar.',
  },
  navbar: {
    css: c(['navbar', 'navbar--sticky', 'nav-items'], 'patterns/navbar.css'),
    use: '`.navbar` with `--start/--center/--end`.',
  },
  banner: {
    emdash: ['vitops_banner'],
    css: c(['banner', 'banner__content', 'banner__action'], 'patterns/banner.css', true),
    use: '`.banner`; wrap in `<wc-dismissable>` for a close button that works.',
  },
  table: {
    css: c(['table', 'table-wrapper'], 'patterns/table.css', true),
    use: '`.table` inside `.table-wrapper`. See `entries` for the responsive-to-table pattern.',
  },
  list: {
    css: c(['facet-list', 'filtered-list'], 'patterns/list.css', true),
    use: '`.facet-list` / `.filtered-list`.',
  },
  'pull-quote': {
    css: c(['pull-quote', 'pull-quote__attribution'], 'patterns/pull-quote.css', true),
    use: '`.pull-quote`. Note the type role `quote` is separate.',
  },
  breadcrumbs: {
    css: c(['breadcrumbs'], 'patterns/breadcrumbs.css'),
    astro: a('Breadcrumbs', 'css'),
    use: '`<Breadcrumbs items={[{ label, href }, …, { label }]} />`. The last item is the current page (`aria-current`, never a link). Emits the `BreadcrumbList` JSON-LD from the same items unless `schema={false}`. Hand-written: `<nav aria-label="Breadcrumb" class="breadcrumbs"><ol><li>…`. No JS.',
  },
  format: {
    // No stylesheet: it wraps one inline `<time>`/`<data>`, so the default `display: inline` is right.
    css: c([]),
    wc: {
      tag: 'wc-format',
      registered: true,
      adds: 'replaces the authored text with a locale-aware relative time, date, number, percentage or currency read from the machine value, and keeps a relative time current',
    },
    astro: a('Format', 'wc'),
    emdashExempt:
      'inline text formatting, used inside other content rather than placed as a block of its own',
    use: '`<Format type="relative" value="2026-11-03T14:05:00Z">November 3, 2026</Format>`: the slot is the no-JS text, and `title` keeps it after upgrade. `type` is `relative`, `date`, `datetime`, `time`, `number`, `percent` or `currency` (needs `currency="CAD"`). Anything it cannot format is left as written. Do NOT wrap it in `<wc-format>`: it emits its own. By hand: `<wc-format type="relative"><time datetime="…">text</time></wc-format>`.',
  },
  combobox: {
    css: c(
      ['combobox', 'combobox__input', 'combobox__listbox', 'combobox__option', 'combobox__empty'],
      'patterns/combobox.css',
      true,
    ),
    wc: {
      tag: 'wc-combobox',
      registered: true,
      adds: 'a filtered ARIA 1.2 listbox (aria-activedescendant, arrow/Enter/Escape keys, a live result count) in place of the browser datalist popup',
    },
    astro: a('Combobox', 'wc'),
    emdashExempt:
      'a form control, composed inside a form (vitops_form) rather than placed as page content',
    use: '`<Combobox name inputId options={[…]} />` with your own `<label for>`. With no JS it is an `<input list>` + `<datalist>`: native autocomplete. What is typed is what is submitted, so it suggests and does not constrain; use `<select>` for a closed set. Do NOT wrap it in `<wc-combobox>`: it emits its own. By hand: `<wc-combobox class="combobox"><input class="combobox__input" list="x"><datalist id="x">…</datalist></wc-combobox>`.',
  },
  range: {
    css: c(['range', 'range--dual', 'range__track'], 'patterns/range.css'),
    wc: {
      tag: 'wc-range',
      registered: true,
      adds: 'overlays two native range inputs on one track with thumbs that cannot cross and a filled span between them, and keeps an `<output>` current',
    },
    astro: a('Range', 'wc'),
    emdashExempt:
      'a form control, composed inside a form (vitops_form) rather than placed as page content',
    use: 'A single slider needs no element: a bare `<input type="range">` is themed by `forms.css` (accent-color). For its value shown, or for two thumbs, use `<Range name label min max value output />` or `<Range names labels values />`: with no JS those are native range inputs (two submit as two fields). Every input needs a label. Do NOT wrap it in `<wc-range>`: it emits its own.',
  },
  field: {
    css: c(
      ['field', 'field__control', 'field__label', 'field__help', 'field__error', 'field__counter'],
      'patterns/forms.css',
    ),
    wc: {
      tag: 'wc-field',
      registered: true,
      adds: 'links the help text and the error to the control with `aria-describedby`, writes validation messages under the field once the control is left or a submit reports it, accepts `setError()` from a host that validates against a schema, and adds a `maxlength` counter',
    },
    astro: a('Field', 'wc'),
    emdashExempt:
      'a form control wrapper, composed inside a form (vitops_form) rather than placed as page content',
    use: '`<Field label help error optional><input name … /></Field>`: the label nests the control, so no `id`/`for` is needed. With no JS it is a labelled control and a server `error` is already under it. It is not form-associated: the native control still submits, validates and takes focus. Do NOT wrap it in `<wc-field>`: it emits its own. By hand: `<wc-field class="field"><label class="field__control"><span class="field__label">Name</span><input name="n"></label><small class="field__help">…</small></wc-field>`. Use `.form-group` for a field whose label and control are siblings.',
  },
  'config-form': {
    css: c([]),
    wc: {
      tag: 'wc-config-form',
      registered: false,
      bundle: '@getvitops/core/config-form',
      adds: 'validates the form against a JSON Schema as you type and shows each message in its `<wc-field>`, stops a submit that has errors, adds a row to a keyed map as the blank one is used, and exposes the config document the form describes',
    },
    astro: a('ConfigForm', 'wc'),
    emdashExempt:
      'configuration tooling for a site owner, not page content a visitor reads or an editor places',
    use: '`<ConfigForm id schema paths output><form method="post">…</form></ConfigForm>`, with the fields from `renderStepHtml` / `renderProjectionHtml` (`@getvitops/utils/forms`). With no JS it is a plain form posting the names `formToConfig` parses and the server validates. Its own Lit-free bundle (`@getvitops/core/config-form`): the validator and the form codec. Do NOT wrap it in `<wc-config-form>`: it emits its own. `paths` narrows the schema to the fields shown; `novalidate` lets the server decide a submit.',
  },
  stepper: {
    css: c(
      [
        'stepper',
        'stepper__item',
        'stepper__item--complete',
        'stepper__item--invalid',
        'stepper__actions',
      ],
      'patterns/stepper.css',
    ),
    wc: {
      tag: 'wc-stepper',
      registered: false,
      bundle: '@getvitops/core/stepper',
      adds: 'shows one section of a long form at a time with Back and Next, stops a forward move at the first invalid step, marks the current link `aria-current="step"`, and follows the URL fragment',
    },
    astro: [
      { component: '@getvitops/astro/components/Stepper.astro', wraps: 'wc' },
      { component: '@getvitops/astro/components/StepperNav.astro', wraps: 'css' },
    ],
    emdashExempt:
      'onboarding and configuration flow for a site owner, not page content an editor places',
    use: '`<Stepper steps>` around one `<form>` of `<section id data-step><h2>…</h2>…</section>`s: with no JS a complete long form with `#anchor` links, with JS one step at a time. `<StepperNav steps current status hrefFor>` is the same `.stepper` list for a flow where each step is its own page (no JS at all). Do NOT wrap `<Stepper>` in `<wc-stepper>`: it emits its own. Its own Lit-free bundle (`@getvitops/core/stepper`, ~1 KB gzipped), outside `elements.js`.',
  },
  forms: {
    css: c(['form-group', 'input-group', 'fieldset', 'custom-check'], 'patterns/forms.css', true),
    use: 'Wrap text controls in `.form-group` or `.input-group` — a bare `<input>` gets browser defaults.',
  },
  cluster: {
    css: c(['cluster', 'cluster-between', 'cluster-start'], 'patterns/cluster.css'),
    use: '`.cluster` plus an alignment variant.',
  },
  code: {
    css: c([], 'patterns/code.css'),
    use: 'Element selectors on `pre`/`code`; no class needed.',
  },
  grouped: {
    css: c(['group', 'group-inline', 'bordered'], 'patterns/grouped.css'),
    use: '`.group-inline` / `.group-block` to join adjacent controls.',
  },
  'horizontal-scroll': {
    css: c(['horizontal-scroll'], 'patterns/horizontal-scroll.css'),
    use: '`.horizontal-scroll` for a snap strip.',
  },
  masonry: {
    css: c(['masonry', 'masonry__item'], 'patterns/masonry.css'),
    use: '`.masonry` — CSS columns based.',
  },
  media: {
    css: c(['media', 'media__figure', 'tile'], 'patterns/media.css'),
    use: '`.media` for a figure/body pair; `.tile` for the stacked form.',
  },
  overlay: { css: c(['overlay'], 'patterns/overlay.css'), use: '`.overlay` for a scrim.' },
  reveal: {
    css: c(['reveal', 'reveal-fade', 'reveal-h'], 'patterns/reveal.css'),
    use: '`.reveal` — scroll-driven, no JS. Hosts the `interpolate-size` that `<details>` animation needs.',
  },
  'scroll-based': {
    css: c(['parallax', 'scroll-progress', 'scroll-spy'], 'patterns/scroll-based.css'),
    use: 'Scroll-timeline driven; no JS.',
  },
  'scroll-target': {
    css: c(['scroll-target-group', 'toc-sidebar'], 'patterns/scroll-target.css'),
    use: '`.scroll-target-group` for `:target-current` highlighting.',
  },
  separator: {
    css: c(['separator', 'separator__text', 'separator__ornament'], 'patterns/separator.css'),
    use: '`.separator`, optionally with text or an ornament.',
  },
  stack: {
    css: c(['stack', 'stack__card'], 'patterns/stack.css'),
    use: '`.stack` for overlapping cards.',
  },
  sticky: {
    css: c(['sticky', 'sticky-header', 'sticky-nav'], 'patterns/sticky.css'),
    use: '`.sticky-header` etc. Pure CSS.',
  },
  svg: {
    css: c(['svg-container', 'svg-shape', 'svg-animated'], 'patterns/svg.css'),
    use: '`.svg-*` helpers for inline SVG.',
  },
  'text-effects': {
    css: c(
      ['typing', 'text-highlight', 'text-gradient-animate', 'text-stagger'],
      'patterns/text-effects.css',
    ),
    use: '`.typing`, `.text-highlight`, … CSS animation only.',
  },
};

/** Pattern names, sorted — a stable order for docs and tests. */
export const TIER_NAMES: readonly string[] = Object.keys(TIERS).sort();

/** Every `wc-*` tag the manifest knows, whether shipped in `elements.js` or not. */
export function tierTags(): { tag: string; registered: boolean; pattern: string }[] {
  return Object.entries(TIERS)
    .filter(([, e]) => e.wc)
    .map(([pattern, e]) => ({ tag: e.wc!.tag, registered: e.wc!.registered, pattern }));
}

/**
 * The projection axis: four keys, THREE tiers.
 *
 * `astro`, `bricks` and `emdash` are all the platform-wrapper tier — siblings chosen by
 * platform, not levels 3, 4 and 5. They are separate keys because they are separate
 * packages with separate tables, and no project uses both. Anything rendering a
 * tier NUMBER must map them to the same one; deriving it from this union's order
 * is what put Bricks at "tier 4" on the docsite.
 */
export type Tier = 'css' | 'wc' | 'astro' | 'bricks' | 'emdash';

/** A pattern paired with its entry — what one tier's projection iterates. */
export interface TierProjection {
  name: string;
  entry: TierEntry;
}

/**
 * The patterns one tier provides, in `TIER_NAMES` order.
 *
 * Every renderer goes through this rather than filtering `TIERS` itself: the docs
 * bundle projects every tier into one table for agents, the docsite projects
 * each tier as its own page for humans, and they must agree about which patterns
 * are in a tier. Five copies of `.filter(e => e.wc)` would agree until one of them
 * didn't.
 *
 * `css` needs a predicate rather than a presence check, which is the non-obvious
 * part. `TierEntry.css` is required, so *every* entry has one — including the
 * editor-v2 track, whose entries carry `c([])`: no partial, no classes, not
 * generated. Treating the field's presence as membership would list four patterns
 * on the CSS page with nothing to show for them, and `color-wheel` genuinely has
 * no CSS. The other three tiers are optional fields, so presence is the test.
 */
export function tierPatterns(tier: Tier): TierProjection[] {
  const has = (e: TierEntry): boolean => {
    switch (tier) {
      case 'css':
        return !!e.css.partial || e.css.classes.length > 0 || e.css.generated;
      case 'wc':
        return !!e.wc;
      case 'astro':
        return !!e.astro?.length;
      case 'bricks':
        return !!e.bricks;
      case 'emdash':
        return !!e.emdash?.length;
    }
  };
  return TIER_NAMES.filter((name) => has(TIERS[name]!)).map((name) => ({
    name,
    entry: TIERS[name]!,
  }));
}
