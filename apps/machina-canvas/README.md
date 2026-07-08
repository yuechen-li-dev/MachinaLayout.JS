# MachinaCanvas

MachinaCanvas is the first dogfood app for MachinaLayout.JS: a React/Vite app/product workspace for an LLM-friendly 2D graphics editor substrate.

MachinaLayout.JS remains the MIT-licensed library/toolbox package. MachinaCanvas is separate app/product code licensed under AGPL v3, and the root npm package is expected to exclude MachinaCanvas app source. See [M40 phase closeout](docs/phase-closeout-m40.md).

Canvas modes are soft templates over the same scene model. They choose starting content and visible affordances; they do not fork MachinaCanvas into separate editors.

Current start modes:

- `mechanical`
- `blank`
- `graphics`
- `webUi`
- `sprites`

The sprite mode now includes a narrow visual frame editor for sprite sidecars. It is still intentionally not a full paint program or full Aseprite clone.

MachinaCanvas uses a TOML syntax library for sidecar parsing/stringifying. MachinaCanvas still owns sidecar normalization, validation, diagnostics, and export dialects.

Core thesis:

```txt
LLMs do not need more pixels.
They need inspectable geometry.
```

## Mechanical drafting mode

Mechanical drafting mode is annotation-first 2D drafting. It adds semantic dimensions, tolerances, notes, datums, and table/block records over editable canvas geometry. It does not implement a parametric sketch solver or generalized 2D constraints.

Mechanical drafting mode reuses existing MachinaCanvas SVG-like scene geometry as the drawing substrate. Mechanical annotations add semantic dimensions, notes, datums, and block/table records on top. Dimensions may reference geometry anchors, but they do not solve or drive geometry.

Mechanical mode defaults to profile-first filled rendering: the material body is authored as a filled profile, holes and slots are authored as voids, and outlines/centerlines/dimensions render above that topology. This is intentionally more legible for LLM-native CAD inspection than paper-era line-only drafting because the solid body and cutouts are visible before reading annotations.

There is no separate CAD geometry kernel here, and no parametric sketch solver. Mechanical mode is a drafting workflow over the same `.mcanvas` scene objects used by the other editor modes.

Mechanical drafting currently targets A4 landscape office-printer sheets. MachinaCanvas intentionally avoids AutoCAD-style plotter/profile setup for this mode.

Use A4 landscape for general mechanical drawings. Specialized 1:1 manufacturing outputs such as wire harness boards are out of scope for the current mechanical drafting mode.

M39d/M39e/M39f include a dogfood exercise that recreates a reference 2D mechanical drawing as MachinaCanvas geometry plus semantic mechanical annotations. M39f renders the exercise as a filled topology-first profile with holes and the rounded slot punched out as voids. It is intended to reveal workflow gaps, not to perform automatic image-to-CAD conversion. Run `npm run canvas:mechanical-exercise-354` from the repository root to regenerate the exercise JSON, SVG, preview PNG, and dogfood report artifacts.

M39g extends that dogfood with a staged blockout method: first establish global bounds and datum lines, then feature blockout boxes, then lower the guide masks into filled body/void topology and annotations. This is not automatic image-to-CAD extraction; it is an explicit authoring method for LLM-assisted drafting. Run `npm run canvas:mechanical-exercise-354-blockout` to regenerate the global mask, feature mask, filled-profile render, preview PNG, scene JSON, and process notes artifacts.

M40c adds a fresh mechanical dogfood pass that starts from a real `*.guide.toml`, continues through a real `*.blockout.toml`, and then lowers both into a filled mechanical profile plus semantic annotations. Run `npm run canvas:mechanical-exercise-m40c` to regenerate the guide SVG, blockout SVG, guide TOML, blockout TOML, final scene JSON, final SVG, preview PNG, dogfood report, and process notes artifacts.

The core source artifact remains editable `.mcanvas` editor state plus scene object records. SVG is the current review/print-oriented artifact, and PDF may come later.

Mechanical sheets can carry page metadata such as size, orientation, units, scale, drawing number, title, and revision. Mechanical drafting mode currently optimizes only A4 landscape in the UI and template flow; other sheet sizes are intentionally not exposed here. Title blocks, revision tables, and BOM tables are records rendered as tables, not hand-drawn line art.

The delivery direction is editable `.mcanvas` source plus SVG sheet export, while dimensions remain semantic overlays that can reference existing geometry anchors without turning into constraints or a solver.

## Workflows, not macros

MachinaCanvas workflows are TypeScript automation over scene records, sidecars, audits, compilers, and export artifacts. They are not UI macros and do not click through the browser.

