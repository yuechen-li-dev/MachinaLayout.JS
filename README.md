# MachinaLayout.JS

MachinaLayout.JS is a TypeScript toolbox for authoring deterministic UI/layout records that machines, humans, tests, and framework renderers can all inspect. It treats documentation, table schemas, static artifacts, and layout rows as part of the public API rather than as implementation details.

## What it is

MachinaLayout.JS helps you describe interface structure, geometry, text, state, and data-oriented UI behavior as plain records. Those records can be lowered into resolved layout trees, rendered through React/Vue/native adapters, serialized for handoff, validated with diagnostics, or generated from tables and other authoring tools.

## Design principles

- **Record-first authoring:** prefer explicit typed records over hidden runtime magic.
- **Table-first tooling:** important authoring surfaces can be produced, reviewed, and validated as tables.
- **Deterministic lowering:** authored layout rows lower to inspectable frames and trees.
- **Small public entry points:** use package exports instead of deep source imports.
- **License clarity:** MachinaLayout.JS is the MIT toolbox; MachinaCanvas is the AGPL app/product under `/app`.

## Installation

```bash
npm install machinalayout
```

```ts
import { resolveLayoutRows } from "machinalayout";
import { M } from "machinalayout/machina";
import { Table } from "machinalayout/table";
```

## Five-minute example

```ts
import { resolveLayoutRows } from "machinalayout";
import { M } from "machinalayout/machina";

const authored = M.root("home", [
  M.vstack("panel", [
    M.text("title", "MachinaLayout.JS"),
    M.space(M.px(12)),
    M.hstack("actions", [M.text("primary", "Build"), M.text("secondary", "Inspect")]),
  ]),
]);

const resolved = resolveLayoutRows(M.rows(authored));
```

Use `M.*` to author layout intent, then use the resolver/renderer/static APIs that match your target.

## The `M.*` shorthand

`M` is exported by `machinalayout/machina`. It is shorthand for the public Machina authoring DSL: nodes, stacks, grids, guides, layers, screens, text records, machine-shaped records, and atlas sections. It is not a dumping ground for every API family.

See the complete [`M.*` shorthand reference](docs/m-shorthand-reference.md) for exact names, examples, common mistakes, and deeper links.

## Core API map

| Need | Use |
|------|-----|
| Author layout records | `M` from `machinalayout/machina` |
| Resolve layout rows/trees | `machinalayout` core exports |
| Style records/tokens/artifacts | `machinalayout/style` |
| Static documents/serialization | `machinalayout/static` |
| Durable authoring tables | `machinalayout/table` and `Table` |
| Query tabular/columnar data | `machinalayout/query` and `Q` |
| Declarative event updates | `machinalayout/dispatch` |
| State machines | `machinalayout/deus` plus React/Vue hooks |
| Exhaustive branching | `machinalayout/match` |
| Async/batch/iterator workflows | `machinalayout/async`, `machinalayout/batch`, `machinalayout/iter` |
| Concepts/forms/commands/diagnostics/atlas | their matching package subpaths |
| Framework rendering | `machinalayout/react`, `machinalayout/vue`, `machinalayout/react-native` |

## Tables as authoring primitives

Tables are first-class because they are reviewable, serializable, schema-checkable, and easy for LLMs to emit. Use `Table.define`, schema columns, conversion helpers, keyed tables, derivation helpers, chunks, and table bridges for concepts, Dispatch, Deus, atlas, styles, and queries. See [Machina tables](docs/machina-tables.md).

## Dispatch

Dispatch maps events to set/toggle/increment behavior using explicit tables and helpers such as `dispatchEvent`, `defineDispatchTables`, and table bridge functions. Use Dispatch when behavior is mostly data updates rather than hierarchical state. See [Machina Dispatch](docs/machina-dispatch.md).

## Deus state machines

