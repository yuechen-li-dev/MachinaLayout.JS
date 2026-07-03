# MachinaCanvas Export Format

MachinaCanvas `.mcanvas` bundles are for LLM/human handoff and deterministic 2D scene editing. The rendered image is an output artifact. The editable truth is structured sidecar data that can be patched one object, layer, or command recipe at a time.

M30c designs the format and includes a checked-in fixture. M30d adds browser-local one-way export from the current MachinaCanvas runtime scene into `.mcanvas`-shaped text artifacts. M30f adds reference grid metadata for CAD-style locator language. M30g lets command JSON and exported command TOML use those refs for deterministic edits. M30h adds canvas frame intent beside resolved geometry. M30i adds document unit metadata and measurement-friendly summaries. It does not implement import, TOML parsing, ZIP packaging, raster rendering, zoom, backend services, or LLM API calls.

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
  preview.png                 optional
  document.json
  handoff.toml

  layers/
    background.toml
    product.toml
    foreground.toml

  objects/
    poster-bg.toml
    logo.toml
    headline.toml
    product-base-shadow.toml
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
      "objectIds": ["product-base-shadow", "product-silhouette-body", "product-highlight"]
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
  }
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
- `objects[id].kind`: object kind such as `rect`, `ellipse`, or `text`.
- `objects[id].asset`: relative path to the object TOML contract.

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
- Do not dump giant editable object blobs into `document.json`.

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

Rules:

- One object per TOML file.
- TOML files are meant to be patched by humans/LLMs.
- `[frame]` is semantic layout intent.
- `[resolved]` is current render geometry.
- `[geometry]` is retained as a compatibility shorthand for current resolved geometry.
- Style is explicit.
- Kind-specific blocks exist, including `[shape]` and `[text]`.
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
kind = "setFrame"
id = "cta-bg"

[command.frame]
kind = "anchor"
left = 72
bottom = 96
width = 188
height = 48
```

Rules:

- Runtime command JSON remains useful for API/editor input.
- TOML command recipes are for editable handoff/project files.
- Grid-aware command recipes use the exported reference grid labels.
- `setFrame` command recipes can store `absolute`, `anchor`, `referenceGrid`,
  and `referenceGridSpan` frame intent.
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
```

Rules:

- Handoff is metadata, not scene graph.
- `[unit_system]` preserves the document unit metadata used by summaries and measurements.
- `[reference_grid]` preserves the locator labels used by summaries and inspector references.
- Diagnostics can be TOML array tables.
- It should be easy to read in a text editor.

## Rendered Artifacts

`render.svg` is the canonical checked-in rendered artifact for the bundle. It should be readable where practical and may include data attributes such as:

- `data-canvas-object-id`
- `data-canvas-kind`
- `data-canvas-name`

`preview.png` is optional and can be omitted when a fixture only needs a lightweight readable artifact.

Rendered artifacts may be regenerated from `document.json` and object TOML specs in a later milestone. M30c does not implement regeneration.

M30f reference grid overlays are UI and handoff aids. Clean `render.svg` output
does not include the grid overlay by default; the grid definition lives in
`document.json` and `handoff.toml`.

M30i measurement labels are UI aids. Clean `render.svg` output does not include
measurement labels by default; unit metadata lives in `document.json` and
`handoff.toml`.

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
- whether a command recipe exists when the caller says session commands were expected

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
- No raster pipeline.
- No font outline format.
- No CAD/DXF yet.
- No cross-file dependency resolver.
- No plugin system.
- No LLM API calls.
- No backend service.
