# MachinaLayout

MachinaLayout is a framework-independent, machine-native layout system that resolves flat typed layout records into deterministic rectangles.

## Core principles

- **Layout is data.**
- **Rendering is an adapter.**
- **Nesting is an output shape, not an authoring strategy.**
- **MachinaLayout controls outer rectangles; host frameworks control slot internals.**

## What problem it solves

MachinaLayout keeps geometry explicit and local:

- avoids vague CSS negotiation,
- makes numeric layout edits predictable,
- gives humans and LLMs a table/record-shaped layout format.

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
    slot: "header",
  },
  {
    id: "sidebar",
    parent: "root",
    order: 1,
    frame: { kind: "anchor", left: 0, top: 64, bottom: 0, width: 240 },
    slot: "sidebar",
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
    slot: "toolbarButton",
  },
];

const rootRect: Rect = { x: 0, y: 0, width: 1024, height: 640 };
const resolved = resolveLayoutRows(rows, rootRect);
```

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
  return <MachinaReactView layout={resolved} views={views} />;
}
```

## Sample demo

See [`samples/control-room`](samples/control-room/README.md).

Run it locally:

```bash
cd samples/control-room
npm install
npm run dev
```

## M0 scope (current)

M0 supports:

- `RootFrame` (M1a)
- `AbsoluteFrame`
- `AnchorFrame`
- `FixedFrame`
- `StackArrange`
- bounded sibling-local z metadata
- React adapter

M0 does **not** support:

- FlowBox
- wrapping
- weights
- intrinsic sizing
- text measurement
- routing
- state management
- CSS layout authority for Machina rectangles

## Documentation

- [M0 contract](docs/m0-contract.md)
- [Row model](docs/row-model.md)
- [Frames and stack](docs/frames-and-stack.md)
- [React adapter boundary](docs/react-adapter.md)
- [Z-order and containment](docs/z-order-and-containment.md)
- [Forbidden concepts](docs/forbidden-concepts.md)
