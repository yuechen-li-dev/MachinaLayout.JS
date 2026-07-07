# Exercise 354 Blockout Method Plan

## Reference interpretation

Exercise 354 reads as a single plate-like body with a large left boss, a horizontal right arm, a lower lobe, one large circular bore, two small lower holes, and an obround slot in the arm. The previous filled-topology pass made the material and voids legible, but the outer contour still felt too freehand because the large boss, right arm, lower lobe, and holes were not first placed into explicit construction masks.

## Stage 1: Global bounding/datum mask

Start with the overall part envelope, then place the main horizontal datum through the large bore and right slot. Add the main vertical datum through the large bore center. Add lower extent lines for the bottom lobe and small-hole region so the lower curve has a construction target instead of being guessed after the body is drawn.

## Stage 2: Feature blockout mask

Place green feature boxes for the large boss, large inner hole, right arm, obround slot, lower lobe/body region, and the two small holes. These boxes are guide geometry: they establish composition and feature relationships, but they are not manufacturing edges.

## Stage 3: Lowering masks into geometry

Lower the large boss box into a round left mass, the inner-hole box into the large circular void, the right-arm box into a horizontal arm with a rounded right end, and the slot box into an even-odd obround void. Lower the lower-lobe box and lower arc cue into the bottom sweep, while keeping the small holes centered inside their boxes.

## Stage 4: Filled topology rendering

Author the final body as one blue filled path with `fillRule: "evenodd"`. Put the large bore, both small holes, and the slot into the same path as void subpaths, and keep visible outline/void strokes above the fill for drafting readability.

## Stage 5: Annotation pass

Render centerlines, datum/construction lines, radius callouts, linear dimensions, angle dimension, exercise notes, and title block above the filled body. Use the annotations to explain the construction-derived result, not to hide unresolved shape guesses.

## Expected friction

The blockouts will clarify placement, but they will not solve tangent continuity, radius-center exactness, or the exact lower outer spline. The bottom lobe and left neck transitions still need manual judgement until MachinaCanvas has first-class mechanical guide/blockout records or a lightweight tangent/arc authoring helper.
