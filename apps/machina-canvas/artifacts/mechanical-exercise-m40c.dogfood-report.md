# M40c Mechanical Dogfood Report

## 1. What I inferred from the source image

The source reads as a vertically organized plate with four dominant feature groups: a small top head with a hole, a larger central boss and bore, a right-side boss and hole offset horizontally from the main center, and a lower angled obround slot inside a broader lower lobe. The right side is the least certain area because several labeled radii imply a tangent chain, but the raster image does not make those radius centers explicit. I therefore treated the radii as drafting intent cues instead of exact solved geometry.

## 2. How I constructed the guide layer

The guide pass starts with a red overall envelope, then adds major datum lines: main vertical centerline, main bore horizontal datum, top head datum, right boss datum, and the slot axis. I added point centers for the top hole, main bore, right hole, and slot center so the later blockout and annotation passes had explicit anchors. I also added a top arc cue and a lower sweep arc cue because the current guide schema handles rectangular regions and datum records cleanly, but curved construction still feels easier to express as lowered helper paths than as first-class guide entries.

Guide authoring felt awkward in two places. First, there is no dedicated curved-guide primitive in `*.guide.toml`, so I had to split the guide truth between sidecar records and ordinary path objects. Second, guide dimensions are semantically useful but placement-light, which means the authored guide data is good for machine-readable construction intent and weaker for direct visual review.

## 3. How I decomposed the part into blockouts

The blockout pass uses green feature boxes for the top head, top hole, main boss, main hole, right boss, right hole, lower slot, lower outer body, and a right-neck transition region. I kept the slot as its own void box rather than letting it hide inside the lower body blockout because that made the negative-space topology much easier to reason about. I added arc cues for the top cap, right shoulder, and lower sweep, plus a centerline cue for the slot axis.

Blockout authoring was more natural than guide authoring for this exercise, but it still had friction. The box schema works well for decomposition, yet local curve intent quickly spills beyond what a box can say. Arc helpers were sufficient for top-cap, slot-cap, and local shoulder cues, but they were not sufficient to declare an entire tangent chain in one place. Tangency and radius-center helpers were enough for local experimentation and not enough for a confident multi-radius contour authoring workflow.

## 4. Where fill helped clarify topology

The filled profile made the exercise substantially easier to read. Once the body was one blue even-odd profile, the top hole, main bore, right hole, and slot read immediately as voids instead of competing outline loops. That was especially helpful around the lower slot, where the material wall thickness is easier to judge in filled form than in line-only form.

Filled profile authoring felt mostly natural. The main friction was not the fill itself; it was keeping one approximate outer profile path believable while also preserving explicit outline geometry for annotations and inspection.

## 5. What went well with the current tools

The new workflow is materially better than the older direct-to-final pass. `*.guide.toml` and `*.blockout.toml` make the construction story visible. Filled body authoring is now the right default for mechanical dogfood because it clarifies topology immediately. Arc helpers are useful for circles, obround slot caps, and local cue arcs. Keeping annotations as semantic mechanical sidecars still works well once the geometry is in place.

## 6. What gaps and frictions remain

- Guide authoring is still awkward for curved construction because curve cues live more comfortably as ordinary paths than as first-class guide-sidecar records.
- Blockout authoring is still awkward for tangent-heavy profiles because boxes and a few arc cues do not express continuity intent very richly.
- Arc helpers are useful but still local. They help author pieces of the contour, not the whole chain.
- Tangency and radius-center helpers are not yet strong enough to feel like a coherent contour-authoring surface for this kind of part.
- Annotation placement is still too manual. The labels are much better than before, but the pass still requires hand-tuning leader angles, lengths, and offsets.
- Export/view workflow is functional but clumsy. The SVG-plus-Inkscape-preview pipeline works, yet it is still a script-time workflow rather than an especially smooth review loop.
- I still had to fight the tool in the transition between semantic guide/blockout intent and the final approximate contour. The awkwardness is not in storing records; it is in lowering them into a believable tangent chain.

## 7. What should likely be implemented next in MachinaCanvas mechanical mode

The next useful step is not a full CAD kernel. It is a stronger authoring bridge between blockout intent and local contour construction:

- first-class curved guide cues in `*.guide.toml`
- richer blockout curve semantics for tangent-chain intent
- lightweight radius-center and tangency visual helpers that remain local and explicit
- better annotation auto-placement defaults and collision avoidance
- an easier review loop for guide-only, blockout-only, and final-filled views without bouncing through separate script outputs

## Assumptions

- The dogfood pass intentionally fit the part to the existing A4 landscape review sheet.
- Several labeled radii were treated as drafting cues, not exact solved geometry.
- The lower right waist and lower sweep remain approximate.
- No automatic image-to-CAD extraction, solver, DXF output, or generalized CAD kernel work was added here.
