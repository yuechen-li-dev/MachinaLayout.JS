# MachinaCanvas Export Format

MachinaCanvas `.mcanvas` bundles are for LLM/human handoff and deterministic 2D scene editing. The rendered image is an output artifact. The editable truth is structured sidecar data that can be patched one object, layer, or command recipe at a time.

M30c designs the format and includes a checked-in fixture. It does not implement importer/exporter UI or regeneration from the bundle.

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

Pixels are the output.
JSON is the graph.
TOML is the contract.

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
    "unit": "px"
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
- `document.unit`: coordinate unit, currently `px`.
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
- Do not dump giant editable object blobs into `document.json`.

## Object TOML

Object TOML is the editable object contract. There is one object per TOML file. These files are meant to be patched by humans and LLMs.

Geometry and style are explicit. Kind-specific blocks hold fields that only apply to some objects, such as `[shape]` for rect radius and `[text]` for text content and font settings.

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
- Geometry is explicit.
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
```

Rules:

- Runtime command JSON remains useful for API/editor input.
- TOML command recipes are for editable handoff/project files.
- M30c does not require a TOML parser or command recipe importer.

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

[summary]
text = "Demo Poster is 960x640px with 12 objects across 3 layers."

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
- Diagnostics can be TOML array tables.
- It should be easy to read in a text editor.

## Rendered Artifacts

`render.svg` is the canonical checked-in rendered artifact for the bundle. It should be readable where practical and may include data attributes such as:

- `data-canvas-object-id`
- `data-canvas-kind`
- `data-canvas-name`

`preview.png` is optional and can be omitted when a fixture only needs a lightweight readable artifact.

Rendered artifacts may be regenerated from `document.json` and object TOML specs in a later milestone. M30c does not implement regeneration.

## Relationship To The Runtime App

The current MachinaCanvas app uses an in-memory scene model. Future export work can serialize that scene into `.mcanvas` bundle files and import a bundle back into the app. M30c only designs the format and adds a fixture bundle corresponding roughly to the current demo poster.

## Fixture

The M30c fixture lives at:

```txt
apps/machina-canvas/fixtures/demo-poster.mcanvas/
```

It includes `render.svg`, `document.json`, `handoff.toml`, layer TOML files, object TOML files, and `commands/example-commands.toml`.

## Non-Goals

- No full importer/exporter yet.
- No raster pipeline.
- No font outline format.
- No CAD/DXF yet.
- No cross-file dependency resolver.
- No plugin system.
- No LLM API calls.
- No backend service.