Workflows can run headlessly from Node or script contexts where practical, which makes them a better fit for Codex and other LLM automation than brittle click replay. The browser editor and script-side workflows should share the same scene, sidecar, compile, audit, and export APIs so automation targets records and artifacts instead of visual state.

The TinyTown sprite workflow under `apps/machina-canvas/scripts/tinytown-sprite-workflow.ts` is the reference example in this repo. It loads authoring inputs, compiles runtime sprite TOML, produces audit artifacts, and writes a workflow manifest without executing arbitrary code inside the browser editor.

## Why Webpage-Shaped

This app intentionally borrows the structure of a familiar product page instead of a heavy native editor:

- left nav becomes a scene tree, files, and layers
- main product image becomes the canvas and artboard
- purchase/details panel becomes the selected object inspector
- related product shelf becomes scene summary and object cards
- breadcrumb becomes document, layer, and object navigation

That shape gives models and humans explicit structure: records, IDs, bounds, layers, summaries, and commands.

## What It Demonstrates

- `machinalayout/machina` for the app shell layout
- `MachinaReactView` from `machinalayout/react` for placement
- SVG as a DOM-inspectable scene graph
- stable object IDs and geometry bounds
- scene summaries for the first LLM "SEE" layer
- CAD-style reference grid spans for speakable object locations
- canvas frame intent separate from resolved object geometry
- document units and formatted measurement readouts
- controlled viewport zoom for canvas, selection, and grid inspection
- image scene objects with explicit RGB image plus alpha-map relationships
- deterministic local image tools for LLM-assisted editing workflows
- SVG mask-based composition for deterministic transparent visual output
- browser-local PNG lowering from clean `render.svg`
- UI component objects with view-only previews and TSX lowering
- inspector toggles for reference grid, grid lines, measurement labels, and diagnostics
- JSON command validation and command-based edits
- before/after command result summaries in a command log
- geometry diagnostics for selected-object and scene inspection
- `machinalayout/match` for object-kind presentation

## Sprite Frame Editing

MachinaCanvas now treats sprite cuts as editable geometry instead of passive overlay decoration.

Sprite focus mode shows the selected frame, its parent subgrid, and its label while hiding the rest of the overlay noise. Debug mode remains available when all cuts and labels need to be inspected at once.

Sprite atlases can contain multiple subgrid regions plus exact/custom frame crops. MachinaCanvas renders these as distinct overlay layers so grid-aligned cells and exact cuts are not confused.

For non-tiling sprite sheets with transparency, MachinaCanvas can audit cut lines against the image alpha channel. Cut lines crossing opaque pixels are reported as likely slicing through a sprite, while exact/manual crops remain separate semantic cuts.

- click visible sprite frame rectangles on the canvas to select them
- switch overlay presets between `Focus`, `Cut edit`, `Grid edit`, `Audit`, and `Debug`
- edit selected frame `x`, `y`, `width`, and `height` in the inspector
- nudge frames with inspector buttons or arrow keys
- drag a selected frame to move it and drag the resize handle to change width and height
- optionally snap frame edits to a simple grid
- inspect declared subgrid regions separately from individual frame rectangles
- describe rough multi-region sprite cuts with `[cut_grids.*]` sidecar entries when a sheet only approximates a regular grid
- distinguish grid-derived frames from exact/custom/manual cuts in the overlay and inspector
- audit rough cut boundaries against transparent gutters so likely sprite-slicing cuts surface as warnings instead of being mistaken for clean cells
- keep parent-grid context visible for exact/custom/manual frames when a crop started from a larger grid cell
- export updated frame cuts back into `objects/*.sprite.toml`
- keep validation active so bad cuts surface as diagnostics

Sprite audits now distinguish errors, warnings, and notes. Exact/custom crops can keep parent-grid context, so an intentional crop inside a larger grid cell is reported as a softer note instead of a generic bad-grid warning when the geometry clearly looks like an exact cut.

Sprite editing uses a focus-first inspector: selected frame controls and zoom preview appear near the top, while lower-priority inspector groups are collapsible.

The canvas supports middle-mouse drag panning and stepped mouse-wheel zoom in the artboard area.

This is frame slicing and sidecar editing, not raster painting. MachinaCanvas still does not add brush tools, pixel editing, or an animation timeline here.

## Command Terminal

MachinaCanvas includes a small in-app command terminal for editor commands and quick Codex/manual testing.

The MachinaCanvas command terminal runs editor commands only. It does not execute shell commands, JavaScript, or arbitrary code.

Supported commands:

