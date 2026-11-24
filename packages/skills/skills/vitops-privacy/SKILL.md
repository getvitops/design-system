---
name: vitops-privacy
description: Use when a site collects personal information (forms, newsletters, email marketing, CRM), runs analytics, cookies, tracking or ads, needs a privacy policy or cookie notice, or a client asks about CASL, PIPEDA, Quebec Law 25, provincial privacy law or GDPR. Informational background for flagging risk; not legal advice.
---

# Privacy and anti-spam law for client sites

We are an Ottawa, Ontario agency serving clients across Canada, mostly Ontario. Clients may be bound by
privacy and anti-spam law, and some knowingly accept risk. This skill gives you background so you can spot
issues and describe them accurately. It is not legal advice, and it never certifies anything.

## The law changes, so this skill is dated

Every topic file has a `verified:` date and lists the primary sources it was read from. Treat the contents
as a starting point, not as the current law.

- Before a legal fact drives a decision, a client-facing statement or a config value, re-check it at the
  primary source named in that file's "How to re-check" section.
- **Always** re-check if `verified` is more than 180 days before today.
- Where the source and this skill disagree, **the source wins**. Tell the user the skill needs updating and
  which line was wrong.
- Items marked `unverified` were not confirmed from a primary source. Do not repeat them to a client as fact.

## Inform, do not enforce

- Never block work, refuse a client's choice, or quietly change behaviour to a standard the client did not
  adopt (for example swapping their analytics, adding consent rows, or changing the legal jurisdiction).
- Do report the gap, the plausible risk, and the relevant topic file, in plain terms.
- Record the client's decision (accept, defer, fix) where the project keeps decisions, so the next session
  does not re-litigate it.
- Never say a site "is compliant". Say what is configured and what the open questions are, and that counsel
  should confirm. The generated legal documents carry the same review banner for the same reason.

## How the toolchain models privacy (pointers)

Read `AGENTS.md` in the toolchain repo (and `vitops docs`) for the detail; do not duplicate it here.

- **Config records facts; templates own prose.** `packages/generator/src/legal/` renders the privacy policy,
  terms and cookie notice (`vitops legal`). The fix for a wrong policy is a corrected config, not a hand edit.
- **Jurisdictions:** only `ca` (PIPEDA-oriented) and `qc` (Quebec Law 25) exist today. Nothing for the EU, UK or
  other provinces.
- **Consent gate:** `<wc-consent>`, `data-consent`, inert `type="text/plain"` tags, banner shown only when
  something demands it, nothing stored until the visitor chooses. See the `vitops-consent` skill.
- **PII inventory:** `site.templates` entries of type `form` determine what the policy says is collected.
- **Providers named in the notice:** `site.analytics`, `site.ads`, `site.crm`, plus anything else in
  `site.legal.privacyPolicy.processors`. A tag that runs but is not in the config is a gap.
- **Analytics default:** Plausible (no cookies, so usually no banner); Matomo for Canadian-residency clients.
  See the analytics notes before changing either.
- **Related skills:** `vitops-ads` (pixels, attribution cookie `_ac`), `vitops-consent`, `vitops-csp`.

## Topic index

| Topic                                              | File                 | Load when                                                          |
| -------------------------------------------------- | -------------------- | ------------------------------------------------------------------ |
| Federal privacy law (PIPEDA) and pending Bill C-36 | `pipeda.md`          | Any Canadian site collecting personal information, tracking or ads |
| Quebec Law 25                                      | `quebec-law-25.md`   | Quebec visitors or a Quebec client; `qc` templates                 |
| CASL                                               | `casl.md`            | Newsletters, marketing email or SMS, CRM follow-up, sign-up forms  |
| Alberta, BC, Ontario                               | `other-provinces.md` | Client based in Alberta or BC; "what about Ontario?"               |
| EU GDPR and ePrivacy                               | `eu-gdpr.md`         | A client targeting EU users; "do we need GDPR?"                    |

Start from the file that matches the question, check its `verified` date, then re-check at the source.
