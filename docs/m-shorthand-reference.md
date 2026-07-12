# `M.*` shorthand reference

`M` is exported from `machinalayout/machina`. It contains only the shorthand listed below. Use named exports from other package subpaths for tables, query plans, Dispatch, Deus runtime helpers, match helpers, style/static/form/command helpers, and framework bindings.

```ts
import { M } from "machinalayout/machina";
```

## Layout tree

| Shorthand | Purpose | Typical input | Output/use |
|-----------|---------|---------------|------------|
| `M.node` | Create a layout node. | node id/options | authored Machina node |
| `M.root` | Create a root node. | root id/options | document root |
| `M.rows` | Create row-authored layout records. | table-like row list | layout rows |
| `M.vstack` | Vertical stack container. | child nodes/options | stacked node |
| `M.hstack` | Horizontal stack container. | child nodes/options | stacked node |
| `M.stackArrange` | Explicit stack arrangement metadata. | direction/gap/alignment | stack options |
| `M.fixed` | Fixed track/size value. | number or size options | sizing token |
| `M.fill` | Fill available space. | optional weight/options | sizing token |
| `M.space` | Spacer node. | size/options | spacer record |
| `M.anchor` | Anchor a node to a frame/edge. | anchor options | anchored layout metadata |
| `M.px` | Pixel length. | number | length token |
| `M.ui` | UI unit length. | number | length token |
| `M.when` | Conditional/responsive variant. | condition/options | variant record |

Example:

```ts
const screen = M.root("home", [
  M.vstack("panel", [M.text("title", "Machina"), M.space(M.px(12))]),
]);
```

Common mistake: `M.fixed`, `M.fill`, `M.px`, and `M.ui` create authored records/tokens; they are not CSS strings.

Deeper docs: [Machina authoring](machina-authoring.md), [grid arrange](grid-arrange.md), [responsive variants](responsive-variants.md).

## Grid, guides, layers, and screens

| Shorthand | Purpose | Typical input | Output/use |
|-----------|---------|---------------|------------|
| `M.grid` | Create grid layout metadata. | tracks/areas/options | grid node/options |
| `M.gridRows` | Create row-authored grid records. | grid row list | grid rows |
| `M.area` | Name a grid area. | area name/placement | area record |
| `M.skip` | Placeholder for empty grid cells. | none/options | skipped cell |
| `M.cell` | Address a grid cell. | row/column/options | grid cell record |
| `M.trackFixed` | Fixed grid track. | size | track record |
| `M.trackFill` | Flexible grid track. | weight/options | track record |
| `M.edge` | Guide/reference edge. | edge options | guide edge record |
| `M.guide` | Alignment/reference guide. | guide options | guide record |
| `M.onLayer` | Attach a node to a named layer. | layer id/node | layered node metadata |
| `M.defineLayers` | Define layer ordering. | layer records | layer map |
| `M.screen` | Define a screen/viewport entry. | screen options | screen catalog record |

Example:

```ts
const layers = M.defineLayers(["background", "content", "overlay"]);
const hero = M.onLayer("content", M.node("hero", { frame: M.area("main") }));
```

Common mistake: guides/layers describe authored layout intent; use resolver APIs before expecting concrete rectangles.

Deeper docs: [named layers](named-layers.md), [reference alignment](reference-alignment.md), [screen catalogs](screen-catalog-and-viewports.md).

## Text

| Shorthand | Purpose | Typical input | Output/use |
|-----------|---------|---------------|------------|
| `M.text` | Create a Machina text node/record. | id/text/options | text layout node |

Example:

```ts
const title = M.text("title", "Ship deterministic UI records");
```

Common mistake: text parser and text renderer helpers live under `machinalayout/text*`; they are not `M.*` shorthand.

Deeper docs: [text utilities](text-utilities.md), [text parser](machina-text-parser.md).

## Deus-oriented authoring shorthand

| Shorthand | Purpose | Typical input | Output/use |
|-----------|---------|---------------|------------|
| `M.machine` | Author a machine-shaped record. | machine options | machine definition input |
| `M.state` | Declare a state path. | path/options | state row/record |
| `M.on` | Declare an event transition. | scoped `event, options` or legacy positional arguments | transition record |
| `M.scope` | Group scoped transitions with one shared from-state. | from path, `M.on` rows | authoring scope |
| `M.workflow` | Bind a workflow root plus board/event types. | root, authoring factory | workflow definition |
| `M.choose` | Declare a conditional choice. | branches/options | choice record |
| `M.goto` | Jump to a state without changing the Deus stack. | path | control target |
| `M.push` | Enter a state and save the current state. | path | control target |
| `M.pop` | Return to the most recently pushed state. | none | control target |
| `M.stay` | Keep state and stack unchanged. | none | control target |

Example:

```ts
const flow = M.machine({
  states: [M.state(["setup", "editing"]), M.state(["setup", "review"])],
  transitions: [M.on("cancel", ["setup"], ["cancelled"])],
});
```

For concise scoped transition authoring, `M.scope` groups transitions that share the same from-state and `M.on` declares a transition row inside that scope. Lower scopes with `transitionsFromScopes` from `machinalayout/deus` before passing them to `defineDeusMachine`. `M.workflow(root, factory)` binds root-relative `scope`, `goto`, and `push` helpers plus board/event types; lower it with `transitionsFromWorkflow`. Inside a workflow, strings are root-relative, arrays remain absolute, and `relative("a", "b")` expresses a multi-segment root-relative path.

Common mistake: runtime Deus helpers such as `defineDeusMachine`, `transitionDeusMachine`, `useDeusMachine`, and table bridges are exported from `machinalayout/deus`, `machinalayout/react`, or `machinalayout/vue`; they are not members of `M`.

Deeper docs: [Deus Machina](deusmachina.md), [async Deus tasks](deus-async-tasks.md).

## Atlas shorthand

| Shorthand | Purpose | Typical input | Output/use |
|-----------|---------|---------------|------------|
| `M.section` | Declare an atlas section marker/record. | section metadata | atlas section |
| `M.atlas` | Declare an atlas from sections. | section records/options | atlas record |

Example:

```ts
const docs = M.atlas([M.section({ id: "intro", kind: "guide" })]);
```

Common mistake: table-powered atlas validation and extraction live under `machinalayout/atlas`; `M.atlas` is only the authoring shorthand.

Deeper docs: [Machina atlas](machina-atlas.md).

## Not `M.*`

These public surfaces intentionally use their own imports instead of `M`:

- Tables: `import { Table } from "machinalayout/table"`.
- Query: `import { Q } from "machinalayout/query"`.
- Dispatch: `import { dispatchEvent, defineDispatchTables } from "machinalayout/dispatch"`.
- Deus runtime/table bridges: `import { pendingResultTransitionsFromTable } from "machinalayout/deus"`.
- Match: `import { matchKind, matchEnum } from "machinalayout/match"`.
- Diagnostics shorthand: `import { D } from "machinalayout/diagnostics"`.
- Style/static/forms/commands: import from their package subpaths.
