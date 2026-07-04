# MachinaCanvas Tools

MachinaCanvas now has the beginning of an image editing toolbox: small,
deterministic local operations that work on scene objects and return structured
results.

The toolbox exists for LLM-assisted workflows. A model should be able to ask for
a known operation, inspect the created and updated object IDs, and continue
composing layers without inventing a one-off image script each time.

## Scope

Tools are plain TypeScript definitions registered in
`apps/machina-canvas/src/tools/`. The registry is intentionally small:

- `defineCanvasTools(...)`
- `listCanvasTools(...)`
- `getCanvasToolById(...)`
- `runCanvasTool(...)`

The registry rejects empty IDs, duplicate IDs, missing lookups, and malformed
tool results. It is not a plugin loader, package boundary, backend manifest, or
node graph.

## First Tool: Generate Alpha Map

`generate-alpha-map` is the first reusable tool.

It accepts a selected normal image object, decodes its pixels in the browser,
derives a grayscale alpha-map PNG, creates a hidden image object with role
`alphaMap`, and can optionally attach that object to the source image by setting
`alphaMapId`.

The result is structured:

```ts
{
  toolId: "generate-alpha-map",
  createdObjectIds: ["source-alpha-map"],
  updatedObjectIds: ["source"],
  notes: ["created alpha map object source-alpha-map"]
}
```

## Alpha Method

The alpha-map generator is deterministic. It samples the image corner colors as
the connected edge background, marks pixels that differ from that background as
foreground, flood-fills background from the image edges, and writes a grayscale
alpha image:

- white means opaque
- black means transparent
- gray is used for immediate boundary pixels

This preserves the same practical fallback behavior used in the alpha composite
smoke test. It assumes a simple subject with a solid background connected to the
image edges. It is suitable for clean product-style or generated-object images.
It is not semantic segmentation, matting, brush painting, or diffusion.

## Relationship To Generative Tools

These tools complement generative systems. A model can still use an external
image generator to create an RGB image, then use MachinaCanvas tools to prepare
local compositing assets deterministically.

MachinaCanvas tools do not call OpenAI, diffusion models, remote APIs, or a
backend service. They are browser-local operations over the current scene and
assets.

## Adding A Future Tool

Add a file in `apps/machina-canvas/src/tools/`, export a
`CanvasToolDefinition`, and register it in `tools/index.ts`.

A future tool should:

- have a stable non-empty ID
- declare a target kind such as `image-object`
- accept structured input
- return created and updated object IDs
- avoid hidden UI-only state
- keep deterministic local behavior unless explicitly documented otherwise

Keep the toolbox narrow. New tools should be structured image operations, not a
plugin ecosystem, node graph editor, backend, import pipeline, or raster paint
surface.
