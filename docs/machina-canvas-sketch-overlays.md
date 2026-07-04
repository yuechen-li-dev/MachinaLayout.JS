# MachinaCanvas Sketch Overlays

M30p adds structured visual sidecars for image reasoning.

Core slogan:

```txt
Pixels get sidecars.
Sidecars carry intent.
```

Or more directly:

```txt
Never ask an LLM to squint when it can read TOML.
```

## What A Sketch Overlay Is

A sketch overlay is a normal MachinaCanvas scene object with kind
`sketchOverlay`. It attaches to an image object through `image.sketchOverlayId`
and carries a structured `CanvasSketchSpec`.

The overlay is:

- not a raster edit
- not an alpha mask
- not a freehand drawing layer
- a structured visual reasoning sidecar

M30p implements one sidecar dialect:

- `*.sketch.toml`

The shape is intentionally future-friendly for later sidecars such as:

- `*.pcb.toml`
- `*.graph.toml`
- `*.spritegrid.toml`
- `*.atlas.toml`

Those later dialects are not implemented in M30p.

## Primitive Vocabulary

M30p supports four sketch primitives:

- `box`
- `line`
- `point`
- `label`

Primitive placement can use:

- absolute coordinates
- reference-grid refs such as `D3.c`
- reference-grid spans such as `D2-E4`
- object-anchor refs in the type shape

M30p fully renders absolute and grid refs. `objectAnchor` exists in the scene
model and resolver shape for future extension, but the current `.sketch.toml`
export path stays focused on absolute/grid placement.

## Scene And Inspector Behavior

Sketch overlays remain normal scene objects:

- they appear in the scene tree
- they can be selected from the scene tree
- they keep normal `visible` state
- they do not create a nested layer tree

When an image has a visible sketch overlay, the canvas renders the overlay after
the image so the reasoning marks sit on top. If the target image is hidden, the
overlay is also hidden from the rendered canvas/export path.

The inspector exposes:

- image-to-overlay relationship readout
- show/hide overlay toggle
- detach overlay action
- demo attach action for the built-in poster overlay
- overlay target/dialect/primitive-count details

No TOML editor, freehand drawing, brush tools, or sketch authoring UI are added
in M30p.

## Export Behavior

Sketch overlays export as dialect-specific sidecars:

```txt
objects/generated-product-sketch.sketch.toml
```

`document.json` exports explicit relations:

```json
{
  "kind": "sketchOverlayFor",
  "sourceId": "generated-product-image",
  "overlayId": "generated-product-sketch"
}
```

`handoff.toml` also includes `[[sketch_overlay]]` entries so readers can jump to
the sidecar path quickly.

Visible sketch overlays are included in `render.svg`, and therefore in browser
PNG lowering from that SVG. Hide the overlay before export if you want the clean
image artifact without the reasoning marks.
