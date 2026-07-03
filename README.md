# MachinaLayout

MachinaLayout is a machine-native UI layout substrate: flat records in, deterministic rectangles out.

**CSS paints; Machina places.**

## Install

```bash
npm install machinalayout
```

## One-page mental model

1. Author layout as flat `LayoutRow[]` records.
2. Parent means coordinate ownership.
3. `frame` decides a node rectangle.
4. `arrange` decides direct child placement.
5. Metadata (like `view`, `slot`, `z`, layers, data) shapes rendering behavior, not geometry solving.
6. Variants are authoring-time row selection.
7. The resolver outputs deterministic rectangles.
8. Adapters render those rectangles.
9. Text renders inside owned rectangles.
10. CSS paints; Machina places.

## Adapter philosophy

Machina adapters ask you to learn one layout model: Machina records. The framework adapter only asks for components in that framework.

- Machina adapters do not introduce a new layout model per framework.
- Layout stays framework-independent: author rows, resolve rectangles, render through adapters.
- Frameworks supply components; Machina supplies geometry.
- Users should not need framework-specific layout ceremony to place boxes.
- If you know TypeScript and what a component looks like in your renderer, that is enough.
- Adapter-specific details stay inside adapter internals.

**CSS paints; Machina places; adapters translate.**


## Adapter/text subpath matrix

### Layout adapters

- React DOM: `machinalayout/react`
- React Native: `machinalayout/react-native`
- Vue DOM: `machinalayout/vue`

### Text

- Parser/core text: `machinalayout/text`

### Text renderers

- React DOM: `machinalayout/text/react`
- React Native: `machinalayout/text/react-native`
- Vue DOM: `machinalayout/text/vue`

Inspection and handoff utilities are available at `machinalayout/inspect` and `machinalayout/handoff`.

Subpath imports are preferred for adapters/renderers. Root imports remain valid during `0.x` compatibility windows.

Framework peers are adapter-specific (`react`/`react-dom`, `react-native`, `vue`) based on the subpaths you use.

Normal users should not need to learn each framework's layout/template box-drawing system: layout is Machina records, framework components are payloads rendered inside resolved rectangles.

## Current capability summary

### Core

- `RootFrame`
- `AbsoluteFrame`
- `AnchorFrame` with `UiLength`
- `GuideFrame`
- `FixedFrame`
- `FillFrame`
- `CellFrame`
- `StackArrange`
- `GridArrange`
- `OffsetSpec`
- responsive variants
- bounded `z`
- named layers
- layout interpolation helpers
- stack geometry/content query helpers

### React

- `MachinaReactView`
- effective render key: `view ?? slot`
- `viewData` / `nodeData`
- named layer paint ordering
- containment/content-visibility options

### Vue

- `MachinaVueView`
- same resolved-layout rectangle rendering model as React DOM
- effective render key: `view ?? slot`
- `viewData` / `nodeData`
- named layer paint ordering
- containment/content-visibility options

### Text

- MachinaText parser
- diagnostics
- `MachinaTextView`
- vertical rhythm policy

### Sharp boundaries

- No portals/reparenting.
- No intrinsic text sizing driving outer layout.
- No general constraint solver.
- No CSS Grid clone.
- No auto-placement.

`GuideFrame` reads other nodes’ resolved geometry as a read-only alignment input. It preserves the one-parent model: parent remains the coordinate owner. `GuideFrame` does not portal, reparent DOM nodes, or escape clipping.

Named layers organize paint order over the existing bounded `z` system. Layers are not portals.


## Docs index

- [Row model](docs/row-model.md)
- [Frames and stack](docs/frames-and-stack.md)
- [Grid arrange](docs/grid-arrange.md)
- [Stack geometry helpers](docs/stack-geometry-helpers.md)
- [Screen catalog and viewport matrix](docs/screen-catalog-and-viewports.md)
- [Inspection and handoff bundles](docs/inspection-and-handoff.md)
- [MachinaCanvas export format](docs/machina-canvas-export-format.md)
- [Error codes](docs/error-codes.md)
- [MachinaAtlas](docs/machina-atlas.md) — optional app-composition metadata and source-section helpers.
- [Exhaustive enum matching](docs/exhaustive-match.md)

