# MachinaLayout.JS Authoring Layer Design

Status: design contract for the 0.4 authoring surface.

Slogan:

```txt
Rows are the MIR.
M is the authoring language.
```

Or, less grandly:

```txt
Keep the MIR. Add the authoring surface.
```

## 1. Problem

MachinaLayout.JS currently has a strong intermediate representation:

```ts
LayoutRow[]
LayoutDocument
ResolvedLayoutDocument
```

That representation is excellent for deterministic resolution, testing, inspection, handoff, and framework adapters.

But it is not the ideal authoring surface.

Writing raw `LayoutRow[]` directly exposes too much bookkeeping:

```ts
parent: "..."
frame: ...
arrange: ...
children implied by parent ids
```

This is fine as an internal representation, but app authors want to write composition:

```ts
root
  header
  content
    sidebar
    main
  footer
```

without manually maintaining every parent relationship.

The 0.4 authoring layer provides a small TypeScript API that lowers to the existing MIR.

It is not a new resolver.
It is not a new renderer.
It is not a framework.
It is not a compiler plugin.
It is not JSX.

It is plain TypeScript function sugar.

## 2. Design principles

### 2.1 The MIR is unchanged

The existing core stays authoritative:

```ts
LayoutRow[]
LayoutDocument
ResolvedLayoutDocument
```

The authoring layer only produces `LayoutRow[]`.

The resolver, React adapter, React Native adapter, Vue adapter, text system, dispatch system, DeusMachina, inspection helpers, and handoff helpers do not need semantic changes.

### 2.2 Authoring is a frontend lowering pass

Author writes:

```ts
M.root("app", {}, [
  M.fixed("header", 64, "Header"),
  M.fill("body", 1, "Body"),
]);
```

The authoring layer lowers to:

```ts
[
  {
    id: "app",
    frame: { kind: "root" },
  },
  {
    id: "header",
    parent: "app",
    frame: { kind: "fixed", height: 64 },
    view: "Header",
  },
  {
    id: "body",
    parent: "app",
    frame: { kind: "fill", weight: 1 },
    view: "Body",
  },
]
```

The important thing: parent assignment is automatic during lowering.

### 2.3 The authoring layer must be deterministic

No random IDs.

No `Math.random()`.

No hidden global counters unless they are deterministic within a lowering context and documented.

Preferred rule:

```ts
M.space("nav-spacer", 1)
```

not:

```ts
M.space()
```

Anonymous layout nodes are convenient, but they are hostile to tests, screenshots, handoff bundles, DOM summaries, and LLM debugging.

### 2.4 Escape hatches remain available

Every authoring helper lowers to normal MIR concepts.

If a helper is too high-level for a case, authors can still use:

```ts
M.node("custom", {
  frame: ...,
  arrange: ...,
  variants: ...,
});
```

The authoring surface should make the common path pleasant, not hide the underlying model.

### 2.5 The authoring layer is optional

Existing raw `LayoutRow[]` authoring remains valid.

Small apps can keep using rows directly.

The authoring layer exists for larger screens and shells where composition is easier to read than flat row tables.

## 3. Package surface

Add a new subpath:

```ts
import { M } from "machinalayout/machina";
```

Also export named helpers:

```ts
import {
  root,
  vstack,
  hstack,
  fixed,
  fill,
  anchor,
} from "machinalayout/machina";
```

Do not put authoring helpers in the root package initially.

The root package remains the core MIR/resolver surface.

## 4. Core type: MachinaNode

The universal authoring value is `MachinaNode`.

```ts
export type MachinaNodeId = string;

export type MachinaLowerContext = {
  parentId?: string;
  parentStackAxis?: "vertical" | "horizontal";
};

export interface MachinaNode {
  readonly id: MachinaNodeId;
  lower(context?: MachinaLowerContext): LayoutRow[];
}
```

A node is not a rendered component.

A node is not a runtime view.

