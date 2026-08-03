---
'@getvitops/generator': minor
'@getvitops/core': minor
'@getvitops/astro': minor
---

Animation families that never actually animated, and a driver that fired before you could see it.

Each of these looked correct in source and failed somewhere else — in the bundler, in hit-testing,
or in the difference between a time-based and a progress-based timeline. Nothing here needs a
markup change.

**Changed: entrances are now timed off the element's midpoint.** Every driver used to key off a
fraction of the element's _own height_, which meant the same class behaved differently on a 4rem
card and a full-bleed section — and on small elements it was over before they appeared
(`entry 20%` is about 17px of scroll for a 5.5rem tile). Motion now starts once the element's
**midpoint is 10% of the viewport in**, and a one-shot entrance completes at **25%**. This applies
to `animate-view` and to the `.is-active` observer that drives `animate-trigger` and the
`active-<fx>` transition variants, so everything on a page starts at the same moment on screen.

The pivot is `entry 50%` — the one point that means "midpoint on the viewport edge" for an element
of any height — plus a viewport length. Shift the window with `--anim-start` / `--anim-end`, or
replace it with `--anim-range`. `--stagger-range-step` is now a viewport length (`5vh`) to match.

**Fixed: every journey ran on a truncated range.** The generator emitted `animation-range: entry
exit`; lightningcss parsed the end of that shorthand as `exit 0%` rather than the spec's `exit
100%`, so the bundle shipped `entry exit 0%`. Journeys reach their `100%` keyframe — the hidden
`from` state — as the element hits the top of the viewport, which is to say they faded out while
still fully on screen. Journeys now run `entry calc(50% + 10vh) → exit 100%`: they start on the same
midpoint pivot as everything else and keep the full entry → hold → exit arc, so the hold sits in the
middle of the crossing. `animation-effects.test.ts` asserts on the **bundled** css, because the
emitter was right the whole time.

**Fixed: `slide-journey` had no distance to travel.** `animations.journeys.base.slide` was `{}` in
both `defaultConfig()` and the shipped example, so the keyframe animated `translate: 0 → 0`. It now
declares `translate-y-from: var(--slide-distance, 2rem)` — the same var the `slide-up` effect uses,
so one knob tunes both. If your own config has an empty `slide` base, add the same line.

**Fixed: `reveal-*` on hover was unreachable.** A `hover-reveal-left` element rests at `clip-path:
inset(0 100% 0 0)`, and `clip-path` clips **hit-testing** as well as painting — so it had zero
hittable area and could never receive the hover that would reveal it. The state variants now match
the element **or its direct parent**, mirroring what `animation.css` already did for the trigger
driver (`:is(.is-active, [data-active]) > .animate-trigger`):

```css
.hover-<fx>:hover, :hover > .hover-<fx> { … }
.focus-<fx>:focus-visible, :focus-within > .focus-<fx> { … }
```

Specificity is unchanged (0-2-0), so nothing reorders. **Behaviour change:** a `hover-<fx>` element
that is a direct child of a hovered element now flips with its parent. Wrap it in an intermediate
element if you need the old element-only behaviour.

**Fixed: `.stagger` did nothing on a scroll-driven timeline.** It offsets children with
`animation-delay`, which is time-based and is ignored outright on a `view()` / `scroll()` timeline,
so `.stagger > .animate-view` arrived all at once. It now also offsets each child's view
`animation-range` by the same index, so one class works under both driver families — tune the
scroll-driven step with `--stagger-range-step` (default `5vh`). Journeys declare their own range and
opt out by construction.

Two smaller faults found alongside it: `@supports (--x: sibling-index())` is **always true** — any
token stream is a valid custom-property value — so the guard around `sibling-index()` guarded
nothing in both `.stagger` and `.subgrid`'s row index, and on an engine without support the
declaration went invalid rather than being skipped. Both now test a real property. And the CSS path
was 1-based while the JS fallback wrote 0-based, so the two disagreed by one step wherever both ran.

**Fixed: the pre-paint `<html>` class script was missing entirely.** `<Head />` now emits it again,
outside the `webComponents` block since it gates stylesheet behaviour rather than the element
runtime. It does two things `animation.css` depends on and that three other files documented as
already shipping:

- `no-js` → `js`, so `.animate-trigger` is paused only where JS can un-pause it;
- `.no-scroll-timeline` when `animation-timeline: view()` is unsupported, which is what cancels
  `.animate-view` / `.animate-scroll`. Scroll-driven animations are deliberately **not** polyfilled,
  so without this flag those elements sit at their `from` keyframe — `opacity: 0`, i.e. invisible
  content — on any engine without support. It had been dropped in the move to publishable packages,
  leaving the cancel rule as dead code.

**New: `hover-size-grow` and friends exist.** The layout effects (`size-grow`, `size-shrink`) were
the one family with no state variants, on the grounds that `.transition` doesn't cover `height`.
That wasn't a platform limit — `height: 0 → auto` just needs `interpolate-size: allow-keywords`,
which the framework already sets on `:root`, and which the `layout` **keyframe** depended on
equally. So the exclusion bought no portability; it only made `hover-size-grow` a class the docs
advertised and the stylesheet didn't define. `.transition` now declares `height` inside an
`@supports (interpolate-size: allow-keywords)` block, and the generator emits the full
`hover-`/`focus-`/`active-` set for layout effects, carrying each effect's own `overflow: clip` so a
collapsed box hides its content instead of spilling it. Where `interpolate-size` is missing, the
height simply doesn't transition — the same degradation the keyframe path has. (For the record:
`transition-behavior: allow-discrete` is _not_ the tool here — it only lets genuinely discrete
properties transition, and would snap at the midpoint.)

`.transition` switched from the `transition` shorthand to `transition-property` +
`transition-duration` + `transition-timing-function`, so the gated block can append `height` without
restating the list. If you override `.transition`'s timing, override the longhands.

The generated class reference (`vitops docs classes`) was the upstream source of that mismatch — it
listed every effect under "with the state prefixes above", including the layout ones. It now states
which stage needs the feature gate, when each driver plays, and how `stagger` composes with both.
