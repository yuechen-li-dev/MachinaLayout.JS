# Mechanical Exercise 354 Dogfood Report

## Source

The source is the uploaded 2D mechanical exercise reference image, preserved as `apps/machina-canvas/artifacts/reference-mechanical-exercise-354.png` when available. The drawing was manually approximated; no computer vision, raster tracing, or automatic image-to-CAD conversion was used.

## Generated artifacts

- `apps/machina-canvas/artifacts/mechanical-exercise-354.mcanvas.json`
- `apps/machina-canvas/artifacts/mechanical-exercise-354.render.svg`
- `apps/machina-canvas/artifacts/mechanical-exercise-354.preview.png`
- `apps/machina-canvas/artifacts/mechanical-exercise-354.dogfood-report.md`

## What worked

Existing ellipse geometry represented the circular holes cleanly, while the left boss is now carried by the filled body profile and outline path instead of a separate visible reference circle. The generic path scene object covered the complex outer profile, centerlines, and rounded slot while staying within the SVG-like MachinaCanvas substrate. The mechanical sidecar represented horizontal, vertical, aligned, radius, and angular dimensions, and the A4 landscape sheet/title block rendered directly in SVG.

M39f adds a filled profile interpretation that makes the material body readable before annotations are inspected. The main part body is now one `mechanical-body-profile` path with `fillRule: "evenodd"`; the inner circular hole, the two small holes, and the rounded slot are authored as void subpaths in that profile and also kept as visible outline geometry tagged `mechanical-void`. centerlines worked as ordinary dashed path geometry on a construction layer. radius callouts, including `R20` and `R32`, now use explicit leader angles so they sit around the part instead of stacking to the right. The angular dimension label `35°` renders on a larger bottom arc. The rounded slot is represented as one path object rather than a new CAD-only primitive. A4 fitting uses the existing 297 mm by 210 mm sheet with 10 mm margins, and Inkscape rasterizes the canonical SVG into a preview PNG for review.

M40b now generates the right-arm outer arc, the neck transition cue, the rounded slot caps, and the circular void subpaths with reusable local arc helpers instead of handwritten arc strings. The scene still lowers those results into ordinary path geometry, so export and review stay on the existing SVG-like substrate.

## What was approximated

The outer profile is a hand-authored cubic/arc approximation derived from the visible reference, not an exact reconstruction. Several radius centers are approximate and are used mainly to exercise semantic annotation records. The neck transition and lower sweep still rely on local judgement rather than exact tangent-chain construction. The small exercise number box is represented as notes rather than a dedicated reference-image title stamp. The scale is marked `Fit to A4` because the source image proportions were fit to the printable area.

## Friction found

M39d revealed that annotation defaults were the root cause of the "pile of detached stuff" look: every radius callout used an east-facing leader, vertical dimensions could become diagonal when their endpoints had different x coordinates, angular dimensions had a fixed radius, and text had no white backplate to separate it from construction geometry. M39e also found two exporter-level composition bugs: the mechanical sheet frame was rendered after geometry with a white fill, which could occlude the part, and `fill="transparent"` was not portable through Inkscape rasterization. The sheet composition also needed a clearer review artifact than SVG alone.

M39f found a more basic mCAD readability issue: line-only drafting made the topology ambiguous for LLM-native inspection. Holes, slots, construction lines, radius leaders, and body edges all competed as strokes. The root cause was that mechanical mode had no semantic material profile layer; it only had outlines plus annotations. The filled pass also exposed a concrete geometry flaw in the first approximation: the rounded slot touched the top arm edge, creating a zero-thickness, unmanufacturable wall.

## Fixes made in M39d

M39d added a small SVG-like path scene primitive with stroke width and dash pattern metadata. SVG/TOML export and the live app preview now render path objects. Mechanical dimension rendering gained arrow markers and rotated aligned-dimension labels for better readability in this exercise.

## Fixes made in M39e

M39e added reusable per-annotation placement hints for radius leader angle/length, angle radius/label offset, and linear/aligned label offsets. Linear dimensions now keep horizontal and vertical witness-line geometry axis-aligned. Dimension labels render with white backplates. The sheet frame no longer paints over scene geometry, and SVG export normalizes transparent fills to `none` for Inkscape compatibility. Exercise 354 now places callouts around the part instead of using one default leader direction, and the workflow writes `mechanical-exercise-354.preview.png` by rasterizing the SVG with Inkscape.

## Fixes made in M39f

M39f makes mechanical mode profile-first by default. Path scene objects now support a portable `fillRule` field, which exports as SVG `fill-rule` and serializes into object TOML. The Exercise 354 generator creates a filled blue body/profile region first, punches holes and the obround slot with even-odd void subpaths, then renders visible outlines, centerlines, dimensions, leaders, labels, and the title block above it. The right arm profile was adjusted so the slot is centered vertically in solid material with wall thickness above and below instead of collapsing into a 0 mm edge. The default mechanical drafting template now starts with a filled profile body as well, while preserving ordinary geometry objects for annotation references.

## Deferred gaps

PDF was intentionally deferred because M39f still treats SVG as the canonical vector artifact and preview PNG as review output. Automatic image-to-CAD conversion, arbitrary boolean solving, constraint solving, DXF/DWG, arbitrary plotter/page profiles, parametric sketching, collision avoidance, and exact radius tangent solving remain out of scope. M40b keeps tangency local and arc-only; it does not solve the whole profile or move referenced entities. Future work should consider automatic leader collision checks, smarter text-side selection, first-class centerline style presets, and a small UI control for switching between filled profile and outline-only review if users need that comparison.

## Verification

The generator writes the scene JSON, rendered SVG, preview PNG, and this dogfood report through `npm run canvas:mechanical-exercise-354`. Tests assert A4 landscape metadata, existing scene geometry records, a filled topology-first body profile, semantic void outlines, mechanical annotation sidecar content, key labels such as `100`, `30`, `R20`, `R32`, and `35°`, required report sections, label backplates, placement metadata, preview path metadata, and explicit deferred PDF coverage.
