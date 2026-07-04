# MachinaCanvas Export Format

MachinaCanvas `.mcanvas` bundles are for LLM/human handoff and deterministic 2D scene editing. The rendered image is an output artifact. The editable truth is structured sidecar data that can be patched one object, layer, or command recipe at a time.

M30c designs the format and includes a checked-in fixture. M30d adds browser-local one-way export from the current MachinaCanvas runtime scene into `.mcanvas`-shaped text artifacts. M30f adds reference grid metadata for CAD-style locator language. M30g lets command JSON and exported command TOML use those refs for deterministic edits. M30h adds canvas frame intent beside resolved geometry. M30i adds document unit metadata and measurement-friendly summaries. M30j adds optional handoff viewport metadata for inspection focus. M30k adds explicit image objects and alpha-map composition relations. M30l allows browser-loaded local image assets to live in the runtime scene as data URL image sources. M30m adds browser-local PNG lowering from the current clean `render.svg`. M30o adds `uiComponent` objects and a lossy `generated-page.tsx` React/MachinaLayout code lowering artifact. M30p adds sketch overlay sidecars for image reasoning with `*.sketch.toml` object assets and `sketchOverlayFor` graph relations. It does not implement import, TOML parsing, ZIP packaging, server-side rasterization, image generation, upload UI, mask painting, wheel zoom, pan/drag navigation, backend services, arbitrary React execution, routing, hooks, or LLM API calls.

## Format Law

```txt
Rendered artifacts:
  SVG / PNG / PDF / DXF / whatever

Tree / graph / index:
  JSON

Editable object and asset specs:
  TOML

Runtime command payload:
  JSON

Editable command recipes:
  TOML
```

Document units are the authored coordinates.
Rendered pixels are the output.
JSON is the graph.
TOML is the contract.

Measure document units.
Render pixels.
Index trees.
Edit TOML.

JSON is good for trees, graphs, and indexes. TOML is better for hand-editable individual object specs. SVG, PNG, PDF, and similar formats are rendered/exported artifacts. Runtime command payloads remain JSON because they are editor/API input. Editable command recipes are TOML because they are project files meant for humans and LLMs to patch.

The analogy is `.sln` or `.slnx` for solution-level composition and `.csproj` for an individual editable contract: `document.json` is the bundle index, while TOML files are the patch-friendly object and layer contracts.

## Folder Structure

```txt
demo-poster.mcanvas/
  render.svg
  render.png                  optional lossy raster lowering
  generated-page.tsx          optional lossy React/MachinaLayout lowering
  preview.png                 optional
  document.json
  handoff.toml

  assets/
    generated-product.svg
    generated-product-alpha.svg

  layers/
    background.toml
    product.toml
    foreground.toml

  objects/
    poster-bg.toml
    logo.toml
    headline.toml
    product-base-shadow.toml
    generated-product-image.toml
    generated-product-sketch.sketch.toml
    generated-product-alpha.toml
    product-silhouette-body.toml
    product-highlight.toml
    price-chip.toml
    cta-bg.toml
    cta-label.toml
    feature-chip-1.toml
    feature-chip-2.toml
    feature-chip-3.toml

  commands/
    example-commands.toml
    last-session.json          optional
```

Paths inside the bundle are relative to the bundle root.

## `document.json`

`document.json` is the graph and index file. It owns document identity, canvas size, layer order, object order within each layer, and references to TOML assets. It should not contain all editable object properties.

```json
{
  "schemaVersion": 1,
  "document": {
    "id": "demo-poster",
    "name": "Demo Poster",
    "width": 960,
    "height": 640,
    "unit": "px",
    "unitSystem": {
      "unit": "px",
      "label": "px",
      "pixelsPerUnit": 1,
      "precision": 0
    }
  },
  "referenceGrid": {
    "columns": 6,
    "rows": 4,
    "columnLabels": ["A", "B", "C", "D", "E", "F"],
    "rowLabels": ["1", "2", "3", "4"]
  },
  "layers": [
    {
      "id": "background",
      "asset": "layers/background.toml",
      "objectIds": ["poster-bg"]
    },
    {
      "id": "product",
      "asset": "layers/product.toml",
      "objectIds": [
        "product-base-shadow",
        "generated-product-image",
        "generated-product-alpha",
        "product-silhouette-body",
        "product-highlight"
      ]
    },
    {
      "id": "foreground",
      "asset": "layers/foreground.toml",
      "objectIds": [
        "logo",
        "headline",
        "price-chip",
        "cta-bg",
        "cta-label",
        "feature-chip-1",
        "feature-chip-2",
        "feature-chip-3"
      ]
    }
  ],
  "objects": {
    "poster-bg": {
      "kind": "rect",
      "asset": "objects/poster-bg.toml"
    },
    "logo": {
      "kind": "text",
      "asset": "objects/logo.toml"
    },
    "headline": {
      "kind": "text",
      "asset": "objects/headline.toml"
    }
  },
  "relations": [
    {
      "kind": "alphaMapFor",
      "sourceId": "generated-product-image",
      "alphaId": "generated-product-alpha"
    },
    {
      "kind": "sketchOverlayFor",
      "sourceId": "generated-product-image",
      "overlayId": "generated-product-sketch"
    }
  ]
}
```

