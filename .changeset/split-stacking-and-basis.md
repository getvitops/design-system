---
'@getvitops/generator': minor
'@getvitops/core': minor
---

`.split` gets a stacking convention, a reversal, and a ratio that actually holds.

**Fixed: a padded column silently broke the ratio.** `.split > *` was `flex: 1` — a zero basis plus
a grow factor — and `flex-grow` shares out only the _free_ space, which a child's padding is not
part of. So a padded column came out wider than its sibling by exactly its horizontal padding, and
`.split-1-2` quietly stopped being 1:2. Measured in Chrome: an equal `.split` 1000px wide with 40px
of padding a side on one child resolved 540/460, and `split-1-2` resolved 387/613. The ratio is now
a **flex basis**, which sizes the border box, so padding sits inside the share: 500/500 and 333/667.
Nothing to change in your markup — ratios that looked slightly off now land where they read.

Two consequences worth knowing. The basis applies only to a **two-child** split, because a ratio is
a pair contract (only `:first-child` and `:last-child` ever carried one) and with three or more
children a middle child would collapse to zero; those keep the previous behaviour. And the ratio
only holds on **border-box** children — a basis sizes the border box, and under content-box the
padding lands outside the share again, reproducing the exact defect. That is what the new global
border-box reset is for (see its own note); `.split > *` restates it so the pattern still holds if
you override the reset in a layer of your own.

**Fixed: long unbreakable content stretched a column.** `.split > *` now carries
`min-inline-size: 0`. A flex item's automatic minimum is its min-content size, so a URL, a code span
or a `<pre>` used to push its column past its share — and every consumer re-derived `min-w-0` to
stop it. It belongs to the pattern.

**Stacking is now a two-class idiom, using `flex-col` you already have.**

```html
<div class="split flex-col md-split-1-2 gap-l"></div>
```

Stacked below 48rem, 1:2 above. What happens when there isn't room for two columns was the question
`.split` never answered, so every project re-derived
`flex flex-col gap-… lg-flex-row lg-items-start lg-split`. The `sm-`/`md-`/`lg-`/`xl-` ratio classes
now assert `flex-direction: row`, which is what un-stacks the pair at the breakpoint. There is
deliberately **no** `.split-stack`: it would be `flex-col` under a second name.

`.flex-col` wins because `.split` is a **pattern** and every utility sits one cascade layer above
it — see the layering note in this release. `.md-split-1-2` then wins because a breakpoint-scoped
utility sorts after an unscoped one, which is stable in both formats. (`.split` itself now states
`flex-direction: row`, so a host that defaults an element to `column` — Bricks' block element —
can no longer stack it by accident, as long as that host's rule is itself layered.)

While stacked the ratio goes inert on its own and needs no reset: a percentage flex basis resolved
against an auto-height column container behaves as `content`. It does apply if you give the split a
definite `block-size`, which is a ratio in the block axis — what asking for one on a fixed-height
column means.

**New `.split-reverse`** (breakpoint-prefixable) — swaps the two panels. It is `order` on the first
child rather than `row-reverse`, so it reverses on **whichever axis the split is currently on**:
bare, it swaps the columns in a row _and_ the rows in a stack; scoped to a breakpoint
(`md-split-reverse`) it swaps only once there are two columns — put the media first in source and it
leads on mobile while sitting on the right at width. The ratio stays attached to the source-first
child, not to visual position.

> **Accessibility.** Reversing puts visual order out of step with DOM order, and focus order follows
> the DOM (WCAG 2.4.3 Focus Order) — so a keyboard user tabs through a reversed split in the order it
> is written, not the order it is seen. Put focusable content in **only one** of the two panels. The
> pattern declares `reading-flow: flex-visual`, which fixes this properly where it is supported;
> support is not yet broad enough to rely on, and an unknown property is inert, so treat it as an
> enhancement rather than a guarantee.

**New `.flex-row-reverse` / `.flex-col-reverse`** (breakpoint-prefixable) in the `css` and `bricks`
formats. These names were already in the list the `tailwind` format defers to Tailwind for, but
they were never defined here — so a mirrored row was inexpressible in framework classes in the two
formats with no fallback.
