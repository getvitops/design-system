import type { Elmnt, Link, TextLink, ImageLink } from '../types.js';
import type { HTMLTag } from 'astro/types';

export function isElmnt<T, Tag extends HTMLTag = 'div'>(item: any): item is Elmnt<T, Tag> {
  return item && item.type === 'element';
}

export function isLink(item: any): item is Link {
  return item && ('label' in item || 'image' in item) && 'href' in item;
}

export function isTextLink(item: any): item is TextLink {
  return item && 'label' in item && 'href' in item;
}

export function isImageLink(item: any): item is ImageLink {
  return item && 'image' in item && 'href' in item;
}
