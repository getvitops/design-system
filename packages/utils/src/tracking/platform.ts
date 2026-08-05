/**
 * Naming the source of a visit.
 *
 * Both functions return the **first** match in `PLATFORM_PARAMS` order rather
 * than collecting every one, because a notification needs an answer, not a list.
 * A URL carrying two click IDs is a real case — a Google Ads link retargeted
 * through Meta — and the precedence in the table is the tiebreak.
 */
import { CLICK_ID_PARAMS, PLATFORM_PARAMS } from './params.ts';
import type { TrackingData } from './types.ts';

/**
 * Which platform sent this visitor.
 *
 * Falls back to `utm_source` when no click ID is present: a UTM-tagged link from
 * a newsletter or a partner site is still attribution, just self-declared rather
 * than platform-issued. Returns null when there is nothing to go on.
 */
export function identifyPlatform(data: TrackingData): string | null {
  for (const param of CLICK_ID_PARAMS) {
    if (data[param]) return PLATFORM_PARAMS[param] ?? null;
  }
  const source = data['utm_source'];
  return typeof source === 'string' && source ? source : null;
}

/** The click ID to quote, with the parameter it came from. */
export function getPrimaryClickId(data: TrackingData): { param: string; value: string } | null {
  for (const param of CLICK_ID_PARAMS) {
    const value = data[param];
    if (value) return { param, value: String(value) };
  }
  return null;
}
