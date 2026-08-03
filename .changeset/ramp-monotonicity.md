---
'@getvitops/generator': minor
---

Reject palettes whose ramps don't darken from 50 to 950.

Anchors and `tones` are the one thing allowed off the shared lightness ladder — that is the point of
them. But nothing checked the result was still ordered, so an anchor could put a step _above_ the
one below it. Anchoring a navy at 600 gave `600 #2c3b4e` (L 0.348) sitting above `700 #4e5c6f`
(L 0.470): every hover from `bg-<role>-solid` to `-solid-bold` then got **lighter**, which is the
exact class of drift the fixed ladder was introduced to eliminate.

Nothing caught it. `ladderWarnings` compares each pinned step against _its own_ ladder rung, never
against its neighbours — so it warned about the deviation, called the ramp "Legal", and described
the wrong defect. And since its tolerance (0.03) is the same size as the ladder's own 50→100 gap,
two anchors could each sit within tolerance and still invert with no warning at all. The one test
covering monotonicity built its palette from anchor-free seeds, so it never exercised the path.

The build now fails, in the same place and for the same reason as the contrast contract: the order
is load-bearing (`snap` picks the nearest step by ladder lightness, the mode-stable solid family
hard-codes 600/700/800, the dark tables re-point steps on the same assumption), and an inversion is
always author-caused and therefore always actionable. The message names the pair, the consequence,
and where the colour you wrote actually belongs:

```
colors.palette.navy: step 700 (#4e5c6f, L 0.470) is LIGHTER than step 600 (#2c3b4e, L 0.348).
  A ramp must darken from 50 to 950 — inverted, a hover from `bg-<role>-solid` to `-solid-bold`
  gets lighter, and the dark-mode tables re-point steps assuming the order.
  #2c3b4e (pinned at 600) sits at L 0.348, nearest step 800.
```

Sparse `tones` kits are compared over present steps only, and gamut-mapping noise is tolerated, so
neither reports a false inversion. `ladderWarnings` is unchanged and still a warning.
