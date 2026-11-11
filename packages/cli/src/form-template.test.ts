import { describe, expect, it } from 'vite-plus/test';
import { findFormBlocks, withTemplate } from './form-template.ts';

describe('findFormBlocks', () => {
  it('finds forms at any depth, in document order', () => {
    const doc = {
      pages: [
        { data: { content: [{ _type: 'vitops_form', _key: 'a' }, { _type: 'block' }] } },
        {
          data: {
            blocks: [{ _type: 'vitops_section', body: [{ _type: 'vitops_form', _key: 'b' }] }],
          },
        },
      ],
    };
    expect(findFormBlocks(doc).map((b) => b['_key'])).toEqual(['a', 'b']);
  });
  it('finds nothing in a document with no form', () => {
    expect(findFormBlocks({ a: [1, { _type: 'block' }] })).toEqual([]);
  });
});

describe('withTemplate', () => {
  it('adds the entry and leaves the rest of the config alone', () => {
    const { config, changed } = withTemplate(
      { organization: { name: 'X' }, site: { seo: {} } },
      'contact',
      {
        type: 'form',
      },
    );
    expect(changed).toBe(true);
    expect(config).toEqual({
      organization: { name: 'X' },
      site: { seo: {}, templates: { contact: { type: 'form' } } },
    });
  });
  it('is a no-op the second time', () => {
    const first = withTemplate({}, 'contact', { type: 'form', fields: [] });
    expect(withTemplate(first.config, 'contact', { type: 'form', fields: [] }).changed).toBe(false);
  });
});
