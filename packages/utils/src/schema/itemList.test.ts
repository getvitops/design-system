import { describe, expect, it } from 'vitest';
import { itemListGraph } from './itemList.ts';

describe('itemListGraph', () => {
  it('numbers items 1-based and nests each as an item with @type/name/url', () => {
    const graph = itemListGraph({
      items: [
        { type: 'Article', name: 'First', url: 'https://example.com/first' },
        { type: 'Article', name: 'Second', url: 'https://example.com/second' },
      ],
    });

    expect(graph.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        item: { '@type': 'Article', name: 'First', url: 'https://example.com/first' },
      },
      {
        '@type': 'ListItem',
        position: 2,
        item: { '@type': 'Article', name: 'Second', url: 'https://example.com/second' },
      },
    ]);
  });

  it('includes image and description only when passed', () => {
    const graph = itemListGraph({
      items: [{ type: 'Product', name: 'Widget', url: 'https://example.com/widget' }],
    });

    const item = (graph.itemListElement as Record<string, unknown>[])[0]!.item as Record<
      string,
      unknown
    >;
    expect(item).not.toHaveProperty('image');
    expect(item).not.toHaveProperty('description');

    const withExtras = itemListGraph({
      items: [
        {
          type: 'Product',
          name: 'Widget',
          url: 'https://example.com/widget',
          image: 'https://example.com/widget.jpg',
          description: 'A widget.',
        },
      ],
    });
    const itemWithExtras = (withExtras.itemListElement as Record<string, unknown>[])[0]!
      .item as Record<string, unknown>;
    expect(itemWithExtras.image).toBe('https://example.com/widget.jpg');
    expect(itemWithExtras.description).toBe('A widget.');
  });

  it('omits the top-level name when not passed', () => {
    const graph = itemListGraph({
      items: [{ type: 'Product', name: 'Widget', url: 'https://example.com/widget' }],
    });
    expect(graph).not.toHaveProperty('name');
  });

  it('includes the top-level name when passed', () => {
    const graph = itemListGraph({
      name: 'Industries Vitops works with',
      items: [{ type: 'Product', name: 'Widget', url: 'https://example.com/widget' }],
    });
    expect(graph.name).toBe('Industries Vitops works with');
  });

  it('accepts an entity type outside the six carousel rich-result types', () => {
    const graph = itemListGraph({
      items: [
        { type: 'Thing', name: 'Trades and contractors', url: 'https://example.com/#trades' },
      ],
    });
    const item = (graph.itemListElement as Record<string, unknown>[])[0]!.item as Record<
      string,
      unknown
    >;
    expect(item['@type']).toBe('Thing');
  });
});