A node is an authoring object that can emit MIR rows.

## 5. Parent injection

Children should not usually specify `parent`.

Authoring:

```ts
const layout = M.root("app", {}, [
  M.fixed("header", 64, "Header"),
  M.fill("body", 1, "Body"),
]);
```

Lowered rows:

```ts
[
  {
    id: "app",
    frame: { kind: "root" },
  },
  {
    id: "header",
    parent: "app",
    frame: { kind: "fixed", height: 64 },
    view: "Header",
  },
  {
    id: "body",
    parent: "app",
    frame: { kind: "fill", weight: 1 },
    view: "Body",
  },
]
```

This is the core reason the authoring layer exists.

The authoring layer owns default parent-child wiring.

Escape hatch:

```ts
M.node("floating-tooltip", {
  parent: "overlay-root",
  frame: ...,
});
```

If a child explicitly supplies `parent`, the lowering layer may either preserve it or reject it depending on strictness mode.

Recommended default:

```txt
Composed child parent is inferred.
Explicit parent inside composed children is allowed only through M.node escape hatch.
```

## 6. Core helpers

### 6.1 `M.node`

Lowest-level escape hatch.

```ts
M.node("raw-card", {
  frame: {
    kind: "anchor",
    left: 24,
    top: 24,
    width: 320,
    height: 180,
  },
  view: "Card",
});
```

Signature shape:

```ts
export type NodeOptions = Omit<LayoutRow, "id" | "parent"> & {
  parent?: MachinaNodeId;
};

export function node(
  id: MachinaNodeId,
  options: NodeOptions,
  children?: readonly MachinaNode[],
): MachinaNode;
```

### 6.2 `M.root`

Creates a root frame.

```ts
const layout = M.root("app", {
  arrange: M.stackArrange("vertical", { gap: 0 }),
}, [
  M.fixed("header", 64, "Header"),
  M.fill("body", 1, "Body"),
]);
```

Root always lowers to:

```ts
frame: { kind: "root" }
```

## 7. Stack authoring

Stacks are the primary authoring win.

### 7.1 Stack arrange helper

```ts
M.stackArrange("vertical", {
  gap: 12,
  padding: 16,
});
```

### 7.2 Vertical and horizontal stacks

```ts
M.vstack("shell", { gap: 0 }, [
  M.fixed("topbar", 64, "Topbar"),
  M.fill("content", 1, "Content"),
  M.fixed("footer", 48, "Footer"),
]);
```

```ts
M.hstack("content", { gap: 16, padding: 16 }, [
  M.fixed("sidebar", 280, "Sidebar"),
  M.fill("main", 1, "Main"),
  M.fixed("inspector", 340, "Inspector"),
]);
```

### 7.3 Axis-aware `fixed`

`M.fixed` is a stack-child helper.

It should lower differently depending on parent stack axis.

Inside vertical stack:

```ts
M.fixed("header", 64, "Header")
```

lowers to:

```ts
frame: { kind: "fixed", height: 64 }
```

Inside horizontal stack:

```ts
M.fixed("sidebar", 280, "Sidebar")
```

lowers to:

```ts
frame: { kind: "fixed", width: 280 }
```

The authoring layer must not rely on setting both width and height to the same value and hoping the resolver reads only one axis.

That is MIR leakage.

The authoring layer should use lowering context to know the parent stack axis.

### 7.4 Fill children

```ts
M.fill("main", 1, "Main")
```

lowers to:

```ts
frame: { kind: "fill", weight: 1 }
```

### 7.5 Space

Space must be deterministic.

Good:

```ts
M.space("main-spacer", 1)
```

Bad:

```ts
M.space()
```

No random IDs.

## 8. Anchor authoring

Anchor wraps `AnchorFrame`.

```ts
M.anchor("hero", {
  left: 24,
  top: 24,
  right: 24,
  height: 320,
  view: "Hero",
});
```