- `help`
- `summary`
- `select <objectId>`
- `select-frame <sidecarId> <frameId>`
- `nudge-frame <dx> <dy>`
- `nudge-frame <up|down|left|right> [amount]`
- `set-frame-rect <x> <y> <w> <h>`
- `clamp-frame [sidecarId] [frameId]`
- `list-datums`
- `snap-frame <anchor> [datumId]`
- `snap-frame-nearest [anchor]`
- `list-alignment-marks`
- `align-by-mark <sourceObjectId> <sourceMarkId> <targetObjectId> <targetMarkId>`
- `align-selected-by-mark <sourceMarkId> <targetObjectId> <targetMarkId>`
- `overlay-mode <focus|cutEdit|gridEdit|audit|debug>`
- `toggle-sprite-overlay`
- `toggle-sprite-labels`
- `toggle-selected-only`
- `export-summary`
- `export-preset <presetId>`
- `export-select <artifactId>`
- `export-unselect <artifactId>`
- `export-checkout`
- `checkpoint [message...]`
- `clear`

## Command JSON Workflow

M30b adds the first real record-based editing loop:

1. paste or load command JSON
2. validate command shape and object references
3. apply valid commands to the scene document
4. inspect command results and changed fields in the command log
5. read the updated scene summary and geometry diagnostics

The command panel accepts either one command object or an array of command objects.

Supported command kinds:

- `select`
- `move`
- `resize`
- `setFill`
- `setStroke`
- `align`
- `distribute`
- `moveToGrid`
- `alignToGrid`
- `resizeToGridSpan`
- `setFrame`
- `addImageObject`
- `removeObject`
- `attachAlphaMap`
- `detachAlphaMap`
- `attachSketchOverlay`
- `detachSketchOverlay`
- `setSketchOverlayVisible`
- `setUiProp`

Grid-aware commands let command JSON target the reference grid instead of raw
pixels:

```json
[
  { "kind": "moveToGrid", "id": "feature-chip-1", "ref": "B4.c", "anchor": "center" },
  { "kind": "alignToGrid", "ids": ["logo", "headline"], "axis": "left", "ref": "A1.w" },
  {
    "kind": "setFrame",
    "id": "cta-bg",
    "frame": { "kind": "anchor", "left": 72, "top": 390, "width": 188, "height": 48 }
  }
]
```

Point refs can use whole cells such as `A1`, subcells such as `D3.ne`, or
normalized local coordinates such as `B4@0.5,0.25`. Span refs such as `A2-C3`
cover full cells inclusively.

Validation reports diagnostics instead of throwing for normal input failures. It checks command kind, target object IDs, finite numbers, positive sizes, align/distribute object lists, valid axes, grid refs, grid spans, anchors, and non-negative distribute gaps.

The command log records recent applied commands, result messages, and field-level before/after changes. This is the command substrate an LLM could target, but the app does not call an LLM API yet.

## Image Assets And Alpha Maps

M30k adds image objects for the common LLM image workflow:

```txt
RGB/generated image
+ alpha map / mask image
+ deterministic compositor
= transparent/composited visual result
```

Image objects are first-class scene objects with stable IDs, geometry, layer
membership, visibility, tags, and notes. A normal image can reference another
image object by `alphaMapId`; the referenced object uses role `alphaMap` or
`mask`. The alpha map remains in the scene tree and inspector even when it is
hidden from normal output.

MachinaCanvas renders image composition through SVG masks. In M30k, the mask
image is placed using the source image object's `x`, `y`, `width`, and `height`
so the generated RGB image and alpha map line up deterministically. The alpha
object's own geometry is still inspectable and exported, but it is not used for
mask placement yet.

This is composition, not brush editing. M30k does not add image generation,
image upload UI, raster alpha compositing, canvas pixel manipulation, mask
painting, PNG export, nested layer trees, or TOML import.

M30l adds browser-local image loading into the current runtime scene stack. The
inspector can load a PNG, JPEG, WebP, or SVG file as a normal image, or load one
as an alpha-map object. Files are read with the browser `FileReader` API as data
URLs and stored directly in `ImageObject.src`; there is no upload, backend
service, image generation, or raster editing step.

Loaded image objects are appended to the selected object's layer when possible,
or to the foreground/first visible layer. Normal images render immediately.
Loaded alpha maps use role `alphaMap`, are hidden by default, remain visible in
the scene tree and inspector, and can be attached to a source image with the
inspector's alpha controls. Source images can detach their alpha map, and any
selected object can be removed from the scene. Removing an alpha map also
detaches image objects that referenced it.

