/**
 * Portable Text block-type declarations for the EmDash editor.
 *
 * Fields are EmDash Block Kit elements. Scalars (text_input / number_input / select /
 * toggle / combobox) cover single-valued patterns; `repeater` (rows of scalar
 * sub-fields) covers the repeating ones — cards, gallery, accordion, marquee, carousel
 * slides — and `media_picker` picks one asset from the media library. Both are
 * supported by the Portable Text block editor but not by Block Kit admin pages, which
 * is why the type below names them explicitly rather than accepting any `Element`.
 *
 * Patterns that need other blocks INSIDE them (a section with columns, a card holding a
 * button) cannot be a Portable Text block — a repeater holds scalars only. Those are
 * schema-level block TYPES with a `portableText` field, in `block-types.ts` (`vitops_section`).
 *
 * Every `action_id` here must have a matching prop consumed by the block's
 * .astro component in `src/astro/blocks/` (enforced by blocks.test.ts).
 */

import type { PortableTextBlockConfig } from 'emdash';
import { SEMANTIC_ICON_OPTIONS } from './icon-options.ts';
import { SEMANTIC_TONES } from './astro/blocks/tone.ts';
import { THEME_ROLES } from './block-types.ts';

/** The subset of EmDash Block Kit field elements these blocks use. */
export type BlockKitFieldDef = Extract<
  NonNullable<PortableTextBlockConfig['fields']>[number],
  {
    type:
      | 'text_input'
      | 'number_input'
      | 'select'
      | 'toggle'
      | 'combobox'
      | 'repeater'
      | 'media_picker';
  }
>;

export type PortableTextBlockDef = Omit<PortableTextBlockConfig, 'fields'> & {
  fields?: BlockKitFieldDef[];
};

/** Route that fills every tone select with the site's own roles — see `index.ts`. */
export const TONES_ROUTE = 'tones/list';
/** Lists each colour role twice: tinted (`role`) and filled (`role:solid`), for every block's `theme`. */
export const THEMES_ROUTE = 'themes/list';

/** Route that lists the site's EmDash menus for `vitops_nav`'s `menu` select — see `menus-route.ts`. */
export const MENUS_ROUTE = 'menus/list';

/**
 * The tone options an editor can always pick, before the site adds its own roles.
 * Static because Block Kit needs a non-empty `options` list even when `optionsRoute` is set
 * (it is the fallback if the route fails, and what non-block-editor renderers read).
 */
export const STATIC_TONE_OPTIONS = [
  { label: 'None', value: '' },
  ...SEMANTIC_TONES.map((t) => ({ label: t[0]!.toUpperCase() + t.slice(1), value: t })),
];

/**
 * The shared tone pair (UPSTREAM 21; resolution lives in `astro/blocks/tone.ts`): a `tone`
 * select that offers the site's roles, and a `color` escape hatch naming a palette hue.
 * Spread into any block that colours something.
 */
function toneFields(): BlockKitFieldDef[] {
  return [
    {
      type: 'select',
      action_id: 'tone',
      label: 'Tone (a colour role from the site)',
      initial_value: '',
      options: STATIC_TONE_OPTIONS,
      optionsRoute: TONES_ROUTE,
    } as BlockKitFieldDef,
    {
      type: 'text_input',
      action_id: 'color',
      label: 'Palette colour instead of a tone (e.g. amber or amber-300)',
    },
  ];
}

/** Route that lists the site's widget areas for `vitops_widgetArea`'s `area` select. */
export const WIDGET_AREAS_ROUTE = 'widget-areas/list';

/**
 * The escape hatches every block carries, appended last by `BLOCKS` (see `astro/blocks/attrs.ts`
 * for how each is validated and why `style` takes custom properties only).
 */
export function commonFields(): BlockKitFieldDef[] {
  return [
    {
      type: 'select',
      action_id: 'theme',
      label: 'Theme (a backdrop with readable text, from the site colours)',
      initial_value: '',
      options: [
        { label: 'None', value: '' },
        ...THEME_ROLES.flatMap((r) => [
          { label: r.replace(/-/g, ' '), value: r },
          { label: `${r.replace(/-/g, ' ')} (filled)`, value: `${r}:solid` },
        ]),
      ],
      optionsRoute: THEMES_ROUTE,
    } as BlockKitFieldDef,
    {
      type: 'text_input',
      action_id: 'anchor',
      label: 'Anchor id (so a link can point here with #id)',
    },
    {
      type: 'text_input',
      action_id: 'className',
      label: 'Extra CSS classes (with the tailwind format, only classes the site already uses)',
    },
    {
      type: 'text_input',
      action_id: 'style',
      label: 'CSS custom properties, e.g. --p-card: 2rem; --tone-bg: #fee',
    },
  ];
}

/** Heading level for a block's own heading; `h1` is reserved for the page title. */
const levelField = (initial: string): BlockKitFieldDef => ({
  type: 'select',
  action_id: 'level',
  label: 'Heading level',
  initial_value: initial,
  options: ['2', '3', '4', '5', '6'].map((n) => ({ label: `h${n}`, value: n })),
});

