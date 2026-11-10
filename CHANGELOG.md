# 0.6.0 — Tables as Authoring Primitives + Queryable Columnar Tables

## Unreleased

- Added build-time artifacts to `machinalayout/comptime`: `CT.artifacts` registry with `CT.text` / `CT.json` (concept-checked) / `CT.module` (literal `as const satisfies` TS modules for exact types), `CT.write` / `CT.check` (always re-evaluates; ambient time/randomness guard plus double evaluation; manifest-based ownership with `UnownedFile` / `HandEditedArtifact` / `OrphanArtifact`; formatter-rewrite detection), and `nodeArtifactFs` from the new `machinalayout/comptime/node` subpath. Removed `CT.tuple` / `CT.object` (use `as const`).
- Static samples and toolkit-pipeline now declare their outputs as artifact registries; their sync tests check the samples' real registries instead of hand-copied pages. Samples import `machinalayout/*` (root `tsc` no longer needs a built `dist`), and a root `vitest.config.ts` resolves `machinalayout/*` to `src`.

- Added effect workflows to `machinalayout/iter`: `I.effect`, `I.workflow`, `I.attempt`, `I.all`, `I.now`, `I.random`; `yield*` returns typed responses. Drivers `I.run`, `I.runSync`, `I.drive` (typed scripted testing), `I.resume` (concept-validated snapshots, deterministic replay with `ReplayDivergence` / `InvalidReplayResponse` diagnostics), and `I.toMachine` (lowering to `IterMachine`, cursor = effect log). Added `I.once` / `I.seq` for one-shot iterator reuse.
- toolkit-pipeline sample: order enrichment now runs as a workflow inside its async task.

- Concepts are now typed (M36): `T.Infer<typeof C>` derives TypeScript types; added `T.union`, `T.oneOf`, nested concepts, `T.array(element)`, number/string refinements and brands, closed concepts, `T.custom`, and `T.implements<Type>()` drift guards.
- Concept diagnostics now recurse with indexed paths, discriminant routing, did-you-mean, origin concepts, and machine-applicable `fix` hints; `T.is` / `T.assert` narrow types.
- `T.template` derives its input type from `requires`; added `T.overload` (refinement-ordered dispatch with ambiguity diagnostics), `T.registry`, `T.example`, `T.counterexamples`, and `T.explain`.
- Merged `ConceptRecord` into `ConceptDefinition`: field metadata (`label`, `controlHint`, `placeholder`, …) lives on constraints (`T.string({ label })`, `T.meta`), `T.conceptFromTable` lowers a concept table to one `ConceptDefinition`, and `Form.fieldsFromConcept` projects any concept (code- or table-authored). Removed `conceptsFromTable`, `describeConcepts`, `ConceptRecord`, `fieldsFromConcepts`, and `DuplicateConceptFormField` (field names are now keys, so duplicates can't exist); added `UnsupportedConceptFormField` and `T.unknown()`.
- Removed the superseded concept type helpers (`T.HasField`, `OptionalField`, `HasId`, `HasKind`, `And`, `All`, `ConceptType`, `Extends`, `Equal`, `Assert`, `Satisfies`, `ConceptValue`); use `T.Infer` / `T.Matches`, or `machinalayout/comptime` for type-level tests.
- Fixed three sample tests that failed on a fresh clone (uncommitted `dist` artifacts for static-http and toolkit-pipeline; missing `@vitejs/plugin-react` / `tsx` for style-dogfood).
- Breaking: numbers reject `NaN` unless `allowNaN`; `undefined` fields count as missing; `T.compose` throws on conflicting source fields unless overridden; diagnostic messages are shorter and include type/origin.

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