Deus models stateful flows with explicit states, transitions, guards, effects, debug overlays, framework hooks, and table bridges. M43a adds explicit serializable stack targets: `M.push(path)`, `M.pop()`, `M.goto(path)`, and `M.stay()`. M43b adds `M.scope` / `M.on` for grouping rows with the same `from` path. M43c adds `M.workflow(root, factory)`: string paths inside a workflow are relative to its root, while Deus path arrays remain absolute. Workflows lower through `transitionsFromWorkflow` into ordinary transition rows before machine definition. Plain path targets still behave like `goto`; no generators or hidden continuations are used.

```ts
useDeusMachine(machine, board, {
  initialState: ["setup", "ready"],
});
```

```ts
const machine = defineDeusMachine<Board, Event>({
  states: [M.state(["setup", "editing"]), M.state(["setup", "review"])],
  transitions: [
    M.on("cancel", ["setup"], ["cancelled"]),
    {
      from: ["booking"],
      on: "publish",
      to: (board) => (board.live ? ["booking", "live"] : undefined),
    },
  ],
});
```

`initialState` hydrates the hook only on initialization. Implicit ancestors are prefixes of declared substates, not arbitrary states. A function `to` returning `undefined` remains in the current state. See [Deus Machina](docs/deusmachina.md).

## Match and async helpers

Use match helpers when TypeScript should force exhaustive branching. Wildcards are optional; omitting `_` preserves exhaustiveness.

```ts
matchKind(result, {
  ok: onOk,
  _: onFallback,
});
```

Use `machinalayout/async`, `machinalayout/batch`, and `machinalayout/iter` for task/result/trace/controller records. See [exhaustive match](docs/exhaustive-match.md), [batch concurrency](docs/batch-concurrency.md), and [explicit iterators](docs/explicit-iterators.md).

## Query and columnar tables

`machinalayout/query` provides `Q.from`, explicit plans, validation, execution, iteration snapshots, and chunk-aware query execution over columnar tables. Use it when the problem is data selection/projection rather than layout or state. See [Machina query](docs/machina-query.md) and [chunked columnar tables](docs/chunked-columnar-tables.md).

## React and Vue bindings

- `machinalayout/react` exports `MachinaReactView`, error surfaces, and `useDeusMachine`.
- `machinalayout/vue` exports `MachinaVueView` and `useDeusMachine`.
- `machinalayout/react-native` exports native rendering support.
- Text-specific renderers live under `machinalayout/text/react`, `machinalayout/text/vue`, and `machinalayout/text/react-native`.

## Samples

Samples live in [`samples/`](samples/) and demonstrate package-style imports, adapters, and resolved layout behavior.

## Documentation

Start with the [documentation index](docs/README.md). Important references include:

- [`M.*` shorthand reference](docs/m-shorthand-reference.md)
- [Package/export map](docs/package-exports.md)
- [Machina authoring](docs/machina-authoring.md)
- [Machina tables](docs/machina-tables.md)
- [Deus Machina](docs/deusmachina.md)
- [Exhaustive match](docs/exhaustive-match.md)

## MachinaCanvas

MachinaCanvas is the AGPL product/editor built on the MIT MachinaLayout.JS toolbox. Its source, tests, scripts, docs, fixtures, public assets, and dogfood artifacts are consolidated under [`/app`](app/README.md) so it can graduate into a separate repository. See the [repository graduation guide](app/docs/repository-graduation.md).

## Package and license boundaries

MachinaLayout.JS is MIT licensed via the root [`LICENSE`](LICENSE) and root `package.json`. MachinaCanvas is AGPL-3.0-or-later via [`app/LICENSE`](app/LICENSE) and private [`app/package.json`](app/package.json). The root npm package uses a `files` allowlist and must not ship `/app` source, tests, docs, fixtures, artifacts, assets, or package metadata; verify with `npm pack --dry-run --json`.

## Development

```bash
npm run format
npm run format:check
npm run lint
npm test
npm run build
npm pack --dry-run --json
```

Root convenience scripts delegate stable MachinaCanvas artifact workflows into `/app`:

```bash
npm run canvas:mechanical-exercise-354
npm run canvas:mechanical-exercise-354-blockout
npm run canvas:guide-overlay-fixture
```
