# Comptime artifacts: implementation + Claudefood report

Goal: cover the bounded uses of build-time evaluation that generics can't, without macros, transforms, or a CLI. In practice that means two jobs:

- **Values to types.** Turn values computed at build time into exact types.
- **Safe generated files.** Make checked-in generated files a verified product instead of a source of drift.

This stays inside ordinary TypeScript. Designing real syntax for it is Copeland's job.

Stacked on #67 (effect workflows), because the emitter reuses its JSON-safety checker.

## Evidence that motivated it

Found in this repo and in Machina-Canvas before writing any code:

- **Hand-rolled generators everywhere.** Five static samples, toolkit-pipeline, and the Canvas scripts each hand-rolled `compile → run → writeFile`, plus a bespoke "checked-in output matches" test.
- **Sync tests tested a copy.** The static-sample sync tests compared disk against hand-copied duplicates of each sample's page (importing the real sample wrote files as a side effect). A changed sample would still pass against its stale copy.
- **Artifacts never committed.** Two of those tests failed on a fresh clone because the artifacts were never committed (fixed in #66's follow-up).
- **Tests rewrote committed files.** Machina-Canvas's guide-overlay test called the writer, so `npm test` rewrote `artifacts/guide-overlay-fixture.mcanvas.json` and left the working tree dirty on every run.
- **Untyped table concepts.** A table-lowered concept infers as `Record<string, unknown>` (flagged in the concepts PR).

## What shipped

| Feature | Pain it targets |
|---|---|
| `CT.module` + `CT.ts.exportConst` (`as const satisfies T`) | computed values have no static types; now baked literals infer exactly |
| `CT.text`, `CT.json` (optional concept) | ad-hoc `writeFileSync` scripts; invalid data found at runtime |
| `CT.check` | one bespoke sync test per sample, comparing against copies |
| `CT.write` + `.machina-artifacts.json` ownership | generators clobbering hand-written files; hand edits silently overwritten |
| Ambient guard + double evaluation | generated output that differs per run, or per machine |
| Formatter-rewrite detection | formatters and generators fighting over the same files |
| `machinalayout/comptime/node` (`nodeArtifactFs`) | keeps `machinalayout/comptime` browser-safe; core takes an injected fs |

Removed: `CT.tuple` and `CT.object`, which are superseded by `as const`, `const` type parameters and `satisfies`. `CT.keys` stays, because typed `Object.keys` is still missing from TS.

## Decisions worth reviewing

1. **`check` always re-evaluates everything; nothing is cached.** Correctness never depends on declared inputs being complete. Inputs are hashed for provenance and future watch mode only. This is the main way codegen tools usually go wrong.
2. **Inputs are read before the generator runs.** `ctx.read`/`ctx.json` only see declared inputs (`UndeclaredInput` otherwise), so provenance is exact by construction.
3. **Async generators are allowed.** The design said "sync only", but toolkit-pipeline's report is `await runToolkitPipeline()`. The guard now stays active across awaits and generators run strictly one at a time. The tradeoff: `write`/`check` must not run concurrently with unrelated code, which build scripts and test files satisfy.
4. **Determinism: guard *and* double evaluation.** The guard names the common culprits (`Date.now`, `new Date()`, `Math.random`) at the call. Double evaluation catches the rest (module counters, iteration order).
5. **Ownership via one manifest, no file headers.** HTML and JSON stay unpolluted. Emitted TS modules still get a "do not edit" comment for humans. Content hashes distinguish `HandEditedArtifact` from `StaleArtifact`. A file identical to the generator's output is adopted silently, which made migrating six samples a no-op. A differing unowned file is refused until a one-time `force`.
6. **Key order is preserved, not sorted.** It's meaningful (concept field order = form order). Determinism comes from the guard and double evaluation, not from canonicalization.
7. **Text only.** PNGs and the Canvas Inkscape step stay imperative next to the registry. Handling binary or external-tool output well needs a different contract (content hashing of bytes, tool-version pinning), and I didn't want to fake it.
8. **cyrb53 hashes, not SHA-256.** They're used only to detect edits, which keeps the core free of Node crypto.

## Claudefood findings

Dogfood:

- **Baked concept:** a concept table baked to `test/comptime/fixtures/generated/provider.concept.ts`. `T.Matches` proves the inference is exact: `status: "draft" | "live" | "archived"`, `contactEmail?: string`.
- **Samples:** all five static samples and toolkit-pipeline.
- **Machina-Canvas:** the guide-overlay fixture, a real messy script (separate PR in that repo).

What I found:

- **Bootstrap trap (fixed).** My first sample conversion imported `../../../dist/...`. The tests import the samples, so root `tsc` started requiring a built `dist`, and `npm run build` typechecks first, so a fresh clone could never build. Samples now import `machinalayout/*` (root tsconfig paths map those to `src`; sample builds use the existing bridge tool). A root `vitest.config.ts` alias resolves `machinalayout/*` to `src`, so tests can't silently run against a stale `dist`. Root `tsc` and the static-sample tests now pass with no `dist` at all.
- **Async needed (design changed).** See decision 3.
- **Formatter collision (fixed in the diagnostic).** Canvas's committed scene JSON had been reformatted by Biome before `artifacts/` was excluded. My emitted TS module also fails `biome check`. Generated outputs must be excluded from formatters (this repo now excludes `test/comptime/fixtures/generated`). When a diff is whitespace-only, the diagnostic now says a formatter probably rewrote the file.
- **Migration UX (improved).** The `UnownedFile` message now tells you to adopt with `force: true` once if the file came from an old generator.
- **Tracked build intermediate.** `samples/static-http/.generated/page.js` was committed; it's now untracked, as `.gitignore` intended.
- **Stale `app/` copy.** `app/` in this repo is a stale copy of Machina-Canvas. Its scripts use `resolve(__dirname, "../../..")`, which points outside this repo; Canvas itself uses `".."`. I reverted my accidental `app/` edits and left the directory alone. Consider deleting it, since it isn't built or tested here and is already drifting.

## Verification

- `tsc --noEmit` is clean, including with `dist` removed. Biome is clean on touched files.
- MachinaLayout.JS: 1226 passed, 0 failed. Re-running every sample build leaves `dist` unchanged.
- Machina-Canvas: 513 passed, and the working tree stays clean after the suite (it used to rewrite a committed artifact).

## Not done / next

- No watch or incremental mode. If it's added, it must stay an optimization on top of the declared inputs (decision 1).
- No binary artifacts (decision 7).
- Import-level cycles (a generator importing its own output module) aren't detected; only input-level cycles are. Checked-in outputs make the bootstrap work, but a generator reading its own stale output through an import would go unnoticed.
- The other four Canvas scripts (tinytown, mechanical-354, -354-blockout, -m40c) still hand-roll their writes. They're mostly binary and external-tool output, so the payoff is smaller.
