---
'@getvitops/generator': minor
'@getvitops/utils': minor
'@getvitops/astro': minor
'@getvitops/cli': minor
---

Add `vitops indexing` — tell search engines about a deploy, instead of opening Search Console by hand.

Configure it in your site config under `seo.indexing`, then run it after deploying:

```jsonc
"seo": {
  "indexing": {
    "indexNow": { "key": "…" },
    "searchConsole": { "siteUrl": "sc-domain:acme.ca" },
    "priorityUrls": ["https://acme.ca/", "https://acme.ca/services"]
  }
}
```

```
vitops indexing --dry     # print the plan, make no requests
vitops indexing           # submit
vitops indexing --check   # a day or two later: did Google actually index them?
```

It reads your sitemap, diffs it against the previous run, and submits only what changed —
pinging **IndexNow** and re-submitting your sitemap through the **Search Console API**.
`--check` inspects `priorityUrls` and exits non-zero on a page Google hasn't indexed, so a
scheduled CI job can catch a page that quietly fell out of the index.

**Be clear-eyed about what this can do.** Google exposes no API that requests indexing — the
button in Search Console isn't available anywhere, URL Inspection is read-only, and the sitemap
ping endpoint was removed in 2023. IndexNow reaches Bing, Yandex, Naver, Seznam and Yep; Google
doesn't participate. So this automates every sanctioned step and then verifies the outcome; it
does not make Google re-index on demand, and nothing can. Google's Indexing API is deliberately
not wired: it's scoped to job postings and livestreams, and using it for ordinary pages violates
its terms.

Also new, and worth wiring at the same time — **`gitLastmod()` for real sitemap dates**:

```js
import vitops, { gitLastmod } from '@getvitops/astro';
vitops({ sitemap: { serialize: await gitLastmod() } });
```

`@astrojs/sitemap` emits no `<lastmod>` by default, which means a crawler is told your pages
exist but never that one changed — and it's what lets `vitops indexing` submit a handful of URLs instead
of all of them. `gitLastmod()` derives each date from the source file's last commit, and leaves a
page alone rather than guessing (dynamic routes, ambiguous slugs, shallow clones): an inaccurate
`lastmod` is worse than none, because Google stops trusting the field site-wide.

Requires `fetch-depth: 0` in CI — the default shallow clone has no history to read, and it warns
when that's the case.

**Credentials.** IndexNow's key is public by design (it's served at `/<key>.txt` as the ownership
proof), so it lives in your config, and the Astro integration writes the file into `public/` for
you — `vitops indexing --new-key` generates one, `--write-key <dir>` writes it for non-Astro stacks.
Search Console needs a service account in `VITOPS_GSC_SERVICE_ACCOUNT` or
`GOOGLE_APPLICATION_CREDENTIALS`, added as an owner of the property; it's never read from the
config file.

Persist `.vitops/` between runs (a CI cache) — that's the changed-URL state, and without it every
run submits everything.

An environment whose `robots` policy says `noindex` is refused outright, so pointing this at
staging can't publish it to a search engine.
