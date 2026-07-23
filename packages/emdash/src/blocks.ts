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

/** The v1 subset of EmDash Block Kit field elements used by these blocks. */
export type BlockKitFieldDef = Extract<
  NonNullable<PortableTextBlockConfig['fields']>[number],
  { type: 'text_input' | 'number_input' | 'select' | 'toggle' }
>;

export type PortableTextBlockDef = Omit<PortableTextBlockConfig, 'fields'> & {
  fields?: BlockKitFieldDef[];
};

export const BLOCKS: PortableTextBlockDef[] = [
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
