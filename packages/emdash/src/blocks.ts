/**
 * Portable Text block-type declarations for the EmDash editor.
 *
 * v1 exposes only Vitops patterns whose data model fits EmDash's flat Block Kit
 * fields (text_input / number_input / select / toggle). Repeating structured
 * patterns (Cards, wc-entries, FAQ, forms) go through EmDash Sections or
 * Field Kit `list` widgets on json collection fields instead — see the README.
 *
 * Every `action_id` here must have a matching prop consumed by the block's
 * .astro component in `src/astro/blocks/` (enforced by blocks.test.ts).
 */

import type { PortableTextBlockConfig } from 'emdash';
import { SEMANTIC_ICON_OPTIONS } from './icon-options.ts';

/** The v1 subset of EmDash Block Kit field elements used by these blocks. */
export type BlockKitFieldDef = Extract<
  NonNullable<PortableTextBlockConfig['fields']>[number],
  { type: 'text_input' | 'number_input' | 'select' | 'toggle' | 'combobox' }
>;

export type PortableTextBlockDef = Omit<PortableTextBlockConfig, 'fields'> & {
  fields?: BlockKitFieldDef[];
};

export const BLOCKS: PortableTextBlockDef[] = [
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
     * raw HTML), so `<icon-picker>` cannot be mounted inside a block modal
     * however much nicer it would be. Revisit if EmDash opens that union.
     */
    type: 'vitops.actionLink',
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
    type: 'vitops.imageCompare',
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
    type: 'vitops.copyButton',
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
    type: 'vitops.banner',
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
    type: 'vitops.details',
    label: 'Disclosure',
    placeholder: 'Collapsible details/summary',
    fields: [
      { type: 'text_input', action_id: 'summary', label: 'Summary (always visible)' },
      { type: 'text_input', action_id: 'body', label: 'Body (revealed)', multiline: true },
      { type: 'toggle', action_id: 'open', label: 'Open by default', initial_value: false },
    ],
  },
  {
    type: 'vitops.carousel',
    label: 'Carousel',
    placeholder: 'Image carousel',
    fields: [
      {
        type: 'text_input',
        action_id: 'images',
        label: 'Image URLs (one per line)',
        multiline: true,
      },
      {
        type: 'text_input',
        action_id: 'alts',
        label: 'Alt texts (one per line, same order)',
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
    ],
  },
];
