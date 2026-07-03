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