Fields:

- `schemaVersion`: integer schema version for the bundle index.
- `document`: document identity and canvas metadata.
- `document.id`: stable document ID.
- `document.name`: human-readable name.
- `document.width`, `document.height`: canvas dimensions.
- `document.unit`: compatibility mirror of `document.unitSystem.unit`.
- `document.unitSystem`: authored document unit metadata.
- `document.unitSystem.unit`: canonical unit ID such as `px`, `pt`, `mm`, `cm`, `in`, or `cu`.
- `document.unitSystem.label`: label used in summaries and UI.
- `document.unitSystem.pixelsPerUnit`: nominal rendered CSS pixels per document unit at 100% export scale.
- `document.unitSystem.precision`: default decimal precision for formatted measurements.
- `referenceGrid`: optional locator grid metadata for human/LLM references.
- `referenceGrid.columns`, `referenceGrid.rows`: grid dimensions.
- `referenceGrid.columnLabels`, `referenceGrid.rowLabels`: rendered locator labels.
- `layers`: ordered layer index. Layer order remains here.
- `layers[].id`: stable layer ID.
- `layers[].asset`: relative path to layer TOML.
- `layers[].objectIds`: ordered object IDs in that layer.
- `objects`: map of stable object IDs to object index entries.
- `objects[id].kind`: object kind such as `rect`, `ellipse`, `text`, `image`, `uiComponent`, or `sketchOverlay`.
- `objects[id].asset`: relative path to the object TOML contract.
- `relations`: optional graph relations such as `alphaMapFor` and `sketchOverlayFor`.
- `relations[].kind`: relation kind.
- `relations[].sourceId`: source image object ID for `alphaMapFor`.
- `relations[].alphaId`: alpha map or mask image object ID for `alphaMapFor`.
- `relations[].overlayId`: sketch overlay object ID for `sketchOverlayFor`.

Rules:

- `document.json` owns graph/order/index.
- Object entries point to TOML files.
- Layer entries point to TOML files and list ordered object IDs.
- Object IDs must be stable.
- File paths are relative to bundle root.
- Reference grid metadata describes a locator overlay, not snapping or layout.
- Object geometry, frame, and resolved values are document units.
- SVG `viewBox` coordinates can use document coordinates directly.
- Screen pixels and future viewport zoom are separate from document units.
- Viewport zoom is viewer state and does not belong in `document.json`.
- Do not dump giant editable object blobs into `document.json`.
- Alpha-map composition is graph data, not a nested layer tree.

## Reference Grid

The reference grid gives the canvas a speakable coordinate system. Columns use
spreadsheet-style labels such as `A`, `B`, `C`; rows use numeric labels such as
`1`, `2`, `3`. Object summaries can then say `feature-chip-1: A4-B4` or
`product-body center D3.c`.

The grid is semantic metadata. It is not a layout grid, snapping system,
constraint solver, or ruler editor. M30f exports the grid definition and uses it
in summaries. M30g adds explicit grid-aware commands that consume refs such as
`A1`, `D3.ne`, `B4@0.5,0.25`, and spans such as `A2-C3`.

## MachinaLayout Vocabulary Carried Into MachinaCanvas

MachinaLayout places interface rectangles. MachinaCanvas places visual objects.
M30h maps only the layout concepts that make object placement intent explicit.