/**
 * Heading level for a block that can own the page title (hero): `h1`, or `p` for a heading that is
 * visual only and should not appear in the outline.
 */
const titleLevelField = (initial: string): BlockKitFieldDef => ({
  type: 'select',
  action_id: 'level',
  label: 'Heading level (h1 is the page title; p is styled like a heading but not in the outline)',
  initial_value: initial,
  options: [
    ...['1', '2', '3', '4', '5', '6'].map((n) => ({ label: `h${n}`, value: n })),
    { label: 'p (not a heading)', value: 'p' },
  ],
});

const BASE_BLOCKS: PortableTextBlockDef[] = [
  {
    /**
     * A link or button, optionally with an icon at either end.
     *
     * Flattened on purpose: Block Kit has no object-group element, so a shape
     * like `{ label, url }` becomes sibling fields. Same constraint the
     * marketing-blocks plugin documents.
     *
     * The icons are `combobox` — a searchable typeahead over a STATIC option
     * list, which is exactly what the semantic name list is. It is the closest
     * fit Block Kit offers: its element union is closed (no custom element, no
     * raw HTML), so `<wc-icon-picker>` cannot be mounted inside a block modal
     * however much nicer it would be. Revisit if EmDash opens that union.
     */
    type: 'vitops_actionLink',
    label: 'Link or button',
    icon: 'link',
    placeholder: 'A link or button, with optional icons',
    fields: [
      { type: 'text_input', action_id: 'label', label: 'Label' },
      { type: 'text_input', action_id: 'href', label: 'URL' },
      {
        type: 'select',
        action_id: 'variant',
        label: 'Style',
        initial_value: 'link',
        options: [
          { label: 'Link', value: 'link' },
          { label: 'Button', value: 'btn' },
          { label: 'Call to action', value: 'cta' },
        ],
      },
      {
        type: 'combobox',
        action_id: 'startIcon',
        label: 'Icon before the label',
        placeholder: 'None',
        options: SEMANTIC_ICON_OPTIONS,
      },
      {
        type: 'combobox',
        action_id: 'endIcon',
        label: 'Icon after the label',
        placeholder: 'None',
        options: SEMANTIC_ICON_OPTIONS,
      },
      {
        type: 'select',
        action_id: 'role',
        label: 'Colour role',
        initial_value: '',
        options: [
          { label: 'Default', value: '' },
          { label: 'Success', value: 'success' },
          { label: 'Danger', value: 'danger' },
          { label: 'Warning', value: 'warning' },
          { label: 'Info', value: 'info' },
        ],
      },
      { type: 'toggle', action_id: 'newTab', label: 'Open in a new tab', initial_value: false },
    ],
  },
  {
    type: 'vitops_imageCompare',
    label: 'Image compare',
    placeholder: 'Before/after image slider',
    fields: [
      { type: 'text_input', action_id: 'before', label: 'Before image URL' },
      { type: 'text_input', action_id: 'beforeAlt', label: 'Before alt text' },
      {
        type: 'text_input',
        action_id: 'beforeLabel',
        label: 'Before label',
        initial_value: 'Before',
      },
      { type: 'text_input', action_id: 'after', label: 'After image URL' },
      { type: 'text_input', action_id: 'afterAlt', label: 'After alt text' },
      { type: 'text_input', action_id: 'afterLabel', label: 'After label', initial_value: 'After' },
    ],
  },
  {
    type: 'vitops_copyButton',
    label: 'Copy snippet',
    icon: 'code',
    placeholder: 'Text with a copy-to-clipboard button',
    fields: [
      { type: 'text_input', action_id: 'text', label: 'Text to copy', multiline: true },
      { type: 'text_input', action_id: 'label', label: 'Button label', initial_value: 'Copy' },
      {
        type: 'select',
        action_id: 'display',
        label: 'Display',
        initial_value: 'code-block',
        options: [
          { label: 'Code block', value: 'code-block' },
          { label: 'Inline', value: 'inline' },
        ],
      },
    ],
  },
  {
    type: 'vitops_banner',
    label: 'Banner',
    placeholder: 'Announcement or notice',
    fields: [
      { type: 'text_input', action_id: 'message', label: 'Message', multiline: true },
      {
        type: 'select',
        action_id: 'tone',
        label: 'Tone',
        initial_value: 'info',
        options: [
          { label: 'Info', value: 'info' },
          { label: 'Success', value: 'success' },
          { label: 'Warning', value: 'warning' },
          { label: 'Danger', value: 'danger' },
        ],
      },
      { type: 'toggle', action_id: 'dismissible', label: 'Dismissible', initial_value: true },
    ],
  },
  {
    type: 'vitops_details',
    label: 'Disclosure',
    placeholder: 'Collapsible details/summary',
    fields: [
      { type: 'text_input', action_id: 'summary', label: 'Summary (always visible)' },
      { type: 'text_input', action_id: 'body', label: 'Body (revealed)', multiline: true },
      { type: 'toggle', action_id: 'open', label: 'Open by default', initial_value: false },
    ],
  },
  {
    type: 'vitops_carousel',
    label: 'Carousel',
    placeholder: 'Image carousel',
    category: 'Media',
    fields: [
      {
        type: 'repeater',
        action_id: 'slides',
        label: 'Slides',
        item_label: 'slide',
        min_items: 1,
        fields: [
          { type: 'text_input', action_id: 'src', label: 'Image URL' },
          { type: 'text_input', action_id: 'alt', label: 'Alt text' },
        ],
      },
      {
        type: 'text_input',
        action_id: 'images',
        label: 'Image URLs, one per line (legacy — use Slides)',
        multiline: true,
      },
      {
        type: 'text_input',
        action_id: 'alts',
        label: 'Alt texts, one per line (legacy — use Slides)',
        multiline: true,
      },
      {
        type: 'text_input',
        action_id: 'label',
        label: 'Accessible name',
        initial_value: 'Carousel',
      },
      {
        type: 'number_input',
        action_id: 'autoplay',
        label: 'Autoplay interval (ms, 0 = off)',
        initial_value: 0,
      },
      {
        type: 'toggle',
        action_id: 'loop',
        label: 'Loop (clones the slides — autoplay implies it)',
        initial_value: false,
      },
      {
        type: 'text_input',
        action_id: 'aspect',
        label: 'Slide aspect ratio',
        initial_value: '16 / 9',
      },
    ],
  },
  {
    type: 'vitops_gallery',
    label: 'Gallery',
    placeholder: 'Thumbnail grid that opens a lightbox carousel',
    category: 'Media',
    fields: [
      {
        type: 'text_input',
        action_id: 'label',
        label: 'Accessible name',
        initial_value: 'Gallery',
      },
      {
        type: 'repeater',
        action_id: 'images',
        label: 'Images',
        item_label: 'image',
        min_items: 1,
        fields: [
          { type: 'text_input', action_id: 'src', label: 'Image URL' },
          { type: 'text_input', action_id: 'alt', label: 'Alt text' },
          { type: 'text_input', action_id: 'caption', label: 'Caption' },
        ],
      },
      {
        type: 'text_input',
        action_id: 'aspect',
        label: 'Thumbnail aspect ratio',
        initial_value: '1',
      },
      { type: 'toggle', action_id: 'loop', label: 'Wrap around at the ends', initial_value: false },
    ],
  },
  {
    type: 'vitops_cards',
    label: 'Cards',
    placeholder: 'A grid of cards',
    category: 'Sections',
    fields: [
      {
        type: 'repeater',
        action_id: 'cards',
        label: 'Cards',
        item_label: 'card',
        min_items: 1,
        fields: [
          { type: 'text_input', action_id: 'title', label: 'Title' },
          {
            type: 'text_input',
            action_id: 'body',
            label: 'Text (write [link text](/url) for an inline link)',
            multiline: true,
          },
          { type: 'text_input', action_id: 'image', label: 'Image URL' },
          { type: 'text_input', action_id: 'imageAlt', label: 'Image alt text' },
          {
            type: 'text_input',
            action_id: 'href',
            label: 'Link URL (makes the whole card clickable)',
          },
          {
            type: 'text_input',
            action_id: 'linkLabel',
            label: 'Link text',
            initial_value: 'Read more',
          },
          {
            type: 'text_input',
            action_id: 'checklist',
            label: 'Checklist (panel style; one item per line)',
            multiline: true,
          },
          { type: 'text_input', action_id: 'ctaLabel', label: 'Button text (panel style)' },
          { type: 'text_input', action_id: 'ctaHref', label: 'Button URL (panel style)' },
        ],
      },
      {
        type: 'select',
        action_id: 'variant',
        label: 'Style',
        initial_value: 'default',
        options: [
          { label: 'Cards', value: 'default' },
          { label: 'Panels (tinted, with checklist and button)', value: 'panel' },
        ],
      },
      levelField('3'),
      ...toneFields(),
      {
        type: 'select',
        action_id: 'columns',
        label: 'Columns',
        initial_value: '3',
        options: [
          { label: '1', value: '1' },
          { label: '2', value: '2' },
          { label: '3', value: '3' },
          { label: '4', value: '4' },
        ],
      },
    ],
  },
  {
    type: 'vitops_accordion',
    label: 'Accordion',
    placeholder: 'A group of collapsible sections',
    category: 'Sections',
    fields: [
      {
        type: 'repeater',
        action_id: 'items',
        label: 'Items',
        item_label: 'item',
        min_items: 1,
        fields: [
          { type: 'text_input', action_id: 'summary', label: 'Summary (always visible)' },
          { type: 'text_input', action_id: 'body', label: 'Body (revealed)', multiline: true },
          { type: 'toggle', action_id: 'open', label: 'Open by default', initial_value: false },
        ],
      },
      {
        type: 'toggle',
        action_id: 'exclusive',
        label: 'Only one open at a time',
        initial_value: false,
      },
    ],
  },
  {
    type: 'vitops_tabs',
    label: 'Tabs',
    placeholder:
      'Panels under tabs: every panel is a headed section until JavaScript turns them into tabs',
    category: 'Sections',
    fields: [
      {
        type: 'repeater',
        action_id: 'tabs',
        label: 'Tabs',
        item_label: 'tab',
        min_items: 2,
        fields: [
          { type: 'text_input', action_id: 'label', label: 'Tab label (also the panel heading)' },
          { type: 'text_input', action_id: 'body', label: 'Panel text', multiline: true },
        ],
      },
      levelField('3'),
      {
        type: 'select',
        action_id: 'orientation',
        label: 'Tab list',
        initial_value: 'horizontal',
        options: [
          { label: 'Across the top', value: 'horizontal' },
          { label: 'Down the side', value: 'vertical' },
        ],
      },
      {
        type: 'toggle',
        action_id: 'hash',
        label: 'Put the selected tab in the page address (so it can be linked to)',
        initial_value: false,
      },
    ],
  },
  {
    type: 'vitops_tree',
    label: 'Tree',
    placeholder: 'An expandable outline: a file tree, a site map, nested sections',
    category: 'Sections',
    fields: [
      {
        type: 'text_input',
        action_id: 'outline',
        label: 'Outline (one per line; indent a line to nest it under the one above; add | badge)',
        multiline: true,
      },
      { type: 'text_input', action_id: 'label', label: 'Filter box label and list name' },
      {
        type: 'number_input',
        action_id: 'openDepth',
        label: 'Levels open to start (0 = all closed)',
        initial_value: 0,
        min: 0,
        max: 6,
      },
    ],
  },
  {
    type: 'vitops_hero',
    label: 'Hero',
    placeholder: 'Page opener: heading, text, buttons and an optional image',
    category: 'Sections',
    fields: [
      { type: 'text_input', action_id: 'eyebrow', label: 'Eyebrow (small line above)' },
      {
        type: 'text_input',
        action_id: 'heading',
        label: 'Heading (wrap words in *stars* to accent them)',
      },
      titleLevelField('1'),
      { type: 'text_input', action_id: 'body', label: 'Text', multiline: true },
      { type: 'text_input', action_id: 'primaryLabel', label: 'Main button text' },
      { type: 'text_input', action_id: 'primaryHref', label: 'Main button URL' },
      { type: 'text_input', action_id: 'secondaryLabel', label: 'Second link text' },
      { type: 'text_input', action_id: 'secondaryHref', label: 'Second link URL' },
      { type: 'text_input', action_id: 'image', label: 'Image URL (split layout)' },
      { type: 'text_input', action_id: 'imageAlt', label: 'Image alt text' },
      {
        type: 'select',
        action_id: 'layout',
        label: 'Layout',
        initial_value: 'centered',
        options: [
          { label: 'Centered', value: 'centered' },
          { label: 'Text and image side by side', value: 'split' },
        ],
      },
      ...toneFields(),
      {
        type: 'repeater',
        action_id: 'cards',
        label: 'Option cards under the buttons (optional)',
        item_label: 'card',
        fields: [
          { type: 'text_input', action_id: 'title', label: 'Title' },
          {
            type: 'text_input',
            action_id: 'body',
            label: 'Text (write [link text](/url) for an inline link)',
            multiline: true,
          },
          { type: 'text_input', action_id: 'href', label: 'Link URL (makes the card clickable)' },
          {
            type: 'text_input',
            action_id: 'linkLabel',
            label: 'Link text',
            initial_value: 'Learn more',
          },
        ],
      },
    ],
  },
  {
    type: 'vitops_marquee',
    label: 'Marquee',
    placeholder: 'A continuously scrolling row (logos, quotes, badges)',
    category: 'Media',
    fields: [
      {
        type: 'repeater',
        action_id: 'items',
        label: 'Items',
        item_label: 'item',
        min_items: 1,
        fields: [
          { type: 'text_input', action_id: 'text', label: 'Text' },
          { type: 'text_input', action_id: 'image', label: 'Image URL (shown instead of text)' },
          { type: 'text_input', action_id: 'alt', label: 'Image alt text' },
        ],
      },
      { type: 'toggle', action_id: 'pauseOnHover', label: 'Pause on hover', initial_value: true },
      { type: 'toggle', action_id: 'reverse', label: 'Scroll the other way', initial_value: false },
    ],
  },
  {
    type: 'vitops_logos',
    label: 'Logos',
    placeholder: 'A still row of partner or client logos',
    category: 'Media',
    fields: [
      {
        type: 'text_input',
        action_id: 'label',
        label: 'Accessible name',
        initial_value: 'Partners',
      },
      { type: 'text_input', action_id: 'kicker', label: 'Line above the row (optional)' },
      { type: 'text_input', action_id: 'note', label: 'Closing note under the row (optional)' },
      { type: 'text_input', action_id: 'linkLabel', label: 'Link text under the row (optional)' },
      { type: 'text_input', action_id: 'linkHref', label: 'Link URL' },
      {
        type: 'repeater',
        action_id: 'logos',
        label: 'Logos',
        item_label: 'logo',
        min_items: 1,
        fields: [
          {
            type: 'text_input',
            action_id: 'image',
            label: 'Image URL (leave empty to show the name as text)',
          },
          {
            type: 'text_input',
            action_id: 'alt',
            label: 'Name (alt text, or the text shown with no image)',
          },
          { type: 'text_input', action_id: 'href', label: 'Link URL (optional)' },
        ],
      },
      { type: 'toggle', action_id: 'grayscale', label: 'Grey until hovered', initial_value: false },
      {
        type: 'select',
        action_id: 'size',
        label: 'Logo height',
        initial_value: 'md',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
    ],
  },
  {
    type: 'vitops_steps',
    label: 'Steps',
    placeholder: 'A numbered sequence joined by a connector line',
    category: 'Sections',
    fields: [
      {
        type: 'repeater',
        action_id: 'steps',
        label: 'Steps',
        item_label: 'step',
        min_items: 1,
        fields: [
          { type: 'text_input', action_id: 'title', label: 'Title' },
          {
            type: 'text_input',
            action_id: 'text',
            label: 'Text (write [link text](/url) for an inline link)',
            multiline: true,
          },
        ],
      },
      levelField('3'),
      {
        type: 'select',
        action_id: 'layout',
        label: 'Layout',
        initial_value: 'column',
        options: [
          { label: 'Stacked', value: 'column' },
          { label: 'Side by side when wide', value: 'row' },
        ],
      },
      ...toneFields(),
    ],
  },
  {
    type: 'vitops_stats',
    label: 'Stats',
    placeholder: 'Headline figures that count up, or labelled tiles',
    category: 'Sections',
    fields: [
      {
        type: 'repeater',
        action_id: 'stats',
        label: 'Figures',
        item_label: 'figure',
        min_items: 1,
        fields: [
          { type: 'text_input', action_id: 'value', label: 'Figure (e.g. 82% or 11 hrs)' },
          { type: 'text_input', action_id: 'label', label: 'Label' },
          {
            type: 'text_input',
            action_id: 'group',
            label: 'Group (tiles style; small line above)',
          },
          {
            type: 'text_input',
            action_id: 'delta',
            label: 'Change (tiles style; e.g. +3 this week)',
          },
          {
            type: 'select',
            action_id: 'state',
            label: 'Change is',
            initial_value: '',
            options: [
              { label: 'Neutral', value: '' },
              { label: 'Good (up)', value: 'up' },
              { label: 'Bad (down)', value: 'down' },
            ],
          },
        ],
      },
      {
        type: 'select',
        action_id: 'variant',
        label: 'Style',
        initial_value: 'figures',
        options: [
          { label: 'Figures', value: 'figures' },
          { label: 'Tiles', value: 'tiles' },
        ],
      },
      {
        type: 'toggle',
        action_id: 'animate',
        label: 'Count up when scrolled into view',
        initial_value: true,
      },
      ...toneFields(),
    ],
  },
  {
    type: 'vitops_callout',
    label: 'Callout',
    placeholder: 'A call-to-action band (not a dismissible banner)',
    category: 'Sections',
    fields: [
      { type: 'text_input', action_id: 'heading', label: 'Heading' },
      levelField('2'),
      {
        type: 'text_input',
        action_id: 'body',
        label: 'Text (write [link text](/url) for an inline link)',
        multiline: true,
      },
      { type: 'text_input', action_id: 'primaryLabel', label: 'Main button text' },
      { type: 'text_input', action_id: 'primaryHref', label: 'Main button URL' },
      { type: 'text_input', action_id: 'secondaryLabel', label: 'Second link text' },
      { type: 'text_input', action_id: 'secondaryHref', label: 'Second link URL' },
      {
        type: 'select',
        action_id: 'align',
        label: 'Layout',
        initial_value: 'start',
        options: [
          { label: 'Message left, buttons right', value: 'start' },
          { label: 'Centered', value: 'center' },
        ],
      },
      {
        type: 'toggle',
        action_id: 'solid',
        label: 'Fill with the solid colour',
        initial_value: false,
      },
      ...toneFields(),
    ],
  },
  {
    type: 'vitops_entries',
    label: 'Entries table',
    placeholder: 'Rows of term/value pairs: a stacked list that becomes a table when wide',
    category: 'Sections',
    fields: [
      {
        type: 'repeater',
        action_id: 'entries',
        label: 'Entries',
        item_label: 'entry',
        min_items: 1,
        fields: [
          { type: 'text_input', action_id: 'heading', label: 'Heading (row name)' },
          {
            type: 'text_input',
            action_id: 'pairs',
            label: 'Details (one per line: Term | Value)',
            multiline: true,
          },
        ],
      },
      levelField('3'),
      {
        type: 'text_input',
        action_id: 'breakpoint',
        label: 'Becomes a table at this width',
        initial_value: '40rem',
      },
    ],
  },
  {
    type: 'vitops_pricing',
    label: 'Pricing',
    placeholder: 'Plan cards with aligned feature rows',
    category: 'Sections',
    fields: [
      {
        type: 'repeater',
        action_id: 'plans',
        label: 'Plans',
        item_label: 'plan',
        min_items: 1,
        fields: [
          { type: 'text_input', action_id: 'name', label: 'Plan name' },
          { type: 'text_input', action_id: 'price', label: 'Price (e.g. $49)' },
          { type: 'text_input', action_id: 'period', label: 'Period (e.g. per month)' },
          {
            type: 'text_input',
            action_id: 'yearly',
            label: 'Yearly price line (e.g. $34 paid yearly), shown under the price',
          },
          {
            type: 'text_input',
            action_id: 'note',
            label: 'Note under the plan name (e.g. Best for small teams)',
          },
          {
            type: 'text_input',
            action_id: 'features',
            label: 'Features (one per line)',
            multiline: true,
          },
          { type: 'text_input', action_id: 'ctaLabel', label: 'Button text' },
          { type: 'text_input', action_id: 'ctaHref', label: 'Button URL' },
          {
            type: 'toggle',
            action_id: 'featured',
            label: 'Highlight this plan',
            initial_value: false,
          },
        ],
      },
      levelField('3'),
    ],
  },
  {
    type: 'vitops_embed',
    label: 'Embed (video or map)',
    placeholder: 'A video or map that loads only after the visitor allows it',
    category: 'Embeds',
    fields: [
      {
        type: 'select',
        action_id: 'provider',
        label: 'Provider',
        initial_value: 'youtube',
        options: [
          { label: 'YouTube', value: 'youtube' },
          { label: 'Vimeo', value: 'vimeo' },
          { label: 'Map (Google or OpenStreetMap embed address)', value: 'map' },
          { label: 'Other (https address)', value: 'custom' },
        ],
      },
      { type: 'text_input', action_id: 'url', label: 'Address' },
      {
        type: 'text_input',
        action_id: 'title',
        label: 'Title (required: it names the frame for screen readers)',
      },
      {
        type: 'select',
        action_id: 'category',
        label: 'Consent category it waits on',
        initial_value: 'marketing',
        options: [
          { label: 'Marketing', value: 'marketing' },
          { label: 'Preferences', value: 'preferences' },
          { label: 'Analytics', value: 'analytics' },
        ],
      },
      { type: 'text_input', action_id: 'ratio', label: 'Aspect ratio', initial_value: '16 / 9' },
    ],
  },
  {
    type: 'vitops_form',
    label: 'Contact form',
    placeholder: 'An enquiry form that emails you (and your CRM) and works without JavaScript',
    category: 'Forms',
    fields: [
      { type: 'text_input', action_id: 'heading', label: 'Heading' },
      levelField('2'),
      { type: 'text_input', action_id: 'intro', label: 'Text above the form', multiline: true },
      {
        type: 'repeater',
        action_id: 'fields',
        label: 'Fields',
        item_label: 'field',
        min_items: 1,
        fields: [
          { type: 'text_input', action_id: 'label', label: 'Label (what the visitor sees)' },
          {
            type: 'text_input',
            action_id: 'name',
            label: 'Name in the message (optional: letters, digits, underscores)',
          },
          {
            type: 'select',
            action_id: 'type',
            label: 'Kind',
            initial_value: 'text',
            options: [
              { label: 'Short text', value: 'text' },
              { label: 'Email address', value: 'email' },
              { label: 'Phone number', value: 'tel' },
              { label: 'Long text', value: 'textarea' },
              { label: 'Choose one', value: 'select' },
              { label: 'Tick box', value: 'checkbox' },
              { label: 'Tick any number', value: 'checkboxes' },
            ],
          },
          { type: 'toggle', action_id: 'required', label: 'Required', initial_value: false },
          { type: 'text_input', action_id: 'placeholder', label: 'Example text' },
          { type: 'text_input', action_id: 'help', label: 'Help text under the field' },
          {
            type: 'text_input',
            action_id: 'options',
            label: 'Choices (one per line; for "Choose one" and "Tick any number")',
            multiline: true,
          },
        ],
      },
      { type: 'text_input', action_id: 'submitLabel', label: 'Button text', initial_value: 'Send' },
      {
        type: 'text_input',
        action_id: 'successMessage',
        label: 'Message after sending',
        initial_value: 'Thanks. Your message has been sent.',
      },
      { type: 'text_input', action_id: 'errorMessage', label: 'Message if sending fails' },
      {
        type: 'text_input',
        action_id: 'noJsMessage',
        label: 'Message when JavaScript is off (shown only if the site has a spam check)',
      },
      {
        type: 'text_input',
        action_id: 'action',
        label: 'Where the form posts (leave empty for /api/track)',
      },
      ...toneFields(),
    ],
  },
  {
    /**
     * Google reviews from the committed `.vitops/reviews.json` cache (`vitops reviews`).
     *
     * The data is a BUILD-TIME import (`virtual:getvitops/reviews`, from the `vitops()` Astro
     * integration), never a filesystem read: the renderer runs in a Worker. So a new review
     * appears after the next `vitops reviews` run is committed and the site rebuilt, not when
     * an editor saves. Which reviews show is `selectReviews()` from `@getvitops/utils`, the
     * one place that is decided — these fields are exactly its `ReviewLocationConfig`.
     */
    type: 'vitops_reviews',
    label: 'Google reviews',
    icon: 'star',
    placeholder: 'Customer reviews from the Google Business Profile cache',
    category: 'Sections',
    fields: [
      {
        type: 'text_input',
        action_id: 'label',
        label: 'Name for the group (read by screen readers)',
        initial_value: 'Customer reviews',
      },
      {
        type: 'text_input',
        action_id: 'location',
        label: 'Location key (organization.locations key; blank = every location in the cache)',
      },
      {
        type: 'select',
        action_id: 'layout',
        label: 'Layout',
        initial_value: 'grid',
        options: [
          { label: 'Grid', value: 'grid' },
          { label: 'Carousel', value: 'carousel' },
          { label: 'Marquee (scrolling row)', value: 'marquee' },
        ],
      },
      {
        type: 'select',
        action_id: 'columns',
        label: 'Columns (grid only)',
        initial_value: '3',
        options: ['1', '2', '3', '4'].map((n) => ({ label: n, value: n })),
      },
      {
        type: 'number_input',
        action_id: 'limit',
        label: 'Most reviews to show (0 = all)',
        initial_value: 6,
      },
      {
        type: 'select',
        action_id: 'minRating',
        label: 'Lowest rating to show',
        initial_value: '4',
        options: ['1', '2', '3', '4', '5'].map((n) => ({
          label: n === '1' ? 'Any' : `${n} stars and up`,
          value: n,
        })),
      },
      {
        type: 'select',
        action_id: 'sort',
        label: 'Order',
        initial_value: 'recent',
        options: [
          { label: 'Newest first', value: 'recent' },
          { label: 'Highest rated first', value: 'rating' },
        ],
      },
      {
        type: 'text_input',
        action_id: 'featured',
        label: 'Review ids to show first (comma-separated; they ignore the rating filter)',
      },
      {
        type: 'toggle',
        action_id: 'avatars',
        label: "Show reviewers' Google photos (loads images from Google for every visitor)",
        initial_value: false,
      },
      ...toneFields(),
    ],
  },
  {
    /**
     * A named EmDash menu inside page content: a site map, a section's link list, a footer-style
     * set of columns. NOT the header — that is `<SiteNav>` in the layout, which owns the drawer,
     * dropdowns and breakpoints. `variant: sitenav` renders the same markup and pattern for the
     * rare page that wants a real navbar in the body.
     *
     * The menu is chosen from `menus/list` (the site's own menus) with the conventional names as
     * the static fallback, because a select needs a non-empty `options` list.
     */
    type: 'vitops_nav',
    label: 'Menu',
    icon: 'list',
    placeholder: 'An EmDash menu as a list of links',
    category: 'Navigation',
    fields: [
      {
        type: 'select',
        action_id: 'menu',
        label: 'Menu',
        initial_value: 'footer-sitemap',
        options: [
          { label: 'Footer site map', value: 'footer-sitemap' },
          { label: 'Footer legal', value: 'footer-legal' },
          { label: 'Primary', value: 'primary' },
        ],
        optionsRoute: MENUS_ROUTE,
      } as BlockKitFieldDef,
      {
        type: 'text_input',
        action_id: 'label',
        label: 'Name for the navigation (read by screen readers; must differ from other menus)',
      },
      { type: 'text_input', action_id: 'heading', label: 'Visible heading (optional)' },
      levelField('2'),
      {
        type: 'select',
        action_id: 'variant',
        label: 'Layout',
        initial_value: 'list',
        options: [
          { label: 'Vertical list', value: 'list' },
          { label: 'Inline row', value: 'inline' },
          { label: 'Columns (each top-level item with its sub-links)', value: 'columns' },
          { label: 'Navbar (the header pattern, in the page)', value: 'sitenav' },
        ],
      },
      {
        type: 'select',
        action_id: 'depth',
        label: 'Levels to show',
        initial_value: '1',
        options: ['1', '2', '3'].map((n) => ({ label: n, value: n })),
      },
      ...toneFields(),
    ],
  },
  {
    /** A row of static labels (`badge`) or editable/dismissable ones (`tag`). */
    type: 'vitops_badges',
    label: 'Badges',
    icon: 'tag',
    placeholder: 'A row of short labels',
    fields: [
      {
        type: 'repeater',
        action_id: 'items',
        label: 'Labels',
        fields: [
          { type: 'text_input', action_id: 'label', label: 'Label' },
          {
            type: 'select',
            action_id: 'tone',
            label: 'Tone (blank uses the block tone)',
            initial_value: '',
            options: STATIC_TONE_OPTIONS,
            optionsRoute: TONES_ROUTE,
          } as BlockKitFieldDef,
          { type: 'text_input', action_id: 'color', label: 'Palette colour instead (e.g. amber)' },
          {
            type: 'combobox',
            action_id: 'icon',
            label: 'Icon before the label',
            placeholder: 'None',
            options: SEMANTIC_ICON_OPTIONS,
          },
          { type: 'text_input', action_id: 'href', label: 'Link URL (optional)' },
        ],
      } as BlockKitFieldDef,
      {
        type: 'select',
        action_id: 'variant',
        label: 'Style',
        initial_value: 'badge',
        options: [
          { label: 'Badge (static label)', value: 'badge' },
          { label: 'Tag', value: 'tag' },
        ],
      },
      ...toneFields(),
    ],
  },
  {
    /**
     * A widget area: content defined once under Widgets in the admin and shown wherever this
     * block is placed. Edits reach every page it sits on (after the next build, on a
     * prerendered site) — unlike a Section, which is copied.
     */
    type: 'vitops_widgetArea',
    label: 'Widget area',
    icon: 'layout',
    placeholder: 'Shared content managed under Widgets',
    fields: [
      {
        type: 'select',
        action_id: 'area',
        label: 'Widget area',
        initial_value: '',
        options: [{ label: 'Choose…', value: '' }],
        optionsRoute: WIDGET_AREAS_ROUTE,
      } as BlockKitFieldDef,
      levelField('3'),
    ],
  },
];

/** Every block gets the escape hatches last, so the editor reads content first. */
/**
 * Repeaters whose rows can carry their own colour. A row's `tone` / `color` win over the block's,
 * and blank falls back to it, so one block can hold a pine card and an amber one without
 * becoming two blocks. (If you want a single colour for the lot, set it on the block.)
 */
const ROW_TONE: Record<string, string> = {
  vitops_cards: 'cards',
  vitops_stats: 'stats',
  vitops_steps: 'steps',
  vitops_hero: 'cards',
};

/** Extra row fields for one repeater, beyond the shared tone pair. */
const rowThemeField = (): BlockKitFieldDef =>
  ({
    type: 'select',
    action_id: 'theme',
    label: 'Backdrop for this item (a tint or fill of a site colour; wins over tone)',
    initial_value: '',
    options: [
      { label: 'None', value: '' },
      ...THEME_ROLES.flatMap((r) => [
        { label: r.replace(/-/g, ' '), value: r },
        { label: `${r.replace(/-/g, ' ')} (filled)`, value: `${r}:solid` },
      ]),
    ],
    optionsRoute: THEMES_ROUTE,
  }) as BlockKitFieldDef;

const ROW_EXTRA: Record<string, Record<string, BlockKitFieldDef[]>> = {
  vitops_cards: { cards: [rowThemeField()] },
  vitops_hero: {
    cards: [
      rowThemeField(),
      { type: 'text_input', action_id: 'eyebrow', label: 'Eyebrow (small line above the title)' },
      { type: 'text_input', action_id: 'ctaLabel', label: 'Button text' },
      { type: 'text_input', action_id: 'ctaHref', label: 'Button URL' },
    ],
  },
};

const rowToneFields = (): BlockKitFieldDef[] => [
  {
    type: 'select',
    action_id: 'tone',
    label: 'Tone for this item (blank uses the block tone)',
    initial_value: '',
    options: STATIC_TONE_OPTIONS,
    optionsRoute: TONES_ROUTE,
  } as BlockKitFieldDef,
  { type: 'text_input', action_id: 'color', label: 'Palette colour instead (e.g. amber)' },
];

function withRowFields(block: PortableTextBlockDef): BlockKitFieldDef[] {
  const repeater = ROW_TONE[block.type];
  return (block.fields ?? []).map((f) =>
    f.type === 'repeater' && f.action_id === repeater
      ? ({
          ...f,
          fields: [...f.fields, ...(ROW_EXTRA[block.type]?.[repeater] ?? []), ...rowToneFields()],
        } as BlockKitFieldDef)
      : f,
  );
}

export const BLOCKS: PortableTextBlockDef[] = BASE_BLOCKS.map((b) => ({
  ...b,
  fields: [...withRowFields(b), ...commonFields()],
}));

/** Which Vitops blocks a site's editor offers, and any it adds of its own. */
export interface BlockSelection {
  /** Offer only these `vitops_*` types. Unknown names throw — a typo must not silently offer nothing. */
  include?: string[];
  /** Drop these `vitops_*` types. Applied after `include`. */
  exclude?: string[];
  /**
   * The site's own blocks. These are EDITOR definitions only: the plugin cannot render a
   * block it has never heard of, so the site maps each `type` to a component with
   * `<PortableText components={{ type: { … } }} />`. A type that collides with an existing
   * one throws, since the later definition would silently replace the earlier one's fields.
   */
  extra?: PortableTextBlockDef[];
}

/**
 * Resolve {@link BlockSelection} against {@link BLOCKS}.
 *
 * Pure so a misconfiguration fails at plugin construction, with the offending name in the
 * message, rather than as an editor menu that is quietly missing something.
 */
export function selectBlocks(selection: BlockSelection = {}): PortableTextBlockDef[] {
  const known = new Set(BLOCKS.map((b) => b.type));
  const check = (names: string[] | undefined, option: string): void => {
    for (const name of names ?? [])
      if (!known.has(name))
        throw new Error(
          `[vitops] blocks.${option}: unknown block '${name}'. Known: ${[...known].join(', ')}.`,
        );
  };
  check(selection.include, 'include');
  check(selection.exclude, 'exclude');

  const include = selection.include ? new Set(selection.include) : null;
  const exclude = new Set(selection.exclude);
  const base = BLOCKS.filter((b) => (!include || include.has(b.type)) && !exclude.has(b.type));

  const extra = selection.extra ?? [];
  const taken = new Set(BLOCKS.map((b) => b.type));
  for (const block of extra) {
    if (taken.has(block.type))
      throw new Error(`[vitops] blocks.extra: type '${block.type}' is already defined.`);
    taken.add(block.type);
  }
  return [...base, ...extra];
}
