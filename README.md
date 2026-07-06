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
- Text utilities: `machinalayout/text`

### Text renderers

- React DOM: `machinalayout/text/react`
- React Native: `machinalayout/text/react-native`
- Vue DOM: `machinalayout/text/vue`

Inspection and handoff utilities are available at `machinalayout/inspect` and `machinalayout/handoff`.

Typed semantic style authoring is available at `machinalayout/style`; see [MachinaStyle](docs/machina-style.md).

Static no-JS lowering for tabs, accordions, timelines, finite dispatch machines, and native GET/POST HTTP forms is available at `machinalayout/static`; see [Machina Static](docs/machina-static.md).

Explicit capture records for visible-env closure-like authoring are available at `machinalayout/capture`; see [Explicit capture](docs/explicit-capture.md).

Deus-backed explicit async task lifecycles are available at `machinalayout/async`, including `A.run` for result-only runs and `A.runSnapshot` for one-shot result plus lifecycle receipts; see [Deus async tasks](docs/deus-async-tasks.md).

Promise-backed ordered async batch mapping with explicit concurrency, cancellation, board, and trace is available at `machinalayout/batch`; see [Batch concurrency](docs/batch-concurrency.md).

Explicit iterator machines with visible cursor, board, and trace are available at `machinalayout/iter`; see [Explicit iterators](docs/explicit-iterators.md).

Named capability constraints and template records are available at `machinalayout/concept`; see [Machina Concepts](docs/machina-concepts.md).

Shared diagnostic helpers for authoring, collecting, sorting, grouping, formatting, and adapting subsystem diagnostics are available at `machinalayout/diagnostics`; see [Machina Diagnostics](docs/machina-diagnostics.md).

Dependency-free columnar table records, row/object adapters, and cell-oriented diagnostics are available at `machinalayout/table`; see [MachinaTable](docs/machina-tables.md).

Compile-time helper utilities are available at `machinalayout/comptime`; see [Compile-time helpers](docs/compile-time-helpers.md).

Dependency-free text utilities, including `leftPad`, are available at `machinalayout/text`; see [Text utilities](docs/text-utilities.md).

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
- [MachinaStyle](docs/machina-style.md) — typed style records that lower to deterministic CSS.
- [Machina Static](docs/machina-static.md) — finite UI machines, timelines, and native HTTP forms lowered to no-JS HTML/CSS.
- [Exhaustive match helpers](docs/exhaustive-match.md)
- [Explicit capture](docs/explicit-capture.md) — visible-env closure-like tasks for inspectable authoring.
- [Deus async tasks](docs/deus-async-tasks.md) — explicit Promise-backed task lifecycles with visible status, cancellation, and trace.
- [Batch concurrency](docs/batch-concurrency.md) — ordered async batch mapping with explicit concurrency, fail-fast semantics, cancellation, board, and trace.
- [Explicit iterators](docs/explicit-iterators.md) — generator-like iteration with visible cursor, board, and trace.
- [Machina Concepts](docs/machina-concepts.md) — named capability constraints and template records.
- [Machina Diagnostics](docs/machina-diagnostics.md) — shared diagnostic data helpers for combining subsystem and caller policy reports.
- [MachinaTable](docs/machina-tables.md) — columnar table records with row/object adapters and cell-oriented diagnostics.
- [Compile-time helpers](docs/compile-time-helpers.md) — compile-time assertions, literal helpers, and narrow type utilities.
- [Text utilities](docs/text-utilities.md) — tiny deterministic helpers for padding, truncation, casing, and slugs.
- [Machina toolkit dogfood report](docs/machina-toolkit-dogfood-report.md) — honest notes from using the new M34 utility subpaths together in one backend-style sample.
- [Local sample subpath imports](docs/local-sample-subpath-imports.md) — standard local harness for nested samples that dogfood `machinalayout/*` subpaths before publish.

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

MachinaStyle is available from `machinalayout/style` for typed semantic style records and deterministic CSS serialization.

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
- [`samples/style-dogfood`](samples/style-dogfood/README.md) demonstrates `machinalayout/style` lowering from `style.ts` to checked-in CSS.
- [`samples/toolkit-pipeline`](samples/toolkit-pipeline) demonstrates `machinalayout/match`, `capture`, `async`, `batch`, `iter`, `concept`, `diagnostics`, and `comptime` together in a backend-style order pipeline with checked-in report artifacts and the shared local sample subpath import harness.
- [`samples/static-tabs`](samples/static-tabs) demonstrates `machinalayout/static` lowering tabs to checked-in HTML/CSS with no JS.
- [`samples/static-accordion`](samples/static-accordion) demonstrates `machinalayout/static` lowering accordion disclosure state to checked-in HTML/CSS with no JS.
- [`samples/static-timeline`](samples/static-timeline) demonstrates `machinalayout/static` lowering a timeline stepper to checked-in animated HTML/CSS with no JS.
- [`samples/static-dispatch`](samples/static-dispatch) demonstrates `machinalayout/static` lowering a finite dispatch table to checked-in HTML/CSS with no JS.
- [`samples/static-http`](samples/static-http) demonstrates `machinalayout/static` lowering native GET/POST HTTP intent to checked-in HTML/CSS with no JS.
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
- [Machina Static](docs/machina-static.md)
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
- [Exhaustive match helpers](docs/exhaustive-match.md)
- [MachinaDispatch runtime guide](docs/machina-dispatch.md)
- [DeusMachina behavioral kernel and framework bindings](docs/deusmachina.md)
- Dispatch sample: [`samples/dispatch-counter`](samples/dispatch-counter/README.md) (uses `machinalayout/dispatch`)

