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

### React

- `MachinaReactView`
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
import { MachinaReactView, resolveLayoutRows } from "machinalayout";

const resolved = resolveLayoutRows(rows, rootRect);

const views = {
  header: HeaderView,
  sidebar: SidebarView,
  toolbarButton: ToolbarButtonView,
};

export function App() {
  return <MachinaReactView layout={resolved} views={views} viewData={{ sidebar: { collapsed: false } }} />;
}
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

## Sample demo

See [`samples/control-room`](samples/control-room/README.md).

Run it locally:

```bash
cd samples/control-room
npm install
npm run dev
```

## Documentation

### Milestones and audits

- [M0 contract](docs/m0-contract.md)
- [M1/M2 MachinaText plan notes](docs/machina-text-m2a-plan.md)
- [M2z npm prepublish audit](docs/npm-prepublish-m2z-audit.md)
- [M3c npm cleanup audit](docs/npm-prepublish-m3c-cleanup.md)
- [M4 interpolation guide](docs/layout-interpolation.md)
- [M5a GridArrange design contract](docs/grid-arrange-m5a-contract.md)
- [M7a reference alignment design contract](docs/reference-alignment-m7a-contract.md)
- [M8 API coherence audit](docs/api-coherence-m8-audit.md)

### Core layout model

- [Row model](docs/row-model.md)
- [Frames and stack](docs/frames-and-stack.md)
- [Grid arrange runtime guide](docs/grid-arrange.md)
- [Reference alignment runtime guide](docs/reference-alignment.md)
- [Responsive variants](docs/responsive-variants.md)
- [Named layers](docs/named-layers.md)
- [Layout interpolation](docs/layout-interpolation.md)

### Adapters and text

- [React adapter boundary](docs/react-adapter.md)
- [MachinaText parser](docs/machina-text-parser.md)
- [MachinaText React renderer](docs/machina-text-react.md)

### Boundaries and diagnostics

- [Forbidden concepts](docs/forbidden-concepts.md)
- [Z-order and containment](docs/z-order-and-containment.md)
- [Error code reference](docs/error-codes.md)