## Tiny `LayoutRow[]` example

```ts
import {
  type LayoutRow,
  resolveLayoutRows,
  type Rect,
} from "machinalayout";

const rows: LayoutRow[] = [
  {
    id: "root",
    frame: { kind: "root" },
  },
  {
    id: "header",
    parent: "root",
    order: 0,
    frame: { kind: "anchor", left: 0, right: 0, top: 0, height: 64 },
    view: "header",
  },
  {
    id: "sidebar",
    parent: "root",
    order: 1,
    frame: { kind: "anchor", left: 0, top: 64, bottom: 0, width: 240 },
    view: "sidebar",
  },
  {
    id: "toolbar",
    parent: "root",
    order: 2,
    frame: { kind: "anchor", left: 240, right: 0, top: 64, height: 56 },
    arrange: {
      kind: "stack",
      axis: "horizontal",
      gap: 8,
      padding: { top: 8, right: 8, bottom: 8, left: 8 },
      justify: "start",
      align: "center",
    },
  },
  {
    id: "toolbar-button-1",
    parent: "toolbar",
    order: 0,
    frame: { kind: "fixed", width: 120, height: 40 },
    view: "toolbarButton",
  },
];

const rootRect: Rect = { x: 0, y: 0, width: 1024, height: 640 };
const resolved = resolveLayoutRows(rows, rootRect);
```

`view` is the preferred author-facing render key. `slot` remains valid as the adapter-facing technical key. The effective render key is `view ?? slot`.

## React adapter quick example

```tsx
import { resolveLayoutRows } from "machinalayout";
import { MachinaReactView } from "machinalayout/react";
import { parseMachinaText } from "machinalayout/text";
import { MachinaTextView } from "machinalayout/text/react";

const resolved = resolveLayoutRows(rows, rootRect);
const textAst = parseMachinaText("Hello");

const views = {
  header: HeaderView,
  sidebar: SidebarView,
  toolbarButton: ToolbarButtonView,
};

export function App() {
  return <MachinaReactView layout={resolved} views={views} viewData={{ sidebar: { collapsed: false } }} />;
}
```


Subpath imports are the preferred path for adapters (`machinalayout/react`, `machinalayout/react-native`, `machinalayout/vue`, `machinalayout/text`, `machinalayout/text/react`, `machinalayout/text/react-native`, `machinalayout/text/vue`).

`machinalayout/react-native` and `machinalayout/text/react-native` require the `react-native` peer dependency in your app, and `machinalayout/vue` / `machinalayout/text/vue` require the `vue` peer dependency in your app. Root imports remain valid for compatibility during `0.x`.

## Unified adapter usage pattern

```ts
import { resolveLayoutRows, type LayoutRow } from "machinalayout";

const rows: LayoutRow[] = [
  { id: "root", frame: { kind: "root" } },
  {
    id: "sidebar",
    parent: "root",
    frame: { kind: "anchor", left: 0, top: 0, bottom: 0, width: 240 },
    view: "Sidebar",
  },
];

const layout = resolveLayoutRows(rows, { x: 0, y: 0, width: 1200, height: 800 });
```

```tsx
import { MachinaReactView } from "machinalayout/react";
const views = { Sidebar };
<MachinaReactView layout={layout} views={views} />;
```

```tsx
import { MachinaReactNativeView } from "machinalayout/react-native";
const views = { Sidebar };
<MachinaReactNativeView layout={layout} views={views} />;
```

```vue
<script setup lang="ts">
import { MachinaVueView } from "machinalayout/vue";
const views = { Sidebar };
</script>

<template>
  <MachinaVueView :layout="layout" :views="views" />
</template>
```

Keep `views` stable (component references), and send changing data through `viewData` / `nodeData`:

```tsx
const views = { Inspector };

<MachinaReactView
  layout={layout}
  views={views}
  viewData={{ Inspector: inspectorData }}
/>;
```

```tsx
const views = {
  Inspector: () => <Inspector value={value} />,
};
```

## Public API index

### Core authoring/types

- `LayoutRow`
- `FrameSpec`
- `ArrangeSpec`
- `UiLength`
- `OffsetSpec`

### Frames

- `RootFrame`
- `AbsoluteFrame`
- `AnchorFrame`
- `GuideFrame`
- `FixedFrame`
- `FillFrame`
- `CellFrame`

