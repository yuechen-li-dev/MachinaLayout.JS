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

Validation reports diagnostics instead of throwing for normal input failures. It checks command kind, target object IDs, finite numbers, positive sizes, align/distribute object lists, valid axes, and non-negative distribute gaps.

The command log records recent applied commands, result messages, and field-level before/after changes. This is the command substrate an LLM could target, but the app does not call an LLM API yet.

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

The grid is a locator language, not a layout system. It does not snap objects,
add grid edit commands, create CAD constraints, or change MachinaLayout resolver
behavior. It gives humans and LLMs a compact way to refer to geometry:

```txt
feature-chip-1 spans A4-B4 and centers at A4.ne
```

The editor renders a faint SVG overlay with border labels, shows selected-object
references in the inspector, includes spans in scene summaries and object cards,
and writes reference grid metadata into generated handoff files. Clean
`render.svg` export output does not include the overlay by default.

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

Export validation is still one-way. It is not import, round-trip loading, full
TOML semantic parsing, ZIP export, backend processing, LLM API integration, or
raster/PNG rendering.

## Non-Goals

- no raster editing yet
- no LLM API yet
- no CAD, path, or font outline editing yet
- no file import yet
- no ZIP export yet
- no drag editing yet

## Run

```bash
npm install
npm run dev
```