Proportional lengths:

```ts
M.anchor("sidebar", {
  left: 0,
  top: 0,
  bottom: 0,
  width: M.ui(0.3),
  view: "Sidebar",
});
```

Unit helpers:

```ts
M.px(24)
M.ui(0.3)
```

Bare numbers still mean pixels.

## 9. Grid authoring

Grid should look more like a 2D matrix because that is what it is.

The MIR still uses explicit `CellFrame` rows.

The authoring surface can provide a matrix-shaped helper that lowers to explicit cell rows.

### 9.1 Tracks

```ts
const columns = [
  M.trackFill(1),
  M.trackFixed(332),
];

const rows = [
  M.trackFixed(64),
  M.trackFill(1),
  M.trackFixed(48),
];
```

### 9.2 Matrix-style grid

Preferred authoring shape:

```ts
const layout = M.grid("app-grid", {
  columns: [
    M.trackFill(1),
    M.trackFixed(332),
  ],
  rows: [
    M.trackFixed(64),
    M.trackFill(1),
    M.trackFixed(48),
  ],
  columnGap: 24,
  rowGap: 0,
  padding: 16,
}, M.gridRows([
  [
    M.area("header", { colSpan: 2, view: "Header" }),
  ],
  [
    M.area("main", { view: "Main" }),
    M.area("sidebar", { view: "Sidebar" }),
  ],
  [
    M.area("footer", { colSpan: 2, view: "Footer" }),
  ],
]));
```

This lowers to cells:

```ts
[
  {
    id: "header",
    frame: { kind: "cell", col: 0, row: 0, colSpan: 2 },
    view: "Header",
  },
  {
    id: "main",
    frame: { kind: "cell", col: 0, row: 1 },
    view: "Main",
  },
  {
    id: "sidebar",
    frame: { kind: "cell", col: 1, row: 1 },
    view: "Sidebar",
  },
  {
    id: "footer",
    frame: { kind: "cell", col: 0, row: 2, colSpan: 2 },
    view: "Footer",
  },
]
```

### 9.3 Why `area` instead of `cell`

The raw MIR concept is a cell.

The matrix authoring concept is an area placed at the next matrix slot.

Use:

```ts
M.area(...)
```

inside `M.gridRows(...)`.

Use:

```ts
M.cell(...)
```

as the explicit escape hatch.

### 9.4 Explicit cell escape hatch

For unusual layouts, authors can still write:

```ts
M.cell("inspector", 1, 2, {
  rowSpan: 2,
  view: "Inspector",
});
```

### 9.5 Matrix lowering rules

For `M.gridRows([...])`:

* outer array index is row.
* inner array is scanned left to right.
* each `M.area` is placed at the next available column.
* `colSpan` and `rowSpan` reserve occupied cells.
* spans must not overlap existing occupied cells.
* spans must not exceed grid bounds.
* empty slots can be skipped explicitly.

Skip helper:

```ts
M.skip()
```

Example:

```ts
M.gridRows([
  [
    M.area("left", { view: "Left" }),
    M.skip(),
    M.area("right", { view: "Right" }),
  ],
]);
```

`M.skip()` advances the matrix cursor by one column.

### 9.6 Matrix grid example with spans

```ts
const dashboard = M.grid("dashboard-grid", {
  columns: [
    M.trackFixed(280),
    M.trackFill(1),
    M.trackFixed(360),
  ],
  rows: [
    M.trackFixed(72),
    M.trackFill(1),
    M.trackFixed(52),
  ],
  columnGap: 16,
  rowGap: 16,
  padding: 16,
}, M.gridRows([
  [
    M.area("topbar", { colSpan: 3, view: "Topbar" }),
  ],
  [
    M.area("nav", { view: "Nav" }),
    M.area("main", { view: "Main" }),
    M.area("inspector", { view: "Inspector" }),
  ],
  [
    M.area("footer", { colSpan: 3, view: "Footer" }),
  ],
]));
```