### Arrangers

- `StackArrange`
- `GridArrange`

### Core functions

- `compileLayoutRows`
- `selectLayoutRowsForRoot`
- `resolveLayoutRows`
- `resolveLayoutDocument`
- `resolveFrame`
- `lerpResolvedLayouts`

### Resolved helpers

- `toResolvedTree`
- `flattenResolvedTree`
- `formatRect`

### React

- `MachinaReactView`
- `MachinaReactViewProps`
- `MachinaSlotProps`
- `MachinaRenderLayer`

### Text

- `parseMachinaText`
- `MachinaTextView`
- `MachinaTextSpec`
- `MachinaTextDocument`

### Error

- `MachinaLayoutError`
- `MachinaLayoutErrorCode`

## Sample demos

- [`samples/control-room`](samples/control-room/README.md)
- [`samples/music-player`](samples/music-player/README.md)
- [`samples/dispatch-counter`](samples/dispatch-counter/README.md)
- [`samples/codex-product-page`](samples/codex-product-page/README.md)
- [`apps/machina-canvas`](apps/machina-canvas/README.md) demonstrates using MachinaLayout.JS to build an LLM-friendly 2D scene editor.

Run it locally:

```bash
cd samples/control-room
npm install
npm run dev
```

## Formatting

This repo uses Biome.

- `npm run format` rewrites files.
- `npm run format:check` checks formatting.
- `npm run lint` runs Biome lint rules.
- Generated `dist/` is ignored by Biome.

## Documentation

- [Machina authoring](docs/machina-authoring.md)
- [MachinaCanvas export format](docs/machina-canvas-export-format.md) documents
  the `.mcanvas` JSON/TOML/rendered artifact split and the
  [`demo-poster.mcanvas`](apps/machina-canvas/fixtures/demo-poster.mcanvas)
  fixture bundle.

### Milestones and audits

- [M0 contract](docs/m0-contract.md)
- [M1/M2 MachinaText plan notes](docs/machina-text-m2a-plan.md)
- [M2z npm prepublish audit](docs/npm-prepublish-m2z-audit.md)
- [M3c npm cleanup audit](docs/npm-prepublish-m3c-cleanup.md)
- [M4 interpolation guide](docs/layout-interpolation.md)
- [M5a GridArrange design contract](docs/grid-arrange-m5a-contract.md)
- [M7a reference alignment design contract](docs/reference-alignment-m7a-contract.md)
- [M8 API coherence audit](docs/api-coherence-m8-audit.md)
- [A0 adapter packaging plan](docs/adapter-packaging-a0-plan.md)

### Core layout model

- [Row model](docs/row-model.md)
- [Frames and stack](docs/frames-and-stack.md)
- [Grid arrange runtime guide](docs/grid-arrange.md)
- [Reference alignment runtime guide](docs/reference-alignment.md)
- [Responsive variants](docs/responsive-variants.md)
- [Named layers](docs/named-layers.md)
- [Layout interpolation](docs/layout-interpolation.md)

### Adapters and text

- [Adapter overview](docs/adapters.md)
- [React adapter boundary](docs/react-adapter.md)
- [React Native adapter](docs/react-native-adapter.md)
- [Vue adapter](docs/vue-adapter.md)
- [A0 adapter packaging plan](docs/adapter-packaging-a0-plan.md)
- [MachinaText parser](docs/machina-text-parser.md)
- [MachinaText React renderer](docs/machina-text-react.md)
- [MachinaText React Native renderer](docs/react-native-text-renderer.md)
- [MachinaText Vue renderer](docs/vue-text-renderer.md)

### Boundaries and diagnostics

- [Forbidden concepts](docs/forbidden-concepts.md)
- [Z-order and containment](docs/z-order-and-containment.md)
- [Error code reference](docs/error-codes.md)
- [Exhaustive enum matching](docs/exhaustive-match.md)
- [MachinaDispatch runtime guide](docs/machina-dispatch.md)
- [DeusMachina behavioral kernel and framework bindings](docs/deusmachina.md)
- Dispatch sample: [`samples/dispatch-counter`](samples/dispatch-counter/README.md) (uses `machinalayout/dispatch`)

