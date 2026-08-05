/**
 * Ad-click attribution — the vocabulary, the cookie, and the conversion event.
 *
 * Framework-agnostic and needed on both sides of the wire: the browser capture
 * script (delivered by `@getvitops/astro`) and whatever server runtime handles the
 * conversion both read from here. Nothing in this module touches the DOM, the
 * network, a filesystem or a clock — every function that needs "now" takes it as
 * an argument — so it runs unchanged in a Worker, in Node, and in a test.
 *
 * See `@getvitops/utils/notify` for turning a `ConversionEvent` into a
 * notification.
 */
export {
  AB_COOKIE,
  CLICK_ID_PARAMS,
  PLATFORM_PARAMS,
  TRACKED_PARAMS,
  TRACKING_COOKIE,
  TRACKING_COOKIE_DAYS,
  UTM_PARAMS,
} from './params.ts';

export {
  cookieAttributes,
  mergeTracking,
  parseTrackingCookie,
  readCookie,
  serializeTrackingCookie,
} from './cookie.ts';

export { getPrimaryClickId, identifyPlatform } from './platform.ts';

export type { ConversionEvent, TrackingCategory, TrackingConfig, TrackingData } from './types.ts';
