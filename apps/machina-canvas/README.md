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
runtime app still uses its in-memory scene model; M30c does not add import or
export UI.

## Non-Goals

- no raster editing yet
- no LLM API yet
- no CAD, path, or font outline editing yet
- no real file import/export yet
- no drag editing yet

## Run

```bash
npm install
npm run dev
```
