/**
 * EmDash Live Content Collections.
 *
 * Defines the _emdash collection that serves all content types from the
 * database. Query it with getEmDashCollection() / getEmDashEntry().
 */
import { defineLiveCollection } from 'astro:content';
import { emdashLoader } from 'emdash/runtime';

export const collections = {
  _emdash: defineLiveCollection({ loader: emdashLoader() }),
};