| MachinaLayout concept | MachinaCanvas equivalent | M30h status |
| --- | --- | --- |
| `AbsoluteFrame` | `CanvasAbsoluteFrame` with explicit object bounds | Implemented |
| `AnchorFrame` | `CanvasAnchorFrame` against document bounds | Implemented |
| `GridArrange` / `CellFrame` | Reference grid point/span placement | Implemented through existing reference grid refs, not arbitrary nested grids |
| `GuideFrame` / `EdgeRef` | Future object-edge references for labels, callouts, and relative annotation | Deferred |
| `FixedFrame` / `FillFrame` | Future size intent for repeated chips, strips, and named regions | Deferred |
| `StackArrange` | Future repeated object rows, chip groups, and card strips | Deferred |
| `OffsetSpec` | Future post-placement nudge intent | Deferred |
| Layers / `z` | Canvas layer order and object order in `document.json` | Existing/exported; documented only |
| Variants | Future responsive/export variants for canvas documents | Deferred |
| Resolved rects | Object `x`, `y`, `width`, `height` | Existing and retained as render geometry |
| Reference grid | Speakable canvas locator grid | Existing from M30f; used by M30h frames |

## Object TOML

Object TOML is the editable object contract. There is one object per TOML file. These files are meant to be patched by humans and LLMs.

Geometry and style are explicit. M30h adds `[frame]` for editable spatial intent
and `[resolved]` for the current render geometry. `[geometry]` remains as a
compatibility shorthand for current resolved geometry during this app phase.
Kind-specific blocks hold fields that only apply to some objects, such as
`[shape]` for rect radius and `[text]` for text content and font settings.
All geometry, frame, and resolved numbers are document units from
`document.unitSystem`.

Rect:

```toml
id = "cta-bg"
kind = "rect"
name = "CTA button background"
layer = "foreground"
visible = true
locked = false

[geometry]
x = 72
y = 390
width = 188
height = 48

[frame]
kind = "anchor"
left = 72
bottom = 202
width = 188
height = 48

[resolved]
x = 72
y = 390
width = 188
height = 48

[shape]
radius = 0

[style]
fill = "#111111"
stroke = "none"

[metadata]
tags = ["button", "cta"]
notes = "Black call-to-action button background."
```

Text:

```toml
id = "logo"
kind = "text"
name = "CODEX wordmark"
layer = "foreground"
visible = true

[geometry]
x = 72
y = 64
width = 180
height = 36

[text]
value = "CODEX"
font_size = 28
font_weight = 800
font_family = "Inter, Arial, sans-serif"

[style]
fill = "#111111"

[metadata]
tags = ["brand", "wordmark"]
notes = "Top-left wordmark."
```

Ellipse:

```toml
id = "product-highlight"
kind = "ellipse"
name = "Product highlight"
layer = "product"
visible = true

[geometry]
x = 565
y = 238
width = 62
height = 170

[style]
fill = "#ffffff"
stroke = "none"
opacity = 0.92

[metadata]
tags = ["product", "highlight"]
```

Image with alpha map:

```toml
id = "generated-product-image"
kind = "image"
name = "Generated product image"
layer = "product"
visible = true
locked = false

[geometry]
x = 508
y = 176
width = 224
height = 308

[frame]
kind = "referenceGrid"
ref = "D3@0.85,0.05"
anchor = "center"
width = 224
height = 308

[resolved]
x = 508
y = 176
width = 224
height = 308

[image]
src = "assets/generated-product.svg"
role = "image"
alpha_map_id = "generated-product-alpha"
fit = "contain"
intrinsic_width = 512
intrinsic_height = 512

[composite]
opacity = 1
blend_mode = "normal"
```

Browser-loaded image:

```toml
id = "image-product"
kind = "image"
name = "Product"
layer = "foreground"
visible = true
locked = false

[geometry]
x = 180
y = 140
width = 40
height = 20

[frame]
kind = "absolute"
x = 180
y = 140
width = 40
height = 20

[resolved]
x = 180
y = 140
width = 40
height = 20

[image]
src = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg=="
role = "image"
fit = "contain"
intrinsic_width = 40
intrinsic_height = 20

[metadata]
tags = ["loaded", "image"]
notes = "Loaded from product.svg (image/svg+xml)."
```

Alpha map:

