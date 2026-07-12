# Exercise 354 Blockout Process Notes

## What I tried

I retried Exercise 354 as a staged authoring pass instead of starting with the final contour. First I placed a red global bounding box and datums, then green feature blockout boxes for the boss, large hole, right arm, slot, lower body region, two small holes, and an inside relief cue. Only after those masks existed did I lower the boxes into a blue filled body profile with even-odd voids and semantic mechanical annotations.

## What the global mask clarified

The global bounding box helped because it gave the drawing a fixed envelope before I touched curves. The horizontal datum through the large bore and slot was the most useful line: it prevented the right arm and slot from drifting vertically. The vertical datum through the large bore gave the left boss a stable center, and the lower extent datum kept the lower lobe from becoming a loose freehand sweep.

## What the feature blockout clarified

Feature boxes helped more than I expected. The boss, large hole, right arm, slot, and two small-hole boxes made the important proportions visible as rectangles before any rounded geometry appeared. The slot fits inside its box, the holes fit their boxes, and the right arm respects its blockout. The lower lobe box was less exact, but it still made the lower body region feel planned instead of pasted on.

## How I lowered boxes into geometry

I lowered the large-hole and small-hole boxes into circular void paths. I lowered the slot box into an obround path by using the box height as the end radius. The right-arm box became a horizontal arm with a rounded right end. The large boss box guided the left circular mass, while the lower-lobe box and lower construction arc cue guided the bottom sweep. The lower arc cue, right-arm end, neck transition cue, slot caps, and circular voids now come from reusable local arc helpers and then lower into ordinary path geometry. The final material is one filled path with `fillRule: "evenodd"`, so the body and void topology are inspected before the dimension text.

## Where the method helped

The method reduced composition mistakes. In the previous freehand-ish pass, the final curve carried too much responsibility and the slot placement could collapse into a questionable wall thickness. With global datums and feature boxes, the bore, slot, right arm, and small holes stayed aligned. Filled topology also helped because the blue body immediately shows what is material and what is void.

## Where I still guessed

I still guessed tangent continuity around the neck between the boss and right arm, the exact radius centers for the lower outer sweep, and the concave transition near the right underside. The blockout tells me where the regions belong, but it does not solve exact tangency, radius construction, or the exercise's original drafting intent.

Manual judgement was still needed anywhere the reference implied tangency or a radius center without giving me a clean construction box.

## What MachinaCanvas should formalize later

MachinaCanvas should formalize guide and blockout sidecars instead of relying on generic path boxes plus notes. The useful primitives are not a CAD kernel; they are authoring scaffolds: global bounds, named datums, feature boxes with roles, construction centers, and optional construction curves. Those records should remain visible, inspectable, and lowerable into existing scene geometry.

## Suggested future schema

```ts
type CanvasGuideSidecar = {
  kind: "canvasGuideSidecar";
  regions: GuideRegion[];
  datums: GuideDatum[];
  dimensions: GuideDimension[];
  alignmentMarks: GuideAlignmentMark[];
};

type CanvasBlockoutSidecar = {
  kind: "canvasBlockoutSidecar";
  boxes: CanvasBlockoutBox[];
  points: CanvasBlockoutPoint[];
  curves: CanvasBlockoutCurve[];
};
```

This schema should be non-solving at first. It should make the scaffolding explicit and let future tools lower guides into ordinary path, ellipse, and annotation records.

## Deferred gaps

This pass did not add automatic image-to-CAD extraction, computer vision, raster tracing, a CAD kernel, boolean solver, parametric sketch solver, DXF/DWG export, PDF export, hidden-line removal, arbitrary page sizes, plotter profiles, or drafting-layout optimization. Tangent continuity in the lower sweep and neck region remains approximate rather than solved. The final geometry remains approximate, but the construction trail is now represented in the scene data and staged SVG artifacts.
