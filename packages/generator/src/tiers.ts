/**
 * Which tiers provide each pattern, and which call to make.
 *
 * The toolkit ships four tiers that COMPOSE — CSS framework classes, Lit web
 * components, Astro components, Bricks elements — and the composition is what a
 * consumer actually needs. For a tree: `.tree` styles it, `<Tree />` generates the
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
      ['tree', 'tree__item', 'tree__content', 'tree__toggle', 'tree__label'],
      'patterns/tree.css',
      true,
    ),
    wc: {
      tag: 'wc-tree',
      registered: true,
      adds: 'filter, expand/collapse all, hash deep-linking',
    },
    astro: a('Tree', 'wc'),
    use: '`<Tree items={…} />` — it emits `<wc-tree>` itself, so do NOT add your own wrapper.',
  },
  carousel: {
    css: c(['carousel'], 'patterns/carousel.css', true),
    wc: {
      tag: 'wc-carousel',
      registered: true,
      adds: 'cloned slides for a seamless loop, autoplay, snap nav',
    },
    bricks: 'vitops-carousel',
    use: '`<wc-carousel>` around your slides; each child is a slide. Works unenhanced as a scroll-snap strip.',
  },
  entries: {
    css: c(['entries__table', 'entries__scroll', 'entries__nav'], 'patterns/table.css'),
    wc: {
      tag: 'wc-entries',
      registered: true,
      adds: 'parses heading + `<dl>` pairs into a table above a breakpoint',
    },
    bricks: 'vitops-entries',
    use: '`<wc-entries>` around `<h3>` + `<dl>` pairs. The tier-2 exemplar: semantic pairs with no JS, a table with it.',
  },
  copy: {
    css: c(['copy', 'copy__button', 'copy__icon', 'copy__tooltip'], 'patterns/copy.css'),
    wc: { tag: 'wc-copy', registered: true, adds: 'clipboard write plus success feedback' },
    bricks: 'vitops-copy-button',
    use: '`<wc-copy>` around the content and a `[data-copy]` button.',
  },
  dismissable: {
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
    wc: { tag: 'wc-split-panel', registered: true, adds: 'draggable divider between two panels' },
    bricks: 'vitops-split-panel',
    use: '`<wc-split-panel>` with two children. Unenhanced they simply stack.',
  },
  'image-compare': {
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
    css: c(['marquee', 'marquee__content', 'marquee__item'], 'patterns/marquee.css'),
    wc: {
      tag: 'wc-marquee',
      registered: true,
      adds: 'fills the track with enough copies to scroll seamlessly',
    },
    use: '`<wc-marquee>` around one `.marquee__content`. Scrolls via CSS alone; JS only removes the seam.',
  },
  'multi-field': {
    // NOT generated: the config pattern here is `forms`. This component sits over
    // forms markup, so it has no `patterns.items` entry, no roles and no states.
    css: c(['form-group', 'input-group', 'fieldset'], 'patterns/forms.css'),
    wc: { tag: 'wc-multi-field', registered: true, adds: 'add/remove repeating field rows' },
    bricks: 'vitops-multi-field',
    use: '`<wc-multi-field>` around a field template. One row submits fine with no JS.',
  },
  'color-scheme-toggle': {
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
    css: c(['subgrid', 'subgrid-card', 'pricing-grid'], 'patterns/subgrid.css'),
    astro: a('Subgrid', 'css'),
    use: '`<Subgrid>` — emits `<ul class="grid">` with row-subgrid children so cards align across tracks.',
  },
  card: {
    css: c(['card'], undefined, true),
    astro: a('Cards', 'css'),
    use: '`<Cards>` for a list, or the `.card` class directly. Generated pattern: has roles and states.',
  },
  icon: {
    css: c(['icon', 'icon-button', 'icon-mask'], 'patterns/icon.css'),
    astro: a('Icon', 'css'),
    bricks: 'vitops-icon',
    use: '`<Icon name="menu" />`. Names are semantic and resolve per configured set; a name containing `:` passes through.',
  },

  // ── Bricks + CSS, no web component ────────────────────────────────────────
  split: {
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
    css: c(['sitenav', 'sitenav__link', 'sitenav--drawer-start'], 'patterns/sitenav.css'),
    bricks: 'vitops-sitenav',
    use: '`.sitenav` with `--bp-*` and a drawer direction. `<details>` + Invoker Commands, no JS.',
  },
  'split-link': {
    css: c(['split-link', 'split-link__toggle', 'split-link__panel'], 'patterns/split-link.css'),
    bricks: 'vitops-split-link',
    use: '`.split-link` — a link plus a disclosure toggle. No JS.',
  },

  // ── CSS-only patterns ─────────────────────────────────────────────────────
  btn: {
    css: c(['btn'], undefined, true),
    use: '`<button>` gets it with no class; `.btn` carries it to other tags. `fill: false`, so states drive `color`.',
  },
  cta: {
    css: c(['cta', 'cta-danger'], undefined, true),
    use: '`.cta` on any element — usually `<a>`, since a CTA navigates. Filled, with role variants.',
  },
  link: {
    css: c(['link', 'skip-link'], 'patterns/anchor-link.css', true),
    use: '`<a>` gets it at zero specificity; `.link` for other tags.',
  },
  badge: {
    css: c(['badge', 'badge-indicator'], 'patterns/tag.css', true),
    use: '`.badge` — a STATIC label. Use `tag` if it is dismissable or editable.',
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
    css: c(['dropdown--show-on-hover', 'dropdown-menu'], 'patterns/dropdown.css', true),
    use: '`.dropdown` — Popover API based.',
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
    css: c(['lightbox', 'lightbox-dialog__content'], 'patterns/lightbox.css', true),
    use: '`.lightbox` thumbnails plus a `<dialog>`.',
  },
  comment: {
    css: c(['comment', 'comment__author', 'comment-thread'], 'patterns/comment.css', true),
    use: '`.comment` inside `.comment-thread`.',
  },
  tabs: {
    css: c(['tabs'], undefined, true),
    use: 'Generated pattern only; no structural partial and no component yet.',
  },
  nav: {
    css: c(['menu', 'navbar', 'nav-collapse', 'drawer-nav'], 'patterns/nav.css', true),
    use: '`.menu` / `.navbar`. See `navbar` and `navshell` for the newer shells.',
  },
  navbar: {
    css: c(['navbar', 'navbar--sticky', 'nav-items'], 'patterns/navbar.css'),
    use: '`.navbar` with `--start/--center/--end`.',
  },
  banner: {
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
  combobox: {
    css: c(['combobox', 'combobox__listbox', 'combobox__option'], 'patterns/combobox.css', true),
    use: 'CSS shell only — the Lit component is a TODO, so it is not interactive yet.',
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

/** The four tiers, as a projection axis. */
export type Tier = 'css' | 'wc' | 'astro' | 'bricks';

/** A pattern paired with its entry — what one tier's projection iterates. */
export interface TierProjection {
  name: string;
  entry: TierEntry;
}

/**
 * The patterns one tier provides, in `TIER_NAMES` order.
 *
 * Every renderer goes through this rather than filtering `TIERS` itself: the docs
 * bundle projects all four tiers into one table for agents, the docsite projects
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
    }
  };
  return TIER_NAMES.filter((name) => has(TIERS[name]!)).map((name) => ({
    name,
    entry: TIERS[name]!,
  }));
}