```toml
id = "generated-product-alpha"
kind = "image"
name = "Generated product alpha map"
layer = "product"
visible = false
locked = false

[geometry]
x = 508
y = 176
width = 224
height = 308

[resolved]
x = 508
y = 176
width = 224
height = 308

[image]
src = "assets/generated-product-alpha.svg"
role = "alphaMap"
fit = "contain"
color_space = "alpha"
```

Sketch overlay sidecar:

```toml
id = "generated-product-sketch"
kind = "sketchOverlay"
name = "Generated product sketch overlay"
target_id = "generated-product-image"
dialect = "sketch"
visible = true

[[box]]
id = "silhouette-box"
label = "Silhouette frame"
frame = "D2-E4"
stroke = "#2364d2"

[[line]]
id = "highlight-callout"
label = "Highlight callout"
from = "D3.e"
to = "E2.w"
stroke = "#2364d2"

[[point]]
id = "focus-point"
label = "Bottle center"
ref = "D3.c"

[[label]]
id = "main-note"
text = "Generated product silhouette"
ref = "D2.n"
```

UI component:

```toml
id = "ui-primary-cta"
kind = "uiComponent"
name = "Primary CTA"
layer = "ui-components"
visible = true
locked = false

[geometry]
x = 616
y = 552
width = 162
height = 44

[frame]
kind = "absolute"
x = 616
y = 552
width = 162
height = 44

[resolved]
x = 616
y = 552
width = 162
height = 44

[component]
id = "Button"
variant = "primary"
export_name = "PrimaryCta"

[props]
children = "Generate page"
disabled = false
size = "lg"
variant = "primary"
```

Rules:

- One object per TOML file.
- TOML files are meant to be patched by humans/LLMs.
- `[frame]` is semantic layout intent.
- `[resolved]` is current render geometry.
- `[geometry]` is retained as a compatibility shorthand for current resolved geometry.
- Style is explicit.
- Kind-specific blocks exist, including `[shape]` and `[text]`.
- Image objects use `[image]`; normal images may point at alpha maps with
  `alpha_map_id`.
- UI component objects use `[component]` and `[props]`. `component.id`
  references the built-in MachinaCanvas UI component catalog. Props are boring
  serializable values only: strings, numbers, booleans, null-like empty values,
  and string/number arrays.
- `src` may be a bundle-relative asset path or a `data:image/...` URL produced
  by browser-local file loading. Data URLs are self-contained and convenient for
  local handoff, but they can make object TOML and `render.svg` large.
- Image composition metadata uses `[composite]` with fields such as `opacity`
  and `blend_mode`.
- Alpha map objects remain normal scene objects and are often `visible = false`
  so they are inspectable and exportable without rendering as normal artwork.
- Sketch overlay objects remain normal scene objects and use dialect-specific
  object assets such as `*.sketch.toml`.
- No giant object JSON blob.

## Layer TOML

Layer TOML holds editable layer metadata. Layer ordering and object ID ordering remain in `document.json`.

```toml
id = "foreground"
name = "Foreground"
visible = true
locked = false

[metadata]
tags = ["text", "interactive"]
notes = "Foreground text and call-to-action objects."
```

Rules:

- Layer order remains in `document.json`.
- Layer metadata lives in TOML.
- Layer TOML should not duplicate the object ID list unless a later schema adds a specific reason.

## Command Recipe TOML

Runtime command JSON remains useful for API/editor input. TOML command recipes are editable handoff/project files. They can describe repeatable command sequences without requiring brace-heavy JSON editing.

```toml
name = "Align hero text and distribute chips"
description = "Example command recipe for LLM-assisted geometric edits."

[[command]]
kind = "align"
axis = "left"
ids = ["logo", "headline"]

[[command]]
kind = "move"
id = "cta-bg"
dx = 0
dy = 16

[[command]]
kind = "move"
id = "cta-label"
dx = 0
dy = 16

[[command]]
kind = "distribute"
axis = "horizontal"
ids = ["feature-chip-1", "feature-chip-2", "feature-chip-3"]
gap = 16

[[command]]
kind = "moveToGrid"
id = "feature-chip-1"
ref = "B4.c"
anchor = "center"

[[command]]
kind = "alignToGrid"
axis = "left"
ids = ["logo", "headline"]
ref = "A1.w"

[[command]]
kind = "resizeToGridSpan"
id = "product-body"
span = "D2-E4"

[[command]]
kind = "attachAlphaMap"
source_id = "generated-product-image"
alpha_id = "generated-product-alpha"

[[command]]
kind = "detachAlphaMap"
source_id = "generated-product-image"

[[command]]
kind = "attachSketchOverlay"
source_id = "generated-product-image"
overlay_id = "generated-product-sketch"

[[command]]
kind = "detachSketchOverlay"
source_id = "generated-product-image"

[[command]]
kind = "setSketchOverlayVisible"
overlay_id = "generated-product-sketch"
visible = true

[[command]]
kind = "removeObject"
id = "generated-product-alpha"

[[command]]
kind = "setFrame"
id = "cta-bg"

[command.frame]
kind = "anchor"
left = 72
bottom = 96
width = 188
height = 48

[[command]]
kind = "setUiProp"
id = "ui-primary-cta"
prop = "children"
value = "Generate page"
```

