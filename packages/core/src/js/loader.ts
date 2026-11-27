/**
 * On-demand entry (`dist/loader.js`): find the `<wc-*>` tags a page uses, import only those
 * modules, and keep watching for tags that arrive later. See `loader-core.ts`.
 */
import { expose, setBase, start } from './loader-core.ts';

if (typeof document !== 'undefined') {
  setBase(new URL('./elements/', import.meta.url).href);
  expose();
  start();
}