Data URL image sources export through the normal object TOML `[image] src`
field and through `render.svg` image `href` values. This makes local handoff
convenient but can create large text files. A future asset-folder export could
externalize binary assets; M30l intentionally does not add `.mcanvas` import,
TOML import, ZIP export, or browser binary asset writing.

M30m adds browser-local PNG export as a lowering operation:

```txt
.mcanvas semantic package -> render.svg -> browser rasterization -> render.png
```

PNG export uses the current clean `render.svg`, loads it into an
`HTMLImageElement`, draws it to an `HTMLCanvasElement`, and writes a PNG Blob
with `canvas.toBlob("image/png")`. It does not call a backend and does not add
server-side rasterization, native canvas dependencies, `sharp`, or `canvas`.

PNG defaults to transparent background so alpha from SVG masks and transparent
artwork can survive. The Export panel also offers white or black background fill
and 1x, 2x, or 4x scale options. Reference grid overlays, measurement labels,
selection outlines, viewport zoom, and editor UI are not part of `render.svg`,
so they are not part of `render.png`.

The PNG is a lossy artifact: it keeps pixels and alpha only. It does not keep
layers, object IDs, command recipes, frame intent, reference-grid semantics,
unit metadata, or alpha-map relationship metadata. The `.mcanvas` text package
remains the source of truth; PNG import remains out of scope.

M30n starts the MachinaCanvas image editing toolbox. Tools are deterministic
browser-local operations that work on scene objects and produce structured
results for humans and LLM workflows. The first tool, `generate-alpha-map`,
derives a grayscale alpha-map PNG from a selected image object, creates a hidden
`alphaMap` image object, and can attach it back to the source through
`alphaMapId`.

This toolbox complements generative image systems. It does not call an LLM or
diffusion API, does not upload pixels, and does not add brush editing. It gives
models a stable local operation for a common layer-composition task. See
[MachinaCanvas tools](../../docs/machina-canvas-tools.md).

## Sketch Overlay Sidecars

M30p adds structured sketch overlays for image reasoning:

```txt
image object
  + sketch overlay object/spec
  + sketchOverlayId relation
  -> visual reasoning overlay
```

The overlay is not a raster edit and not an alpha mask. It is a readable sidecar
for boxes, lines, points, and labels so an LLM can reason over image structure
without squinting at pixels.

Sketch overlays remain normal scene objects in the scene tree and inspector.
The current dialect exports as `*.sketch.toml`, for example
`objects/generated-product-sketch.sketch.toml`. The image/object graph exports a
`sketchOverlayFor` relation in `document.json`, and `handoff.toml` includes a
matching `[[sketch_overlay]]` entry.

Visible sketch overlays render on top of their target image in the canvas and in
clean `render.svg`, so PNG lowering also includes them. Hide the overlay before
export if you want it excluded from the rendered artifact. The sidecar-dialect
shape is intended to generalize later to things like `.pcb.toml`,
`.graph.toml`, `.spritegrid.toml`, or `.atlas.toml`, but M30p only implements
`.sketch.toml`.

## Layer groups and sidecar attachments

The layer panel shows ownership relationships: images and scene objects can own sprite sidecars, guide sidecars, blockout sidecars, sketch overlays, and alpha masks. Layer groups organize objects but do not change rendering semantics in this pass.

The Layers panel uses an Add menu for groups, images, sprite TOML, guide TOML, blockout TOML, sketch TOML, and alpha masks.

Use the Add menu to add `Group`, `Image`, `Sprite TOML`, `Guide TOML`, `Blockout TOML`, `Sketch TOML`, and `Alpha mask` items directly where you are working. Attached alpha maps, guide sidecars, blockout sidecars, sprite sidecars, and sketch overlays render as nested rows under their owning object so the relationship is visible before you open the inspector.

If a guide sidecar, blockout sidecar, sprite sidecar, sketch overlay, or alpha mask is loaded without a matching attachment, MachinaCanvas keeps it visible under `Unattached Sidecars` until you link it.

## Guide and blockout sidecars

Guide sidecars (`*.guide.toml`) are visible construction masks. A guide attached to an image renders regions, datums, dimensions, and alignment marks over that image and can be toggled like a layer.

Blockout sidecars (`*.blockout.toml`) represent spatial feature/component masks. They are general-purpose authoring IR for layout, sprites, mechanical drafting, diagrams, and other canvas workflows.

Blockout is layout IR. It helps authors and LLMs solve composition before final geometry or rendering.

