# 0.6.0 — Tables as Authoring Primitives + Queryable Columnar Tables

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
