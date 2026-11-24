/**
 * Canada's Anti-Spam Legislation (CASL) paragraph — federal, so shared by the
 * `ca` and `qc` privacy policies.
 *
 * Deliberately small, and rendered ONLY when the config shows the site collects
 * newsletter/subscription sign-ups (`PolicyVars.newsletterSignup`). That is the
 * one fact the config holds about commercial e-mail; everything else CASL asks of
 * a sender (proof of consent records, sender identification in each message,
 * the unsubscribe mechanism actually working) is practice the config cannot see.
 * So this states what the sign-up itself is, and what the law requires, and
 * stops: it does not promise a process. Counsel should confirm it against how
 * messages are actually sent — the document's review banner says so.
 */
import type { PolicyVars } from '../derive.ts';

export function caslSection(v: PolicyVars): string {
  if (!v.newsletterSignup) return '';
  return `
### Commercial Electronic Messages

If you subscribe to our newsletter or otherwise ask to receive commercial electronic messages from us, we treat that request as your consent to receive them. Under Canada's Anti-Spam Legislation, each such message must identify who sent it and include a way to unsubscribe, and you may withdraw your consent at any time using the "unsubscribe" link in a message or by contacting us at ${v.mailingAddress}.
`;
}