Attach guide and blockout sidecars to an image or scene object, toggle their visibility like layers, and use them as visible red/orange and green overlays during editing and visual review. Guide coordinates are owner-relative: for image attachments, guide coordinates are interpreted in the target image's intrinsic pixel coordinate system, then scaled and translated into the image rectangle. Guide opacity is part of the sidecar scene object and is reflected in the live overlay and exported visual review SVG. These are authoring-side overlays, not automatic image-to-CAD extraction, not a solver, and not mCAD-specific.

Run `npm run canvas:guide-overlay-fixture` to generate the M40d review fixture at `apps/machina-canvas/artifacts/guide-overlay-fixture.*`. The fixture includes a reference PNG, attached `.guide.toml`, `.mcanvas.json`, rendered SVG, preview PNG, review HTML, and a report that records attachment ids, feature counts, export inclusion, and screenshot evidence target.

Guide sidecars (`*.guide.toml`) are authoring IR. They describe regions, datums, dimensions, and alignment marks used to edit visual artifacts. They are separate from runtime sidecars such as `*.sprite.toml`.

Guide sidecars are authoring IR. Compiled sprite TOML is the runtime target. Runtime sprite exports omit guide regions, datums, dimensions, alignment marks, and legacy cut grids by default.

Stackframes are compact runtime sprite metadata for repeated frames arranged vertically or horizontally. They are allowed in `*.sprite.toml`, unlike guide regions and datums, which remain authoring-only in `*.guide.toml`.

Use `[stackframes.*]` entries for common vertical or horizontal sprite-sheet runs when each frame has the same size and advances by a constant step. Leave exact/manual frame edits under `[frames.*]` when one member of the stack needs an explicit override. This keeps stackframes distinct from legacy `cut_grids`: `cut_grids` are authoring scaffolding or backcompat data, while stackframes are valid runtime metadata.

Regions generalize subgrids without declaring final runtime sprite metadata. Datums add authored guide lines and guide points. Dimensions add measurement labels. Legacy `cut_grids` entries remain supported as transitional/backcompat authoring data, but new work should prefer guide regions in `*.guide.toml`.

Alignment marks are authored registration points in `*.guide.toml`. MachinaCanvas can translate one layer/image so its mark matches another mark, but M38d does not perform automatic image feature detection, rotation, scale, or general registration.

Datums provide explicit snap targets for sprite-frame editing. MachinaCanvas snaps selected frame edges or centers to authored datum lines; it does not run a general 2D constraint solver.

Guide regions can constrain sprite frame editing in the editor. The constraint is authoring-only: guide regions remain in `*.guide.toml`, while exported `*.sprite.toml` contains only runtime sprite frame metadata.

Sprite mode can show the selected frame's guide-region context, toggle `Constrain to guide region`, and run `Clamp to guide region` when a frame drifts outside its authored region. Guide-region audit warnings stay in the editor/audit path; they do not turn guide regions into runtime sprite metadata.

Selected sprite frames can also use `Datum snapping` in the inspector for `Snap nearest`, anchor-specific snaps, and nearby-datum inspection. The in-app terminal mirrors that workflow with `list-datums`, `snap-frame <anchor> [datumId]`, and `snap-frame-nearest [anchor]`.

Datums remain in `*.guide.toml`. Runtime `*.sprite.toml` exports only keep the resulting frame rectangles after snapping.

Alignment marks are point marks only in this pass. The inspector can align an image to another resolved mark, and the command terminal exposes `list-alignment-marks`, `align-by-mark <sourceObjectId> <sourceMarkId> <targetObjectId> <targetMarkId>`, and `align-selected-by-mark <sourceMarkId> <targetObjectId> <targetMarkId>`.

Alignment metadata remains guide-only authoring IR. It stays in `*.guide.toml`, does not compile into runtime `*.sprite.toml`, and does not use computer vision or automatic feature detection.

This remains intentionally narrow. MachinaCanvas still does not do general constraint solving, full auto-segmentation, or full registration beyond translation-only alignment between authored marks.

### Coordinate profiles

MachinaCanvas renders through SVG/React, whose default coordinate space is screen-like: +x right, +y down.

Renderer coordinates and authoring coordinates are separate concerns. Modes may expose different authoring coordinate profiles. Mechanical drafting uses drafting coordinates with +Y up, while sprite/image workflows use image coordinates with Y measured down from the top-left.

The built-in profiles are:

- Screen coordinates: +X right, +Y down, top-left origin.
- Image coordinates: +X right, +Y down, image top-left origin.
- Drafting coordinates: +X right, +Y up, bottom-left authoring origin.

Directional commands such as nudge up/down are visual commands and should not require users to remember raw SVG Y direction. Numeric sprite frame fields remain image-compatible and are labeled as image coordinates, including `Image Y from top`.

