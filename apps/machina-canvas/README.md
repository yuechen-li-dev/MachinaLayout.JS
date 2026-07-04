# MachinaCanvas

MachinaCanvas is the first dogfood app for MachinaLayout.JS: a small React/Vite prototype for an LLM-friendly 2D graphics editor substrate.

Core thesis:

```txt
LLMs do not need more pixels.
They need inspectable geometry.
```

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
- SVG mask-based composition for deterministic transparent visual output
- browser-local PNG lowering from clean `render.svg`
- inspector toggles for reference grid, grid lines, measurement labels, and diagnostics
- JSON command validation and command-based edits
- before/after command result summaries in a command log
- geometry diagnostics for selected-object and scene inspection
- `machinalayout/match` for object-kind presentation

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

Generated files follow the M30c split:

- `render.svg` is the clean rendered artifact
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
- no CAD, path, or font outline editing yet
- no file import yet
- no ZIP export yet
- no drag editing yet

## Run

```bash
npm install
npm run dev
```