Rules:

- Runtime command JSON remains useful for API/editor input.
- TOML command recipes are for editable handoff/project files.
- Grid-aware command recipes use the exported reference grid labels.
- `setFrame` command recipes can store `absolute`, `anchor`, `referenceGrid`,
  and `referenceGridSpan` frame intent.
- `setUiProp` command recipes can store basic UI component prop edits.
- `attachAlphaMap` and `detachAlphaMap` command recipes preserve explicit
  image-to-alpha-map relationship edits.
- `attachSketchOverlay`, `detachSketchOverlay`, and `setSketchOverlayVisible`
  preserve explicit image-to-sketch-overlay relationship edits.
- `removeObject` command recipes preserve unload/remove edits.
- `addImageObject` runtime commands may be omitted from command TOML recipes
  because they can contain large data URL image payloads. The loaded image
  object itself is still exported through `objects/*.toml`, `document.json`, and
  `render.svg`.
- The format does not require a TOML parser or command recipe importer.

## `handoff.toml`

`handoff.toml` is bundle-level handoff metadata, not the scene graph. It gives readers a summary, key entry points, selected object state, and diagnostics in a text-editor-friendly file.

```toml
schema_version = 1
name = "Demo Poster"
created_by = "MachinaCanvas"
source_app = "apps/machina-canvas"

render_svg = "render.svg"
document_json = "document.json"

[selected]
object_id = "feature-chip-1"

[viewport]
zoom = 4
center_x = 520
center_y = 320
focus_kind = "gridRef"
focus_value = "D3"

[unit_system]
unit = "px"
label = "px"
pixels_per_unit = 1
precision = 0

[reference_grid]
columns = 6
rows = 4
columns_label = "A-F"
rows_label = "1-4"

[summary]
text = "Demo Poster is 960 px x 640 px with 12 objects across 3 layers. Selected Feature chip: IDs spans A4-B4; size 138 px x 34 px."

[validation]
ok = true
diagnostics = 0

[[diagnostic]]
severity = "info"
code = "SelectedObject"
object_id = "feature-chip-1"
message = "Selected object is Feature chip: IDs."

[[composite]]
kind = "alphaMapFor"
source_id = "generated-product-image"
alpha_id = "generated-product-alpha"

[[sketch_overlay]]
source_id = "generated-product-image"
overlay_id = "generated-product-sketch"
path = "objects/generated-product-sketch.sketch.toml"
```

Rules:

- Handoff is metadata, not scene graph.
- `[viewport]` is optional viewer/handoff metadata for the current inspection focus.
- Viewport coordinates are document units. Zoom is a camera scale, not document geometry.
- `[unit_system]` preserves the document unit metadata used by summaries and measurements.
- `[reference_grid]` preserves the locator labels used by summaries and inspector references.
- Diagnostics can be TOML array tables.
- It should be easy to read in a text editor.
- `[[composite]]` entries summarize exported image composition relationships
  for handoff readers.
- `[[sketch_overlay]]` entries summarize exported image-to-sidecar relationships
  for handoff readers.

## Rendered Artifacts

`render.svg` is the canonical checked-in rendered artifact for the bundle. It should be readable where practical and may include data attributes such as:

- `data-canvas-object-id`
- `data-canvas-kind`
- `data-canvas-name`

`render.png` is optional and can be omitted when a fixture or export only needs
the semantic package and vector artifact.

`generated-page.tsx` is optional and can be omitted when a handoff only needs
the semantic package and rendered artifacts. When present, it is a lossy code
lowering artifact, not a source format for importing back into MachinaCanvas.