Export lowering remains SVG-compatible. Existing scene geometry is still stored as resolved document/render coordinates in this pass; coordinate profile metadata documents the authoring semantics and gives commands/helpers a clear place to choose visual direction.

### Arc construction helpers

Arc helpers construct local SVG path geometry from drafting inputs such as three points, center/radius angles, chord/radius centers, and fixed tangent references.

MachinaCanvas arc helpers use SVG/canvas render coordinates: +x right, +y down, unless a wrapper is explicitly named for another authoring profile.

ArcSweep values describe visual clockwise/counterclockwise motion in that y-down coordinate system.

For drafting-style +Y-up authoring, transform points into render/SVG coordinates before calling the current arc helpers, then export the resulting path through the normal SVG lowering path.

Arc orientation tests include upper/lower arcs and slot-cap regressions so helper-generated paths do not silently flip.

Tangency helpers adjust the generated arc only; they do not move the entities the arc is tangent to.

These helpers are not a parametric sketch solver or CAD kernel.

Three-point arcs remain valid authoring input, and center/radius arcs remain valid authoring input.

Radius center helpers can return two possible centers so a drafter can choose which side of a chord the arc should live on.

Guide and blockout cues can lower to ordinary path geometry, including helper-generated arc paths, without introducing a separate CAD-only scene primitive.

## TinyTown sprite artifact generation

Run `npm run canvas:tinytown-artifacts` to generate TinyTown review artifacts from the real Dominatus sprite atlas and hand-edited TOML sidecars.

The script writes a `tinytown_sprite_alpha.guide.toml` authoring IR plus a `tinytown_sprite_alpha.compiled.sprite.toml` runtime artifact for the next Dominatus Godot integration milestone. It does not modify Godot code and does not generate or edit image pixels.

## UI Components And TSX Lowering

M30o adds the first smoke-test version of LLM-native Figma:

```txt
MachinaCanvas treats UI components as canvas objects with code lowering targets.
```

The scene model now supports `uiComponent` objects. A UI component object has
normal canvas bounds, a stable object ID, a built-in `componentId`, serializable
props, and optional export naming metadata. The built-in catalog includes
Button, Card, Input, and Badge. These are local presentational definitions, not
arbitrary imported React components.

Canvas previews are view-only. They render through SVG `foreignObject` so they
can sit on the same artboard as SVG, image, text, rect, and ellipse objects.
Buttons do not dispatch, inputs are disabled/read-only, and previews do not run
hooks, data fetching, routing, backend calls, or app logic.

The inspector shows the selected component ID, label, variant, export name, and
schema-driven props. Props can be edited with text fields, checkboxes, and
selects through the `setUiProp` command path.

The Export panel now includes TSX lowering. `generated-page.tsx` is a code
artifact that lowers visible scene objects into a React/MachinaLayout page
shell using `MachinaReactView`. UI component objects become real presentational
React markup; text, image, rect, and ellipse objects lower as simple visual
artifacts. The TSX is editable code for a developer to wire later, not a
round-trip source for `.mcanvas`.

## Canvas Frames

M30h adds a first canvas-side layout vocabulary. MachinaCanvas objects can now
carry `frame` intent while keeping `x`, `y`, `width`, and `height` as resolved
geometry for rendering. Rendering still reads the resolved geometry only.

Supported frame kinds:

- `absolute`: explicit `x`, `y`, `width`, and `height`
- `anchor`: exactly two horizontal constraints from `left`, `right`, `width`
  and exactly two vertical constraints from `top`, `bottom`, `height`
- `referenceGrid`: place an explicit-size object at a reference grid point
- `referenceGridSpan`: fill a full reference grid cell or inclusive cell span

`setFrame` validates and stores frame intent, then immediately updates resolved
geometry. This is not a full layout solver, snapping system, import path, CAD
dimension model, or backend/LLM integration.

## Units And Measurements

M30i adds a canvas unit foundation. The current demo remains visually stable and
uses `px` as its document unit, but the scene model now carries a
`unitSystem` with a display label, nominal rendered pixels per document unit,
and formatting precision. Built-in unit systems include `px`, `pt`, `mm`, `cm`,
`in`, and custom canvas units (`cu`).

MachinaCanvas treats object `x`, `y`, `width`, and `height` as document units.
The SVG `viewBox` uses those same document coordinates. Browser screen pixels
are a rendered display concern, and viewport zoom is deliberately separate
viewer state. Zooming never changes object `x`, `y`, `width`, or `height`.

The inspector shows document/unit metadata and selected-object measurements:
size, position, and center. A small optional SVG label can be toggled for the
selected object when measurements are useful on the canvas itself.

