---
'@getvitops/utils': minor
'@getvitops/generator': minor
---

A chroma-0 seed now produces an actual neutral instead of a pink one.

Beyond a ramp's outermost authored colour, chroma decays towards a small endpoint value (0.008
light / 0.015 dark) so the near-white and near-black ends keep a whisper of the hue. That was
written as a lerp _target_, and the interpolation factor reaches exactly 1 at steps 50 and 950 for
every anchor position — so the endpoints were those constants **unconditionally**. Seeds at chroma
0.001, 0.002, 0.05 and 0.2 all produced a byte-identical `#f5f9fe` at step 50.

There was therefore no seed that yielded a plain neutral, and chroma 0 was the worst case: a true
achromatic colour has no hue (colorjs returns NaN), which collapses to 0 — red — so asking for grey
gave you `#fdf6f8`, a pink. A brand wanting plain white with grey panels had to discover `anchors`
to get there.

The endpoint is now a **ceiling** rather than a target, so a seed below it keeps its own chroma:

| seed chroma | step 50 before | step 50 after |
| ----------- | -------------- | ------------- |
| 0           | `#fdf6f8` 🩷   | `#f8f8f8`     |
| 0.001       | `#f5f9fe`      | `#f8f8f9`     |
| 0.003       | `#f5f9fe`      | `#f7f8fa`     |
| 0.05        | `#f5f9fe`      | `#f5f9fe`     |

`seed: "#808080"` now gives a real grey ramp — `#f8f8f8` / `#eee` / `#808080` / `#2b2b2b` / `#181818`.

**No existing palette moves.** The ceiling only binds below itself, and every ordinary brand hue
sits above it; the repo's own `tokens.json` is byte-identical across this change.
