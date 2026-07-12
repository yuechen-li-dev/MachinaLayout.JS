# Documentation

MachinaLayout.JS documentation is organized around public package entry points and the authoring surfaces exported from them. Start with the root [README](../README.md), then use this map for focused references.

## Start here

- [Root README](../README.md) — front door, examples, API-family chooser, development commands, and license boundaries.
- [`M.*` shorthand reference](m-shorthand-reference.md) — exact shorthand exported by `machinalayout/machina`.
- [Package/export map](package-exports.md) — supported npm subpath imports and intended audiences.

## Core authoring

- [Machina authoring](machina-authoring.md) — layout records, lowering, rows, screens, layers, grids, guides, and atlas helpers.
- [Machina static](machina-static.md) — static document records, serialization, and validation.
- [Machina style](machina-style.md) — style tokens, style rules, tabular styles, and artifacts.
- [Machina tables](machina-tables.md) — table authoring, schemas, conversion, derivation, keyed tables, and chunks.
- [Machina query](machina-query.md) and [chunked columnar tables](chunked-columnar-tables.md) — query plans, execution, iteration, and chunk-aware planning.

## Behavior

- [Machina Dispatch](machina-dispatch.md) — table-authored set/toggle/increment dispatch maps.
- [Deus Machina](deusmachina.md) and [async Deus tasks](deus-async-tasks.md) — state machines, React/Vue hooks, M41 ergonomics, task rows, and table bridges.
- [Exhaustive match](exhaustive-match.md) — `matchKind`, `matchEnum`, wildcard fallbacks, enum tables, and `assertNever`.
- [Batch concurrency](batch-concurrency.md) — batch tasks, validation, tracing, and results.
- [Explicit iterators](explicit-iterators.md) — iterator/controller helpers.

## Data and tooling

- [Concepts](machina-concepts.md) — concept definitions, templates, table projection, and validation.
- [Compile-time helpers](compile-time-helpers.md) — literal, string, and guard utilities.
- [Diagnostics](machina-diagnostics.md) and [error codes](error-codes.md) — diagnostic records and reports.
- [Text utilities](text-utilities.md), [text parser](machina-text-parser.md), and [M2a text plan](machina-text-m2a-plan.md) — text records, parsing, and helpers.
- [Commands](machina-commands.md) — command records and command batch helpers.
- [Forms](machina-forms.md) — fields and concept projections.
- [Atlas](machina-atlas.md) — atlas sections, extraction, table bridge, and validation.
- [Inspection and handoff](inspection-and-handoff.md) — DOM summaries and handoff bundles.

## Frameworks

- [React adapter](react-adapter.md) and [React error surface](machina-react-error-surface.md) — React rendering and error boundaries.
- [React Native adapter](react-native-adapter.md) and [React Native text renderer](react-native-text-renderer.md).
- [Vue adapter](vue-adapter.md) and [Vue text renderer](vue-text-renderer.md).
- [Machina text React](machina-text-react.md).

## Architecture and design

- [Table-first authoring](machina-tables.md) — tables as durable authoring primitives.
- [Compiler/lowering model](machina-authoring.md) — `M.*` records lower to layout rows and resolved trees.
- [Package boundaries](package-exports.md) — MIT library exports versus the AGPL `/app` product boundary.
- [Local sample subpath imports](local-sample-subpath-imports.md) — how samples exercise package-style imports.

## MachinaCanvas app/product

MachinaCanvas is not part of the MIT npm package. Its source, tests, scripts, docs, fixtures, public assets, and intentional dogfood artifacts live under [`/app`](../app/README.md), with repository-graduation notes in [`/app/docs/repository-graduation.md`](../app/docs/repository-graduation.md).