## Viewport Zoom And Inspection

M30j adds controlled inspection zoom without adding pan/drag navigation or wheel
zoom. The inspector owns the viewport controls:

- Fit returns to the full canvas at 100%.
- Fixed zoom buttons inspect at 50%, 100%, 200%, 400%, or 800%.
- Zoom to selected centers the view on the selected object.
- Grid ref zoom accepts point refs such as `D3` or `D3.ne`.
- Grid span zoom accepts whole-cell spans such as `A2-C3`.

The viewport is implemented as `zoom` plus document-coordinate center point and
rendered through the SVG `viewBox`. It is a camera over the document, not
document geometry. Units remain authored document state; resolved object bounds
remain the editable/rendered geometry.

The inspector and bottom shelf include a viewport summary with zoom percent,
visible document rect, visible object count, a few visible object IDs/spans, and
whether the selected object is visible in the current view. This is the local
textual counterpart to the visual magnifier.

## Geometry Diagnostics

MachinaCanvas reports simple inspectable geometry facts:

- objects outside the artboard
- selected-object overlap with visible objects
- selected-object near left or center-X alignment with another object
- negative object sizes if invalid geometry appears

## Reference Grid / CAD Locator Overlay

M30f adds a semantic reference grid for object location. The canvas is divided
into labeled columns and rows, such as `A1`, `B2`, and `D3`, with optional
subcell references such as `D3.ne` for points inside a cell.

M30g makes that locator language actionable through command JSON. The grid is
still not a layout system: it does not snap objects, add drag editing, create
CAD constraints, or change MachinaLayout resolver behavior. It gives humans and
LLMs a compact way to refer to geometry:

```txt
feature-chip-1 spans A4-B4 and centers at A4.ne
```

The editor renders a faint SVG overlay with border labels, shows selected-object
references in the inspector, includes spans in scene summaries and object cards,
and writes reference grid metadata into generated handoff files. Clean
`render.svg` export output does not include the overlay by default.

Visual aids are situational. The inspector owns toggles for the reference grid,
internal grid lines, measurement labels, and geometry diagnostics so the canvas
can stay calm by default.

Grid-aware commands are deterministic edits against the current scene document:
`moveToGrid` moves an object's chosen anchor to a point ref, `alignToGrid`
aligns object edges or centers to a point ref, and `resizeToGridSpan` makes an
object cover a full-cell span.

## MachinaCanvas Export Format

M30c defines the `.mcanvas` export/handoff bundle format in
[MachinaCanvas export format](../../docs/machina-canvas-export-format.md).

The format keeps rendered artifacts, graph indexes, and editable contracts in
separate files:

- rendered artifacts such as `render.svg` are output
- `document.json` is the scene graph and bundle index
- object, layer, handoff, and command recipe files are TOML contracts

A checked-in demo fixture lives at
[`apps/machina-canvas/fixtures/demo-poster.mcanvas`](fixtures/demo-poster.mcanvas).
It is a readable hand-authored bundle for the current demo poster shape. The
runtime app still uses its in-memory scene model.

M30d adds browser-local one-way export from the current runtime scene. The
inspector includes an Export panel that generates a `.mcanvas`-shaped file list
without calling a backend or an LLM API. Users can inspect the generated files,
copy the selected file text, or download the selected file.

## Export cart

Export is a cart: MachinaCanvas collects available artifacts, lets you choose a
preset or individual files, and checks out the selected bundle. Checkpoints
save work-in-progress state; exports produce external deliverables.

The Export cart keeps checkpointing and handoff separate:

- `Save checkpoint` downloads a browser-local checkpoint JSON for the current
  editable scene, active mode, and current selection.
- `Checkout selected` checks out external deliverables such as `render.svg`,
  `render.png`, `document.json`, `handoff.toml`, sidecars, reports, and TSX
  lowerings when those artifacts are available in the current scene.

Presets are selection helpers, not locks:

- `Sprite handoff` selects compiled runtime sprite TOML, sprite audit reports,
  sprite compile reports, diagnostics, `handoff.toml`, and overlay review
  artifacts. Guide sidecars stay optional here because `*.guide.toml` is
  authoring IR, not runtime metadata.
- `Visual review` selects rendered SVG/PNG artifacts plus diagnostics and sprite
  audit output when present. Mechanical A4 sheets surface as `A4 mechanical visual review`.
- `Full archive` selects source indexes, handoff contracts, compiled runtime
  sprite TOML, source/authoring sidecars including `*.guide.toml`, reports, and
  rendered artifacts for a broad handoff bundle.
