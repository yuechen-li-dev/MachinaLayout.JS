# Machina authoring

Machina authoring is the official human- and LLM-facing authoring surface for MachinaLayout:

```ts
import { M } from "machinalayout/machina";
```

Rows remain the MIR. Machina authoring is optional and lowers deterministically to normal `LayoutRow[]` records through `node.rows()` or `M.rows(node)`.

## What it is not

Machina authoring is not a new resolver, renderer, JSX dialect, routing system, state manager, or compiler plugin. It does not change adapter behavior or the existing row model.

## Root and stack example

```ts
const layout = M.root("app", { arrange: M.stackArrange("vertical", { gap: 0 }) }, [
  M.fixed("header", 64, "Header"),
  M.hstack("content", { gap: 16, padding: 16 }, [
    M.fixed("sidebar", 280, {
      view: "Sidebar",
      arrange: M.stackArrange("vertical", { gap: 8 }),
    }),
    M.fill("main", 1, "Main"),
  ]),
  M.fixed("footer", 48, "Footer"),
]);

const rows = layout.rows();
```

## Parent injection

Children composed inside `M.root`, `M.node`, `M.vstack`, `M.hstack`, or `M.anchor` receive their parent id during lowering. You usually omit `parent`; the authoring tree supplies it. `M.node` and `M.anchor` still preserve an explicit `parent` when provided as an escape hatch.

## Axis-aware fixed sizing

`M.fixed(id, mainSize)` is a stack-child helper. In a vertical stack it lowers to a fixed height. In a horizontal stack it lowers to a fixed width. It does not set both width and height, so the stack axis resolves the main dimension.

`M.fill(id, weight)` lowers to a fill frame and may be authored outside a stack; the existing MIR resolver remains responsible for final semantic validation.

`M.space(id, weight)` is deterministic spacer sugar over a fill frame. It always requires an explicit id and never generates random ids.

## Anchor example

```ts
const panel = M.anchor("panel", {
  left: M.px(16),
  top: M.px(16),
  width: M.ui(0.5),
  height: 240,
  view: "Panel",
});
```

Anchor authoring emits the existing anchor frame. Full anchor geometry validity remains part of the existing resolver semantics.

## Unit helpers

`M.px(value)` and `M.ui(value)` create explicit `UiLength` objects and validate finite numbers. Bare numbers are still accepted by the MIR as pixel lengths.

## Variant helper

```ts
const responsive = M.when({ minWidth: 900 }, { view: "WidePanel" });
```

`M.when` returns a normal `LayoutRowVariant` and only validates that provided condition numbers are finite.

## Escape hatch

`M.node(id, options, children)` accepts normal row-shaped options and is the MIR escape hatch for authoring cases not covered by the first Machina helper slice.

## Relationship to MIR

`LayoutRow[]` remains valid and remains the deterministic model used by resolution, inspection, handoff, and adapters. Machina authoring simply produces rows with `node.rows()` or `M.rows(node)`.

## Deferred helpers

M28a intentionally does not add grid matrix helpers, guide helpers, text helpers, layer helpers, screen helpers, Deus sugar, Atlas helpers, JSX, TSX, code generation, routing, or state management.

## Grid authoring

Machina grid helpers are authoring sugar for the existing row model. `M.grid(...)` lowers to a
normal `LayoutRow` with `arrange: { kind: "grid" }`, and each authored grid child lowers to an
explicit `CellFrame` row. The MIR stays unchanged: rows remain the source of truth, grid children
still use zero-based `row` and `col`, and spans lower to explicit `rowSpan` and `colSpan` values.

### Tracks

Use `M.trackFixed(size)` for fixed tracks and `M.trackFill(weight)` for fill tracks:

```ts
const columns = [M.trackFixed(280), M.trackFill(1), M.trackFixed(360)];
const rows = [M.trackFixed(72), M.trackFill(1), M.trackFixed(52)];
```

Track sizes and weights must be finite numbers greater than or equal to zero. `M.trackFill()` uses a
weight of `1` by default.

### Matrix authoring

`M.gridRows(...)` accepts a row-major matrix of `M.area(...)` and `M.skip(...)` items. Areas are
placed at the next available column in the current matrix row and lower to explicit `M.cell(...)`
children of the grid.

```ts
const dashboard = M.grid(
  "dashboard-grid",
  {
    columns: [M.trackFixed(280), M.trackFill(1), M.trackFixed(360)],
    rows: [M.trackFixed(72), M.trackFill(1), M.trackFixed(52)],
    columnGap: 16,
    rowGap: 16,
    padding: 16,
  },
  M.gridRows([
    [M.area("topbar", { colSpan: 3, view: "Topbar" })],
    [
      M.area("nav", { view: "Nav" }),
      M.area("main", { view: "Main" }),
      M.area("inspector", { view: "Inspector" }),
    ],
    [M.area("footer", { colSpan: 3, view: "Footer" })],
  ]),
);
```

Placement is deterministic:

- the outer array index is the zero-based grid row;
- each inner row scans left to right;
- `colSpan` and `rowSpan` reserve occupied cells;
- a `rowSpan` from an earlier matrix row reserves cells in later rows;
- `M.skip(span)` reserves explicit empty slots and emits no row;
- matrix rows may be empty, and unoccupied cells are allowed;
- no implicit tracks are created, so areas and skips must fit inside declared `columns` and `rows`.

### Shell example

```ts
const shell = M.grid(
  "shell",
  {
    columns: [M.trackFixed(240), M.trackFill(1)],
    rows: [M.trackFixed(64), M.trackFill(1), M.trackFixed(48)],
  },
  M.gridRows([
    [M.area("header", { colSpan: 2, view: "Header" })],
    [M.area("sidebar", { view: "Sidebar" }), M.area("main", { view: "Main" })],
    [M.area("footer", { colSpan: 2, view: "Footer" })],
  ]),
);
```

### Skip example

```ts
const spaced = M.grid(
  "spaced",
  {
    columns: [M.trackFill(1), M.trackFill(1), M.trackFill(1)],
    rows: [M.trackFixed(100)],
  },
  M.gridRows([[M.area("left", { view: "Left" }), M.skip(), M.area("right", { view: "Right" })]]),
);
```

### Explicit cell escape hatch

Use `M.cell(id, col, row, options, children)` when you want to author the existing MIR coordinates
directly instead of using a matrix. This is useful for generated layouts or cases where explicit
coordinates are clearer than row-major placement.

```ts
const explicit = M.grid(
  "layout",
  {
    columns: [M.trackFill(1), M.trackFixed(332)],
    rows: [M.trackFixed(64), M.trackFill(1)],
  },
  [
    M.cell("header", 0, 0, { colSpan: 2, view: "Header" }),
    M.cell("main", 0, 1, { view: "Main" }),
    M.cell("sidebar", 1, 1, { view: "Sidebar" }),
  ],
);
```

### Non-goals

Grid authoring is not CSS Grid. It does not add named template areas, named lines, subgrid, masonry,
implicit rows or columns, or adapter-specific behavior. Raw grid/cell MIR remains available through
regular rows; `machinalayout/machina` only provides matrix-shaped authoring sugar that lowers to that
same MIR.
