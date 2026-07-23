// EmDash live content collections — required for getEmDashCollection /
// getEmDashEntry to resolve through Astro's content layer.
import { defineLiveCollection } from 'astro:content';
import { emdashLoader } from 'emdash/runtime';

export const collections = {
  _emdash: defineLiveCollection({ loader: emdashLoader() }),
};