`preview.png` is optional and can be omitted when a fixture only needs a lightweight readable artifact.

Rendered artifacts may be regenerated from `document.json` and object TOML specs in a later milestone. M30c does not implement regeneration.

M30f reference grid overlays are UI and handoff aids. Clean `render.svg` output
does not include the grid overlay by default; the grid definition lives in
`document.json` and `handoff.toml`.

M30i measurement labels are UI aids. Clean `render.svg` output does not include
measurement labels by default; unit metadata lives in `document.json` and
`handoff.toml`.

M30j viewport zoom is also a UI/handoff aid. Clean `render.svg` output remains
full-document artwork by default; zoomed inspection state may be written to
`handoff.toml` as optional `[viewport]` metadata.

M30k image composition uses SVG masks. For an image object with
`alphaMapId = "generated-product-alpha"`, `render.svg` emits a deterministic
mask ID such as `mask-generated-product-image` and applies it to the source
`<image>`. In M30k, mask placement uses the source image object's resolved
geometry so RGB image and alpha map assets align by default. The alpha map
object's own geometry remains inspectable and exported, but it does not drive
mask placement yet. Invisible alpha maps are not rendered as normal image
objects.

M30l data URL image sources are written directly to SVG `<image href="...">`
attributes. Relative fixture asset paths remain valid, and data URLs do not
require any bundle asset file existence check.

M30p visible sketch overlays render into clean `render.svg` after their target
image so the reasoning marks remain readable. Hide the overlay before export if
you want it excluded from `render.svg` and PNG lowering. Sketch overlays are
not raster edits; their editable truth lives in `*.sketch.toml`.

M30m `render.png` is an optional lossy bitmap lowering from `render.svg`. It is
generated browser-locally with SVG image loading and canvas `toBlob("image/png")`.
Transparent background is the default for PNG, with optional solid background
fill and export scale. PNG validation is runtime/UI-local in M30m; the text-only
`CanvasExportBundle` can reference the generated raster path in `handoff.toml`
without embedding binary image data in the text file list.

M30o `generated-page.tsx` is an optional React/MachinaLayout lowering. It emits
a working page shell with `MachinaReactView`; UI component objects become
presentational React markup, images stay images, text stays text, and simple
vector objects become decorative blocks. It does not execute arbitrary imported
components, add hooks, fetch data, route, submit forms, or preserve a full
round-trip editor source.

### Raster lowering / PNG export

MachinaCanvas treats raster export as a lowering operation:

```txt
CanvasDocument / .mcanvas semantic package
  -> render.svg
  -> browser rasterization
  -> render.png
```

The `.mcanvas` package is the editable source of truth. `render.svg` is the
vector rendered artifact generated from the current document. `render.png` is a
lossy bitmap artifact generated by loading that SVG into the browser and drawing
it to an `HTMLCanvasElement`.

PNG lowering strips the semantic model. The PNG does not preserve layers, object
IDs, TOML metadata, frame intent, command recipes, reference-grid semantics,
unit metadata, viewport focus, or alpha-map relationship metadata. It preserves
only pixels and alpha after browser SVG rendering.

PNG export defaults to a transparent background. The app can optionally fill a
solid white or black background before drawing the SVG. Scale options such as
1x, 2x, and 4x change the output bitmap dimensions; they do not change document
geometry, viewport zoom, or object coordinates.

When PNG lowering has been generated, `handoff.toml` can describe the raster
artifact:

```toml
[rendered_artifacts]
svg = "render.svg"
png = "render@2x.png"

[lowering]
target = "png"
scale = 2
background = "transparent"
lossy = true
```

Reference grid overlays, measurement labels, selection outlines, and editor UI
are not included in `render.svg`, so they are not included in PNG lowering by
default. Image objects and alpha-map SVG masks are preserved through the SVG
rendering path and rasterized by the browser.

## Relationship To The Runtime App

The current MachinaCanvas app uses an in-memory scene model. M30d serializers turn that current browser-local scene into a `.mcanvas`-shaped file list:

- `render.svg`
- `document.json`
- `handoff.toml`
- `layers/<layer-id>.toml`
- `objects/<object-id>.toml`
- `commands/session-commands.toml` when session commands are provided

The app exposes these generated text artifacts in an Export panel. Users can generate the file list, select a file, copy its text, or download that file through browser Blob downloads. The export is one-way; importing a `.mcanvas` bundle back into the runtime remains future work.