This preserves the 2D shape of the UI in source.

## 10. Guide authoring

Guide wraps `GuideFrame`.

```ts
M.guide("dropdown", {
  left: M.edge("trigger", "left"),
  right: M.edge("trigger", "right"),
  top: M.edge("trigger", "bottom", 4),
  height: 240,
  view: "Dropdown",
  z: 10,
});
```

Helper:

```ts
M.edge("trigger", "bottom", 4)
```

lowers to:

```ts
{ ref: "trigger", edge: "bottom", offset: 4 }
```

## 11. Variants

Variant sugar wraps existing `LayoutRowVariant`.

```ts
M.when({ maxWidth: 768 }, {
  frame: {
    kind: "anchor",
    left: 0,
    top: 0,
    right: 0,
    height: 56,
  },
});
```

Variants remain row-level overrides.

No new responsive system.

## 12. Text helper

Text sugar wraps existing `MachinaTextSpec`.

```ts
M.text("Hello **world**", {
  variant: "body",
  wrap: "word",
});
```

Plain text:

```ts
M.text.plain("Just plain text", {
  variant: "label",
});
```

Mono:

```ts
M.text.mono("const x = 1;", {
  overflow: "scroll",
});
```

This does not change MachinaText parsing or rendering.

## 13. Layers

Layer helpers are just typed readability helpers.

```ts
const layers = M.defineLayers({
  base: { z: 0 },
  overlay: { z: 10 },
  tooltip: { z: 20 },
});

M.anchor("modal", {
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
  layer: M.onLayer("overlay"),
  view: "Modal",
});
```

## 14. Screen helper

Screen helper can wrap the existing screen catalog API.

```ts
const providerSetup = M.screen("provider-setup", {
  route: "/apps/scheduling/setup",
  fixture: "provider-setup",
  tags: ["scheduling", "setup"],
  layout: (viewport) =>
    M.root("provider-setup-root", {}, [
      M.fixed("header", 72, "Header"),
      M.fill("body", 1, "SetupBody"),
    ]).rows(),
});
```

This is optional sugar.

It should not become routing.

## 15. DeusMachina sugar

DeusMachina already has a good row-first API.

Any authoring sugar should remain thin.

Example:

```ts
const machine = M.machine<Board, Event>({
  initial: ["idle"],
  states: [
    M.state(["idle"]),
    M.state(["dragging"], {
      onEnter: (b) => {
        b.captured = true;
      },
      onExit: (b) => {
        b.captured = false;
      },
    }),
  ],
  transitions: [
    M.on("thumb:press", ["idle"], ["dragging"], (b, e) => {
      b.startY = e.y;
    }),
    M.on("pointer:move", ["dragging"], ["dragging"], (b, e) => {
      b.offset = computeOffset(b, e);
    }),
    M.on("pointer:up", ["dragging"], ["idle"]),
  ],
});
```

Utility scoring stays opt-in:

```ts
M.choose("tick", ["decide"], [
  {
    key: "heat",
    to: ["apply"],
    when: (b) => b.tempK < 292.15,
    score: 90,
    do: (b) => {
      b.mode = "heat";
    },
  },
  {
    key: "idle",
    to: ["apply"],
    score: 0,
    do: (b) => {
      b.mode = "idle";
    },
  },
]);
```

This is not part of the first authoring-layer milestone unless needed.

## 16. `M` namespace

The authoring layer should provide a single namespace for convenient usage:

```ts
import { M } from "machinalayout/authoring";
```

Example:

```ts
const layout = M.root("app", {}, [
  M.fixed("header", 64, "Header"),

  M.hstack("content", { gap: 16, padding: 16 }, [
    M.fixed("sidebar", 280, {
      arrange: M.stackArrange("vertical", { gap: 8 }),
      view: "Sidebar",
    }),

    M.fill("main", 1, "Main"),

    M.anchor("inspector", {
      right: 0,
      top: 0,
      bottom: 0,
      width: M.ui(0.3),
      view: "Inspector",
      variants: [
        M.when({ maxWidth: 1024 }, {
          frame: {
            kind: "anchor",
            width: 0,
            height: 0,
          },
        }),
      ],
    }),
  ]),

  M.fixed("footer", 48, "Footer"),
]);

const rows = layout.rows();
```

Named exports should also exist for tree-shaking and direct usage.

## 17. Validation

The authoring layer should validate authoring mistakes early when practical.

Recommended validation:

* node ids are non-empty strings.
* duplicate ids are rejected during lowering.
* root has no parent.
* non-root child receives parent during lowering.
* stack child helpers are used under stacks.
* `fixed()` outside stack is rejected unless an explicit non-stack fixed box helper exists.
* grid matrix spans cannot overlap.
* grid matrix spans cannot exceed bounds.
* `space()` requires deterministic id.
* invalid tracks are rejected.
* invalid lengths are rejected if easy.
* variants are passed through but basic shape can be checked.

Use authoring-specific errors:

```ts
MachinaAuthoringError
```

Do not add these to `MachinaLayoutErrorCode`.

## 18. Error namespace

Add:

```ts
export class MachinaAuthoringError extends Error {
  code: MachinaAuthoringErrorCode;
}
```

Suggested codes:

```ts
type MachinaAuthoringErrorCode =
  | "InvalidNodeId"
  | "DuplicateNodeId"
  | "InvalidAuthoringTree"
  | "InvalidStackChild"
  | "InvalidGridMatrix"
  | "GridMatrixOverlap"
  | "GridMatrixOutOfBounds"
  | "UnknownAuthoringNode";
```

Keep this separate from core layout errors.

The authoring layer catches authoring mistakes before MIR resolution.

The core resolver still catches MIR semantic errors.

## 19. Relationship to existing systems

### Layout core

Authoring lowers to `LayoutRow[]`.

### Adapters

Adapters continue to consume resolved layouts.

No adapter changes required.

### MachinaText

Text helpers create `MachinaTextSpec`.

No text parser changes.

### Screen catalog

Screen helper can wrap `MachinaScreen`.

No screen catalog semantic changes.

### DeusMachina

Machine helpers can wrap existing Deus row APIs.

No kernel changes.

### MachinaAtlas

Atlas remains the app/source composition map.

Authoring layer can be referenced from Atlas sections, but Atlas does not depend on authoring.

## 20. First implementation milestone recommendation

Do not implement every helper at once.

Start with:

```txt
M28a — Authoring core and stack/anchor sugar
```

Scope:

```txt
machinalayout/authoring
M.node
M.root
M.vstack
M.hstack
M.stackArrange
M.fixed
M.fill
M.space
M.anchor
M.px
M.ui
M.when
M.rows / node.rows()
M namespace
authoring errors
docs/tests
```

Defer:

```txt
M28b grid matrix helpers
M28c guide/text/layer/screen helpers
M28d Deus/Atlas convenience sugar, if still needed
```

But the grid matrix shape should be kept in the design now so the authoring model does not paint itself into a corner.

## 21. Non-goals

The authoring layer does not:

* change the MIR
* replace `LayoutRow[]`
* change resolver behavior
* change adapter behavior
* require JSX
* require a Babel/SWC/TypeScript transform
* manage state
* manage reactivity
* implement routing
* generate files
* hide escape hatches
* introduce random IDs
* require a new package

## 22. Final design note

MachinaLayout.JS 0.4 should acknowledge the split:

```txt
LayoutRow[] is the MIR.
M.* is the authoring surface.
```

That is not a failure.

That is a compiler-shaped architecture.

The important thing is that the compiler is just boring TypeScript functions lowering to deterministic rows, not a hidden build tool wearing a funny hat.
