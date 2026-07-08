# Arc Orientation Regression Report

## What broke

M40b replaced several handwritten Exercise 354 arc strings with reusable arc helpers. The generated SVG paths could then select the opposite side of a chord: right-arm arcs bent inward, rounded slot caps faced the wrong way, and circular void halves could choose the wrong semicircle.

## Root cause

The helpers emitted SVG arc `sweepFlag` as if `clockwise` meant SVG/canvas visual clockwise, but their internal sweep delta and three-point inclusion logic treated increasing `atan2` as counterclockwise. In SVG/canvas coordinates, +x points right and +y points down, so increasing the angle moves visually clockwise.

## Helpers fixed

- `createArcFromThreePoints` now chooses the sweep that actually contains the through point in SVG/canvas y-down coordinates.
- `createArcFromCenterRadius` and `createArcFromCenterStartEnd` now compute large-arc selection with the same visual sweep convention used by SVG lowering.
- `createTangentArcBetweenLines` now maps local cross-product orientation into the corrected visual sweep convention.
- `sampleArcResult` provides a numeric regression check for midpoint and side-of-arc assertions.

## Exercise 354 impact

- Rounded slot caps now bulge outward: the right cap to the right and the left cap to the left.
- The right-arm end arc now bulges outward instead of cutting inward.
- Circular void subpaths now use upper and lower semicircle sweeps explicitly.
- The blockout lower arc cue continues to lower through its intended guide-side point.

## Coordinate convention

MachinaCanvas arc helpers use SVG/canvas coordinates: +x right, +y down.

ArcSweep values describe visual clockwise/counterclockwise motion in that y-down coordinate system.

## Visual evidence

- `apps/machina-canvas/artifacts/mechanical-exercise-354.render.svg`
- `apps/machina-canvas/artifacts/mechanical-exercise-354.preview.png`
- `apps/machina-canvas/artifacts/mechanical-exercise-354-blockout.render.svg`
- `apps/machina-canvas/artifacts/mechanical-exercise-354-blockout.preview.png`
- `apps/machina-canvas/artifacts/arc-orientation-fixture.svg`
- `apps/machina-canvas/artifacts/arc-orientation-fixture.png`

## Remaining caveats

Exercise 354 remains a hand-authored approximation rather than solved CAD. Unsupported tangent-reference combinations still return explicit errors instead of guessing.