The serializers preserve the format law: rendered artifacts are output, JSON is the graph/index, TOML is the editable contract, and runtime command payloads stay JSON while editable command recipes are TOML.

M30g serializers include `moveToGrid`, `alignToGrid`, and
`resizeToGridSpan` in command TOML. M30h serializers also include `setFrame`.
M30i serializers include unit metadata in `document.json` and `[unit_system]`
in `handoff.toml`.
M30j serializers may include `[viewport]` in `handoff.toml` when the app passes
current viewer state to export.
M30k serializers include image object `[image]` and `[composite]` blocks,
`alphaMapFor` relations in `document.json`, SVG mask output in `render.svg`,
and `[[composite]]` handoff entries.
M30p serializers include image `sketch_overlay_id`, `sketchOverlayFor`
relations in `document.json`, `*.sketch.toml` sidecars, `[[sketch_overlay]]`
handoff entries, and visible sketch overlay primitives in `render.svg`.
M30l serializers preserve browser-loaded image `src` data URLs in object TOML
and SVG output. Command recipe serialization can skip bulky `addImageObject`
session commands while keeping smaller edits such as `removeObject`.
M30m can add `[rendered_artifacts]` and `[lowering]` metadata to `handoff.toml`
after PNG generation. The PNG itself is not part of the text-only bundle file
list.
M30o can add `generated-page.tsx` and `[lowering.react]` metadata to
`handoff.toml`. The TSX is editable developer code, but `.mcanvas` remains the
semantic scene handoff.
These are command recipes only; exporting a recipe does not imply snapping,
constraints, drag editing, or import support.

## Export Validation

M30e adds browser-local validation for generated export bundles before users or
LLMs download, copy, or hand off the files. Validation checks the relationship
between the file list, `document.json`, rendered SVG output, and lightweight
handoff references.

Validation checks:

- required files such as `document.json`, `render.svg`, and `handoff.toml`
- whether `document.json` parses as JSON and has the expected graph/index shape
- whether optional `document.unitSystem` metadata is structurally valid when present
- whether every layer asset path in `document.json` exists in the generated file list
- whether every object asset path in `document.json` exists in the generated file list
- whether `layers[].objectIds[]` point to known object IDs
- whether extra `objects/*.toml` files lack a matching `document.json` object entry
- whether `render.svg` includes `data-canvas-object-id` markers for indexed objects
- whether `handoff.toml` selected `object_id` points to a known object when present
- whether `document.json` `alphaMapFor` relations point to image objects
- whether `document.json` `sketchOverlayFor` relations point to image and sketchOverlay objects
- whether `render.svg` includes a mask for alpha-mapped image relations
- whether a command recipe exists when the caller says session commands were expected
- whether generated TSX exists when listed in handoff metadata is intentionally a lightweight file-list check for now

Validation does not import a bundle back into the runtime scene. It does not
parse TOML semantically, add a TOML parser dependency, resolve every object
field, regenerate SVG, package ZIP files, call a backend, or call an LLM API.
Only `document.json` is parsed as structured data. TOML checks stay intentionally
lightweight text checks.

Errors mean the bundle is internally inconsistent enough that validation fails.
Warnings are advisory and do not make the validation result fail. The
`render.svg` object ID check is a warning because invisible objects or objects on
hidden layers may legitimately be omitted from rendered output while still
remaining indexed in `document.json` and represented by object TOML contracts.
The missing composite mask check is advisory because it is a deterministic but
text-based SVG check.

## Fixture

The M30c fixture lives at:

```txt
apps/machina-canvas/fixtures/demo-poster.mcanvas/
```

It includes `render.svg`, `document.json`, `handoff.toml`, layer TOML files, object TOML files, and `commands/example-commands.toml`.

## Non-Goals

- No importer yet.
- No TOML parser.
- No ZIP bundle writer.
- No server-side raster pipeline.
- No PNG import or metadata embedding.
- No image generation.
- No upload UI.
- No raster mask painting.
- No nested Photoshop-style layer tree.
- No font outline format.
- No CAD/DXF yet.
- No cross-file dependency resolver.
- No plugin system.
- No LLM API calls.
- No backend service.
- No arbitrary React component execution in the editor.
- No TSX import or round-trip source loading.
- No hooks, routing, dispatch integration, data fetching, or real form submission in UI component previews.