- `Source checkpoint` selects the checkpoint artifact plus source-oriented scene
  files for work-in-progress capture.

Artifact wording follows the runtime/authoring split:

- `Compiled sprite TOML` is the runtime target for import pipelines and runtime consumers.
- `Guide TOML (authoring)` is editor/source IR with regions, datums, dimensions, and alignment marks.
- `Sprite compile report` explains how the runtime TOML was produced.
- `Sprite audit report` explains cut quality and review findings.
- `Checkpoint` is editor WIP state for resuming later, not a runtime export.

Multi-artifact checkout also writes an `export-manifest.json` file that lists
the selected artifact IDs, kinds, filenames, and source-object links. This is
separate from `handoff.toml`: the handoff file remains pipeline metadata, while
the export manifest describes the checkout bundle itself.

The Export cart remains browser-local. It does not add cloud sync, backend
storage, project accounts, Git integration, remote publishing, or server-side
packaging.

Generated files follow the M30c split:

- `render.svg` is the clean rendered artifact
- mechanical drawings render an A4 landscape sheet frame with a 10 mm print-safe margin, title block, and table records directly in SVG
- `document.json` is the scene graph and bundle index
- `layers/*.toml` are editable layer contracts
- `objects/*.toml` are editable object contracts
- `handoff.toml` is bundle-level handoff metadata
- `commands/session-commands.toml` is generated when session commands exist

M30e validates each generated export bundle in the Export panel. The validation
report checks required files, `document.json` shape and references, layer and
object asset paths, SVG object ID markers, handoff selected-object references,
and expected command recipe presence. The report can be copied for LLM handoff
alongside the generated files.

M30f adds reference grid metadata to generated `document.json` and
`handoff.toml`. This preserves the locator grid used by summaries and inspector
readouts without baking the overlay into clean rendered SVG output.

M30i adds unit metadata to generated `document.json` and `handoff.toml`.
Geometry, frame, and resolved values in object TOML are document units.

M30j adds optional `[viewport]` metadata to generated `handoff.toml` so a handoff
can preserve the current inspection focus. `document.json` remains the document
graph, and `render.svg` remains clean full-document artwork by default.

M30k adds image object contracts, `alphaMapFor` relations in `document.json`,
SVG mask output in `render.svg`, and `[[composite]]` entries in `handoff.toml`.
The relationship is explicit graph data rather than a nested Photoshop-style
layer stack.

M30l allows `[image] src` to be either a relative asset path such as
`assets/generated-product.svg` or a browser-loaded `data:image/...` URL.
Session command TOML may omit large `addImageObject` commands so command recipes
do not embed data URLs; the loaded image objects themselves remain present in the
exported scene files.

M30m adds optional PNG lowering controls to the same Export panel. Generating a
PNG creates a browser Blob named `render.png`, `render@2x.png`, or
`render@4x.png` and updates `handoff.toml` with `[rendered_artifacts]` and
`[lowering]` metadata. The binary PNG is downloaded separately; no ZIP writer or
server raster service is added.

M30o adds `generated-page.tsx` to generated export bundles. The handoff marks it
under `[rendered_artifacts]` and `[lowering.react]` as a lossy TSX code lowering
artifact. It preserves component intent better than pixels, but it intentionally
does not preserve editor commands, viewport state, every canvas semantic, or a
full import path back into MachinaCanvas.

M30p adds sketch overlay sidecars for images. Object exports can now use
`*.sketch.toml` dialect paths, `document.json` can include `sketchOverlayFor`
relations, and visible sketch overlays are part of `render.svg` and PNG
lowering. See [MachinaCanvas sketch overlays](../../docs/machina-canvas-sketch-overlays.md).

M30g command TOML export includes grid-aware command recipes, so handoff bundles
can preserve edits such as `moveToGrid`, `alignToGrid`, and
`resizeToGridSpan`. Importing TOML command recipes remains out of scope.

Export validation is still one-way. It is not import, round-trip loading, full
TOML semantic parsing, ZIP export, backend processing, LLM API integration, or
server-side raster rendering.

## Non-Goals

- no raster editing yet
- no `.mcanvas` or PNG import yet
- no server-side rasterization or native raster dependencies
- no LLM API yet
- no image generation, upload/backend service, or mask painting yet
- no plugin loader or tool package ecosystem yet
- no CAD, path, or font outline editing yet
- no file import yet
- no ZIP export yet
- no drag editing yet
- no arbitrary React/component imports in the editor
- no backend, routing, hooks, dispatch, or form submission from UI component previews

## Run

```bash
npm install
npm run dev
```
