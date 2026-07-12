# 0.6.0 — Tables as Authoring Primitives + Queryable Columnar Tables

## Unreleased

- Added typed root-relative Deus workflow authoring: `M.workflow`, bound event-narrowing helpers, `relative(...)`, and `transitionsFromWorkflow`, all lowering to ordinary Deus transition rows with no runtime changes.
- Added explicit serializable Deus stack control: `M.goto`, `M.push`, `M.pop`, and `M.stay`, including snapshot/hydration stack support and empty-pop diagnostics.
- Added scoped Deus transition authoring: `M.scope` and scoped `M.on` lower deterministically through `transitionsFromScopes` into ordinary `DeusTransitionRow` values without a new runtime.
- Added `useDeusMachine(..., { initialState })` hydration parity for React, React Native, and Vue bindings.
- Added `_` wildcard/default arms to `matchKind`, `matchEnum`, and `matchDiscriminated` while preserving exhaustive mode when `_` is omitted.
- Added typed generic return seams for `pendingResultTransitionsFromTable` and `transitionsFromTemplateTable`.
- Allowed shared Deus transitions to target implicit ancestor prefixes of declared substates without empty parent state boilerplate.
- Allowed function-form Deus transition `to` callbacks to return `undefined` to stay in the current state.
- Deferred composed async task-chain orchestration to future work rather than expanding M41 into a new async runtime.

## Highlights

- Columnar table records, schema columns, export/render helpers, keyed lookup, and derivation helpers.
- Table-authored runtime bridges for Machina Dispatch and Deus.
- Deus transition template tables for repeated transition families.
- Form and command table bridges that emit records, not framework renderers.
- Concept tables and concept-to-form projection.
- Tabular style sheets as an authoring surface for MachinaStyle.
- Atlas tables for project cartography.
- MachinaQuery: explicit in-memory query plans over ColumnarTable.
- Query iterator execution with visible board/snapshot/trace state.
- Chunked columnar JSON table/manifest records.
- Batch-backed query execution over already-loaded chunks.

## Boundaries

- No SQL/parser.
- No joins/groupBy/aggregate.
- No filesystem/network/bucket storage adapters.
- No transactions/indexes/query optimizer.
- No form renderer/state framework.
- No replacement style engine.
