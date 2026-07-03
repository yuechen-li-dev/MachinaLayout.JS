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
- `machinalayout/match` for object-kind presentation

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
